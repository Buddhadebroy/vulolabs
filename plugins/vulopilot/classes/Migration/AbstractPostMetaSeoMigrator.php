<?php
/**
 * AbstractPostMetaSeoMigrator class file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\Migration;

use VuloPilot\SeoVisibility\PostSeoMetaFields;

defined( 'ABSPATH' ) || exit;

/**
 * Shared "read the source plugin's own postmeta keys, write VuloPilot's own postmeta keys" logic
 * for the two competitors (Rank Math, Yoast SEO) whose per-post SEO data lives in plain postmeta
 * rather than a custom table. `All in One SEO` (v4+) keeps its data in its own DB table instead,
 * so it extends `MigratorInterface` directly rather than this class - see `AllInOneSeoMigrator`.
 *
 * @class       AbstractPostMetaSeoMigrator
 * @version     1.0.0
 * @author      VuloLabs
 */
abstract class AbstractPostMetaSeoMigrator implements MigratorInterface {

	/**
	 * The source plugin's own postmeta key for each VuloPilot field this migrator knows how to
	 * fill, keyed the same way as `PostSeoMetaFields::META_KEYS`. A subclass may omit any key it
	 * has no equivalent for.
	 *
	 * @return array<string, string>
	 */
	abstract protected function source_meta_keys(): array;

	/**
	 * Reads one source value and returns it in the shape `PostSeoMetaFields` expects - override
	 * for a field (robots noindex/nofollow, a serialized blob) that isn't a plain pass-through
	 * string.
	 *
	 * @param string $field      The `PostSeoMetaFields::META_KEYS` field name.
	 * @param mixed  $raw_value  The raw postmeta value.
	 * @param int    $post_id    The post id, for fields that need a second lookup.
	 * @return mixed
	 */
	protected function normalize_value( string $field, $raw_value, int $post_id ) {
		return $raw_value;
	}

	/**
	 * @inheritDoc
	 */
	public function count_available(): int {
		return count( $this->find_post_ids() );
	}

	/**
	 * @inheritDoc
	 */
	public function migrate( bool $overwrite = false ): array {
		$migrated = 0;
		$skipped  = 0;
		$errors   = array();

		foreach ( $this->find_post_ids() as $post_id ) {
			try {
				if ( ! $overwrite && $this->already_has_vulopilot_data( $post_id ) ) {
					$skipped++;
					continue;
				}

				$this->migrate_post( $post_id );
				$migrated++;
			} catch ( \Throwable $e ) {
				$errors[] = sprintf( 'Post #%d: %s', $post_id, $e->getMessage() );
			}
		}

		return array(
			'migrated' => $migrated,
			'skipped'  => $skipped,
			'errors'   => $errors,
		);
	}

	/**
	 * Every post id, across all SEO-managed post types, that has at least one of this migrator's
	 * own source meta keys set to a non-empty value - not just the title field, since a post can
	 * have real data (e.g. only a focus keyword set) without ever having had its title field
	 * saved.
	 *
	 * @return int[]
	 */
	private function find_post_ids(): array {
		$keys = array_unique( array_values( $this->source_meta_keys() ) );

		if ( empty( $keys ) ) {
			return array();
		}

		$meta_query = array( 'relation' => 'OR' );

		foreach ( $keys as $key ) {
			$meta_query[] = array(
				'key'     => $key,
				'value'   => '',
				'compare' => '!=',
			);
		}

		return get_posts(
			array(
				'post_type'      => PostSeoMetaFields::POST_TYPES,
				'post_status'    => 'any',
				'posts_per_page' => -1,
				'fields'         => 'ids',
				'meta_query'     => $meta_query, // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_query
			)
		);
	}

	/**
	 * @param int $post_id Post id.
	 * @return bool
	 */
	private function already_has_vulopilot_data( int $post_id ): bool {
		$existing = get_post_meta( $post_id, PostSeoMetaFields::META_KEYS['focus_keyword'], true );

		return '' !== (string) $existing;
	}

	/**
	 * @param int $post_id Post id.
	 * @return void
	 */
	private function migrate_post( int $post_id ): void {
		foreach ( $this->source_meta_keys() as $field => $source_key ) {
			$raw = get_post_meta( $post_id, $source_key, true );

			if ( '' === $raw || null === $raw ) {
				continue;
			}

			$value = $this->normalize_value( $field, $raw, $post_id );

			if ( '' === $value || null === $value ) {
				continue;
			}

			$meta_key = PostSeoMetaFields::META_KEYS[ $field ] ?? null;

			if ( null === $meta_key ) {
				continue;
			}

			update_post_meta( $post_id, $meta_key, $value );
		}
	}
}
