<?php
namespace VuloPilot\Content;

defined( 'ABSPATH' ) || exit;

/**
 * Render logic for the `vulopilot/table-of-contents` block, kept out of render.php because
 * WP loads that file with `require`.
 *
 * @class       TableOfContentsRenderer class
 * @version     1.0.0
 * @author      VuloLabs
 */
class TableOfContentsRenderer {

	/**
	 * @param array<string, mixed> $attributes Real block attributes (title/minLevel/maxLevel/collapsible).
	 * @param int                  $post_id    The post this block instance is rendering on.
	 * @return string Real HTML, or '' if the post has no matching headings (no empty shell rendered).
	 */
	public static function render( array $attributes, int $post_id ): string {
		if ( ! $post_id ) {
			return '';
		}

		$min_level   = isset( $attributes['minLevel'] ) ? (int) $attributes['minLevel'] : 2;
		$max_level   = isset( $attributes['maxLevel'] ) ? (int) $attributes['maxLevel'] : 6;
		$title       = ! empty( $attributes['title'] ) ? (string) $attributes['title'] : __( 'Table of Contents', 'vulopilot' );
		$collapsible = ! empty( $attributes['collapsible'] );

		$headings = array_values(
			array_filter(
				HeadingAnchorResolver::collect( $post_id ),
				static function ( array $heading ) use ( $min_level, $max_level ): bool {
					return $heading['level'] >= $min_level && $heading['level'] <= $max_level;
				}
			)
		);

		if ( empty( $headings ) ) {
			return '';
		}

		$list_html          = self::build_list( $headings );
		$wrapper_attributes = get_block_wrapper_attributes(
			array(
				'class' => 'vulopilot-toc',
				'style' => self::build_style_attribute( $attributes ),
			)
		);

		if ( $collapsible ) {
			return sprintf(
				'<nav %1$s aria-label="%2$s"><details class="vulopilot-toc-details" open><summary class="vulopilot-toc-title">%3$s</summary>%4$s</details></nav>',
				$wrapper_attributes,
				esc_attr( $title ),
				esc_html( $title ),
				$list_html
			);
		}

		return sprintf(
			'<nav %1$s aria-label="%2$s"><p class="vulopilot-toc-title">%3$s</p>%4$s</nav>',
			$wrapper_attributes,
			esc_attr( $title ),
			esc_html( $title ),
			$list_html
		);
	}

	/**
	 * Real PHP mirror of `styleVars.js`'s own `buildTocStyleVars()` - same attribute → CSS custom
	 * property mapping `public/styles/blocks.scss`'s own `.vulopilot-toc` rules read
	 * (`var(--toc-*, <fallback>)`), so a style set in the editor renders identically on the live
	 * page. An unset/empty attribute is simply omitted, same as the JS side, so the stylesheet's
	 * own fallback value applies.
	 *
	 * @param array<string, mixed> $attributes Real block attributes.
	 * @return string A `--name: value;` CSS custom-property declaration list, or '' if nothing is set.
	 */
	private static function build_style_attribute( array $attributes ): string {
		$vars = array();

		$set = static function ( string $name, $value ) use ( &$vars ): void {
			if ( '' !== $value && null !== $value ) {
				$vars[ $name ] = $value;
			}
		};

		$set_box = static function ( string $prefix, $box ) use ( &$vars, $set ): void {
			if ( ! is_array( $box ) ) {
				return;
			}

			foreach ( array( 'top', 'right', 'bottom', 'left' ) as $side ) {
				if ( isset( $box[ $side ] ) ) {
					$set( "{$prefix}-{$side}", $box[ $side ] );
				}
			}
		};

		$set( '--toc-content-font-size', $attributes['contentFontSize'] ?? '' );
		$set( '--toc-content-color', $attributes['contentColor'] ?? '' );
		$set( '--toc-content-line-height', $attributes['contentLineHeight'] ?? null );
		$set( '--toc-content-list-style', $attributes['contentListStyle'] ?? '' );
		$set( '--toc-content-gap', $attributes['contentGap'] ?? '' );

		$set( '--toc-title-font-size', $attributes['titleFontSize'] ?? '' );
		$set( '--toc-title-color', $attributes['titleColor'] ?? '' );
		$set( '--toc-title-line-height', $attributes['titleLineHeight'] ?? null );
		$set_box( '--toc-title-padding', $attributes['titlePadding'] ?? null );
		$set_box( '--toc-title-margin', $attributes['titleMargin'] ?? null );

		$set( '--toc-section-background', $attributes['sectionBackground'] ?? '' );
		$set_box( '--toc-section-padding', $attributes['sectionPadding'] ?? null );
		$set_box( '--toc-section-margin', $attributes['sectionMargin'] ?? null );

		$declarations = array();

		foreach ( $vars as $name => $value ) {
			$declarations[] = sprintf( '%s:%s', $name, $value );
		}

		return implode( ';', $declarations );
	}

	/**
	 * @param array<int, array{level: int, text: string, anchor: string}> $headings Already level-filtered.
	 * @return string
	 */
	private static function build_list( array $headings ): string {
		$items = '';

		foreach ( $headings as $heading ) {
			$items .= sprintf(
				'<li class="vulopilot-toc-item vulopilot-toc-item--level-%1$d"><a href="#%2$s">%3$s</a></li>',
				$heading['level'],
				esc_attr( $heading['anchor'] ),
				wp_kses_post( $heading['text'] )
			);
		}

		return '<ul class="vulopilot-toc-list">' . $items . '</ul>';
	}
}
