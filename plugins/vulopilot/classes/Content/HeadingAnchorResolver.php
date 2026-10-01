<?php
namespace VuloPilot\Content;

defined( 'ABSPATH' ) || exit;

/**
 * The one real heading-slug algorithm both the `vulopilot/table-of-contents` block and
 * `HeadingAnchorInjector` build on.
 *
 * @class       HeadingAnchorResolver class
 * @version     1.0.0
 * @author      VuloLabs
 */
class HeadingAnchorResolver {

	/**
	 * Every real `core/heading` block in a post's raw content, in document order, at any
	 * nesting depth (inside `core/group`/`core/columns`/etc).
	 *
	 * @param int $post_id Real post id.
	 * @return array<int, array{level: int, text: string, anchor: string}>
	 */
	public static function collect( int $post_id ): array {
		$post = get_post( $post_id );

		if ( ! $post ) {
			return array();
		}

		$headings = array();
		$used     = array();

		self::walk( parse_blocks( $post->post_content ), $headings, $used );

		return $headings;
	}

	/**
	 * @param array<int, array<string, mixed>> $blocks   parse_blocks() output (or an innerBlocks slice of it).
	 * @param array<int, array<string, mixed>> $headings Accumulator, appended to by reference.
	 * @param array<string, bool>              $used     Slugs already claimed, keyed by slug, appended to by reference.
	 * @return void
	 */
	private static function walk( array $blocks, array &$headings, array &$used ): void {
		foreach ( $blocks as $block ) {
			if ( 'core/heading' === ( $block['blockName'] ?? null ) ) {
				$heading = self::extract_heading( (string) ( $block['innerHTML'] ?? '' ), $used );

				if ( null !== $heading ) {
					$headings[] = $heading;
				}
			}

			if ( ! empty( $block['innerBlocks'] ) ) {
				self::walk( $block['innerBlocks'], $headings, $used );
			}
		}
	}

	/**
	 * Heading `content`, `level` and `anchor` are markup-sourced, so they are not in
	 * `$block['attrs']` and are read from the inner HTML.
	 *
	 * @param string              $inner_html A core/heading block's raw `innerHTML`.
	 * @param array<string, bool> $used       Slugs already claimed, appended to by reference.
	 * @return array{level: int, text: string, anchor: string}|null Null if no real heading markup or blank text.
	 */
	private static function extract_heading( string $inner_html, array &$used ): ?array {
		if ( ! preg_match( '#<h([1-6])([^>]*)>(.*)</h\1>#is', $inner_html, $matches ) ) {
			return null;
		}

		$level         = (int) $matches[1];
		$opening_attrs = $matches[2];
		$raw_text      = trim( $matches[3] );
		$plain         = trim( wp_strip_all_tags( $raw_text ) );

		if ( '' === $plain ) {
			return null;
		}

		$existing_id = '';
		if ( preg_match( '#\sid=["\']([^"\']+)["\']#i', $opening_attrs, $id_match ) ) {
			$existing_id = $id_match[1];
		}

		if ( '' !== $existing_id ) {
			// A real, already-present id (a manually-set custom HTML anchor).
			$anchor          = $existing_id;
			$used[ $anchor ] = true;
		} else {
			$anchor = self::unique_slug( $plain, $used );
		}

		return array(
			'level'  => $level,
			'text'   => wp_kses_post( $raw_text ),
			'anchor' => $anchor,
		);
	}

	/**
	 * @param string              $text Real heading text to slugify.
	 * @param array<string, bool> $used Slugs already claimed, appended to by reference.
	 * @return string A slug guaranteed not already present in $used.
	 */
	private static function unique_slug( string $text, array &$used ): string {
		$base = sanitize_title( $text );
		$base = '' !== $base ? $base : 'heading';

		$slug  = $base;
		$index = 2;

		while ( isset( $used[ $slug ] ) ) {
			$slug = $base . '-' . $index;
			++$index;
		}

		$used[ $slug ] = true;

		return $slug;
	}
}
