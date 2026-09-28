<?php
namespace VuloPilot\Content;

defined( 'ABSPATH' ) || exit;

/**
 * Injects `id="..."` onto every real `h1`-`h6` a `vulopilot/table-of- contents`
 * block's own links point to.
 *
 * @class       HeadingAnchorInjector class
 * @version     1.0.0
 * @author      VuloLabs
 */
class HeadingAnchorInjector {

	/**
	 * HeadingAnchorInjector constructor.
	 */
	public function __construct() {
		add_filter( 'the_content', array( $this, 'inject_anchors' ), 20 );
	}

	/**
	 * @param string $content Real, fully block-rendered post content (do_blocks() has already run by priority 20).
	 * @return string
	 */
	public function inject_anchors( string $content ): string {
		$post_id = get_the_ID();

		if ( ! $post_id || ! has_block( 'vulopilot/table-of-contents', $post_id ) ) {
			return $content;
		}

		$headings = HeadingAnchorResolver::collect( $post_id );

		if ( empty( $headings ) ) {
			return $content;
		}

		$cursor = 0;

		return preg_replace_callback(
			'#<h[1-6]([^>]*)>#i',
			static function ( array $matches ) use ( $headings, &$cursor ): string {
				if ( false !== stripos( $matches[1], 'id=' ) ) {
					// Already has an id (e.g. a manually-set custom anchor).
					return $matches[0];
				}

				if ( ! isset( $headings[ $cursor ] ) ) {
					return $matches[0];
				}

				$anchor = $headings[ $cursor ]['anchor'];
				++$cursor;

				return preg_replace( '/^(<h[1-6])/i', '$1 id="' . esc_attr( $anchor ) . '"', $matches[0], 1 );
			},
			$content
		);
	}
}
