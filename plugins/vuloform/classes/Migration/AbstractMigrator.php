<?php
/**
 * AbstractMigrator class file.
 *
 * @package VuloForm
 */

namespace VuloForm\Migration;

defined( 'ABSPATH' ) || exit;

/**
 * What every "import forms from another plugin" migrator does identically: skip-if-already-
 * migrated/record-the-mapping bookkeeping, one error message per failed source form, and
 * rewriting the source plugin's embed shortcode(s) site-wide afterwards. A migrator subclass
 * supplies only what differs between source plugins - detecting the plugin, listing its forms,
 * turning one of them into a VuloForm schema, and its own embed shortcode tag(s).
 */
abstract class AbstractMigrator implements MigratorInterface {

	/**
	 * @var MigrationMap
	 */
	protected $map;

	public function __construct() {
		$this->map = new MigrationMap();
	}

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

			$existing_form_id = $this->map->get( $this->get_id(), $source_id );

			if ( $existing_form_id && ! $overwrite ) {
				++$skipped;
				continue;
			}

			try {
				$form_id = $this->migrate_one( $source_id, $existing_form_id, $errors );

				if ( $form_id ) {
					$this->map->record( $this->get_id(), $source_id, $form_id );
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
			$form_id = $this->map->get( $this->get_id(), $row['source_id'] );

			if ( $form_id ) {
				$id_map[ (string) $row['source_id'] ] = $form_id;
			}
		}

		$posts_updated      = 0;
		$references_updated = 0;

		foreach ( $this->shortcode_tags() as $tag ) {
			$result              = ( new ShortcodeReplacer() )->replace( $tag, 'id', $id_map );
			$posts_updated      += $result['posts_updated'];
			$references_updated += $result['references_updated'];
		}

		return array(
			'posts_updated'      => $posts_updated,
			'references_updated' => $references_updated,
		);
	}
}
