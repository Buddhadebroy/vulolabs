<?php
/**
 * AbstractMigrator class file.
 *
 * @package VuloForm
 */

namespace VuloForm\Migration;

defined( 'ABSPATH' ) || exit;

/**
 * What every "import forms from another plugin" migrator does identically: skip-already-migrated
 * bookkeeping, per-form error reporting, and shortcode rewriting. A subclass supplies only what
 * differs - detecting the plugin, listing its forms, and turning one into a VuloForm schema.
 */
abstract class AbstractMigrator implements MigratorInterface {

	/**
	 * Option holding every source plugin's source-form -> VuloForm-form mapping, keyed
	 * `"{source}:{source_id}"` => VuloForm form id, so a migration can be retried without ever
	 * creating duplicate forms.
	 */
	const MAP_OPTION = 'vuloform_migration_map';

	/**
	 * @return bool Whether the source plugin is active and can be read from right now.
	 */
	abstract protected function is_active();

	/**
	 * @return string[] The source plugin's own embed shortcode tag(s) - more than one when it
	 *                   accepts an alias (Gravity Forms' `[gravityform]`/`[gravityforms]`).
	 */
	abstract protected function shortcode_tags();

	/**
	 * @param int|string $source_id        One source form, as `list_available()` identified it.
	 * @param int|null   $existing_form_id A VuloForm form already created for it, if any (re-migrating with `$overwrite`).
	 * @param string[]   $errors           Compatibility notes, by reference.
	 * @return int VuloForm form id, or 0 on failure.
	 */
	abstract protected function migrate_one( $source_id, ?int $existing_form_id, array &$errors );

	/**
	 * @inheritDoc
	 */
	public function migrate( array $source_ids = array(), bool $overwrite = false ): array {
		$migrated = 0;
		$skipped  = 0;
		$errors   = array();

		if ( ! $this->is_active() ) {
			return array(
				'migrated'           => 0,
				'skipped'            => 0,
				/* translators: %s: source plugin name. */
				'errors'             => array( sprintf( __( '%s is not installed, so there is nothing to migrate.', 'vuloform' ), $this->get_label() ) ),
				'posts_updated'      => 0,
				'references_updated' => 0,
			);
		}

		foreach ( $this->list_available() as $row ) {
			$source_id = $row['source_id'];

			if ( $source_ids && ! in_array( $source_id, $source_ids, true ) ) {
				continue;
			}

			$existing_form_id = self::map_get( $this->get_id(), $source_id );

			if ( $existing_form_id && ! $overwrite ) {
				++$skipped;
				continue;
			}

			try {
				$form_id = $this->migrate_one( $source_id, $existing_form_id, $errors );

				if ( $form_id ) {
					self::map_record( $this->get_id(), $source_id, $form_id );
					++$migrated;
				} else {
					$errors[] = sprintf(
						/* translators: 1: source plugin name, 2: source form id. */
						__( '%1$s form #%2$s could not be created in VuloForm.', 'vuloform' ),
						$this->get_label(),
						$source_id
					);
				}
			} catch ( \Throwable $e ) {
				$errors[] = sprintf(
					/* translators: 1: source plugin name, 2: source form id, 3: error message. */
					__( '%1$s form #%2$s: %3$s', 'vuloform' ),
					$this->get_label(),
					$source_id,
					$e->getMessage()
				);
			}
		}

		$shortcodes = $this->replace_shortcodes();

		return array(
			'migrated'           => $migrated,
			'skipped'            => $skipped,
			'errors'             => $errors,
			'posts_updated'      => $shortcodes['posts_updated'],
			'references_updated' => $shortcodes['references_updated'],
		);
	}

