<?php
/**
 * ShortcodeReplacer class file.
 *
 * @package VuloForm
 */

namespace VuloForm\Migration;

defined( 'ABSPATH' ) || exit;

/**
 * Replaces a source plugin's embed shortcode with VuloForm's own `[vuloform id="..."]`, across
 * every post type and status. Only the shortcode tag is touched. A migrator calls this once its
 * forms exist, passing the id map it knows (`{source_id: new_vuloform_id}`); anything else is left alone.
 */
class ShortcodeReplacer {

	/**
	 * @param string              $tag    Source shortcode tag, e.g. 'wpforms'.
	 * @param string              $id_attr Attribute on that shortcode holding the source form id, e.g. 'id'.
	 * @param array<string, int>  $id_map Source id (as string) => new VuloForm form id.
	 * @return array{posts_updated: int, references_updated: int}
	 */
	public function replace( string $tag, string $id_attr, array $id_map ): array {
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
}
