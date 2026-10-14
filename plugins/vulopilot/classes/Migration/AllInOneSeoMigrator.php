<?php
/**
 * AllInOneSeoMigrator class file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\Migration;

use VuloPilot\SeoVisibility\PostSeoMetaFields;

defined( 'ABSPATH' ) || exit;

/**
 * Imports All in One SEO (v4+)'s per-post data into VuloPilot's own SEO postmeta. Unlike Rank
 * Math and Yoast SEO, AIOSEO v4 keeps this in its own `{prefix}aioseo_posts` table rather than
 * postmeta, so this migrator reads that table directly instead of extending
 * `AbstractPostMetaSeoMigrator`.
 *
 * @class       AllInOneSeoMigrator
 * @version     1.0.0
 * @author      VuloLabs
 */
class AllInOneSeoMigrator implements MigratorInterface {

	/**
	 * @inheritDoc
	 */
	public function get_id(): string {
		return 'all-in-one-seo';
	}

	/**
	 * @inheritDoc
	 */
	public function get_label(): string {
		return __( 'All in One SEO', 'vulopilot' );
	}

	/**
	 * @inheritDoc
	 */
	public function count_available(): int {
		if ( ! $this->table_exists() ) {
			return 0;
		}

		global $wpdb;

		return (int) $wpdb->get_var( "SELECT COUNT(*) FROM {$wpdb->prefix}aioseo_posts WHERE title != '' OR description != ''" ); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
	}

	/**
	 * @inheritDoc
	 */
	public function migrate( bool $overwrite = false ): array {
		$migrated = 0;
		$skipped  = 0;
		$errors   = array();

		if ( ! $this->table_exists() ) {
			return array( 'migrated' => 0, 'skipped' => 0, 'errors' => array() );
		}

		global $wpdb;

		$rows = $wpdb->get_results( // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
			"SELECT post_id, title, description, keyphrases, canonical_url, robots_noindex, robots_nofollow, og_title, og_description
			FROM {$wpdb->prefix}aioseo_posts
			WHERE title != '' OR description != ''"
		);

		foreach ( $rows as $row ) {
			$post_id = (int) $row->post_id;

			try {
				if ( ! $overwrite && $this->already_has_vulopilot_data( $post_id ) ) {
					$skipped++;
					continue;
				}

				$this->migrate_row( $post_id, $row );
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
	 * @return bool
	 */
	private function table_exists(): bool {
		global $wpdb;

		$table = $wpdb->prefix . 'aioseo_posts';

		return $wpdb->get_var( $wpdb->prepare( 'SHOW TABLES LIKE %s', $table ) ) === $table;
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
	 * @param int      $post_id Post id.
	 * @param \stdClass $row    One `wp_aioseo_posts` row.
	 * @return void
	 */
	private function migrate_row( int $post_id, \stdClass $row ): void {
		if ( '' !== (string) $row->canonical_url ) {
			update_post_meta( $post_id, PostSeoMetaFields::META_KEYS['canonical_url'], $row->canonical_url );
		}

		update_post_meta( $post_id, PostSeoMetaFields::META_KEYS['robots_noindex'], (bool) $row->robots_noindex );
		update_post_meta( $post_id, PostSeoMetaFields::META_KEYS['robots_nofollow'], (bool) $row->robots_nofollow );

		if ( '' !== (string) $row->og_title ) {
			update_post_meta( $post_id, PostSeoMetaFields::META_KEYS['social_title'], $row->og_title );
		}

		if ( '' !== (string) $row->og_description ) {
			update_post_meta( $post_id, PostSeoMetaFields::META_KEYS['social_description'], $row->og_description );
		}

		$keyword = $this->extract_focus_keyword( (string) $row->keyphrases );

		if ( '' !== $keyword ) {
			update_post_meta( $post_id, PostSeoMetaFields::META_KEYS['focus_keyword'], $keyword );
		}
	}

	/**
	 * AIOSEO stores `keyphrases` as a JSON blob: `{"focus":{"keyphrase":"..."},"additional":[...]}`.
	 *
	 * @param string $json_keyphrases Raw `keyphrases` column value.
	 * @return string
	 */
	private function extract_focus_keyword( string $json_keyphrases ): string {
		$decoded = json_decode( $json_keyphrases, true );

		return is_array( $decoded ) ? (string) ( $decoded['focus']['keyphrase'] ?? '' ) : '';
	}
}