	/**
	 * Replaces every known mapping's old shortcode(s) with `[vuloform id="M"]` - every form ever
	 * migrated, not just this run's, so a retry also catches references added since.
	 *
	 * @return array{posts_updated: int, references_updated: int}
	 */
	protected function replace_shortcodes() {
		$id_map = array();

		foreach ( $this->list_available() as $row ) {
			$form_id = self::map_get( $this->get_id(), $row['source_id'] );

			if ( $form_id ) {
				$id_map[ (string) $row['source_id'] ] = $form_id;
			}
		}

		$posts_updated      = 0;
		$references_updated = 0;

		foreach ( $this->shortcode_tags() as $tag ) {
			$result              = self::replace_shortcode_tag( $tag, 'id', $id_map );
			$posts_updated      += $result['posts_updated'];
			$references_updated += $result['references_updated'];
		}

		return array(
			'posts_updated'      => $posts_updated,
			'references_updated' => $references_updated,
		);
	}

	/**
	 * Replaces one source shortcode tag with VuloForm's own `[vuloform id="..."]`, across every
	 * post type and status. Only the shortcode tag is touched.
	 *
	 * @param string             $tag     Source shortcode tag, e.g. 'wpforms'.
	 * @param string             $id_attr Attribute on that shortcode holding the source form id, e.g. 'id'.
	 * @param array<string, int> $id_map  Source id (as string) => new VuloForm form id.
	 * @return array{posts_updated: int, references_updated: int}
	 */
	private static function replace_shortcode_tag( string $tag, string $id_attr, array $id_map ): array {
		if ( ! $id_map ) {
			return array(
				'posts_updated'      => 0,
				'references_updated' => 0,
			);
		}

		global $wpdb;

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$post_ids = $wpdb->get_col(
			$wpdb->prepare(
				"SELECT ID FROM {$wpdb->posts} WHERE post_status NOT IN ( 'trash', 'auto-draft' ) AND post_content LIKE %s", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
				'%[' . $wpdb->esc_like( $tag ) . '%'
			)
		);

		$posts_updated      = 0;
		$references_updated = 0;
		$regex              = get_shortcode_regex( array( $tag ) );

		foreach ( $post_ids as $post_id ) {
			$post = get_post( (int) $post_id );

			if ( ! $post ) {
				continue;
			}

			$changed_here = 0;

			$new_content = preg_replace_callback(
				"/{$regex}/",
				function ( $found ) use ( $id_attr, $id_map, &$changed_here ) {
					// get_shortcode_regex() is scoped to just this one tag, so group 3 (the
					// attribute string) always belongs to the shortcode being replaced.
					$atts      = shortcode_parse_atts( $found[3] );
					$source_id = is_array( $atts ) ? (string) ( $atts[ $id_attr ] ?? '' ) : '';

					if ( '' === $source_id || ! isset( $id_map[ $source_id ] ) ) {
						return $found[0];
					}

					++$changed_here;

					return $found[1] . '[vuloform id="' . (int) $id_map[ $source_id ] . '"]' . $found[6];
				},
				$post->post_content
			);

			if ( null !== $new_content && $changed_here > 0 && $new_content !== $post->post_content ) {
				wp_update_post(
					array(
						'ID'           => $post->ID,
						'post_content' => $new_content,
					)
				);

				++$posts_updated;
				$references_updated += $changed_here;
			}
		}

		return array(
			'posts_updated'      => $posts_updated,
			'references_updated' => $references_updated,
		);
	}

	/**
	 * @param string     $source    Migrator id, e.g. 'wpforms'.
	 * @param int|string $source_id Source plugin's own form id.
	 * @return int|null VuloForm form id, or null when not migrated yet.
	 */
	protected static function map_get( string $source, $source_id ): ?int {
		$map = get_option( self::MAP_OPTION, array() );
		$key = $source . ':' . $source_id;

		return isset( $map[ $key ] ) ? (int) $map[ $key ] : null;
	}

	/**
	 * @param string     $source    Migrator id.
	 * @param int|string $source_id Source plugin's own form id.
	 * @param int        $form_id   The VuloForm form it was migrated into.
	 * @return void
	 */
	private static function map_record( string $source, $source_id, int $form_id ): void {
		$map                          = get_option( self::MAP_OPTION, array() );
		$map[ $source . ':' . $source_id ] = $form_id;

		update_option( self::MAP_OPTION, $map );
	}
}
