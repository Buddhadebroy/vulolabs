<?php
namespace VuloPilot\SeoVisibility;

use VuloPilot\Utill;

defined( 'ABSPATH' ) || exit;

/**
 * Settings → Site Identity → Title Formats' real backing.
 *
 * @class       TitleFormatter class
 * @version     1.0.0
 * @author      VuloLabs
 */
class TitleFormatter {

	/**
	 * `%variable%` token => resolver.
	 *
	 * @var array<string, callable>
	 */
	private const VARIABLES = array(
		'site_title'       => array( __CLASS__, 'var_site_title' ),
		'site_description' => array( __CLASS__, 'var_site_description' ),
		'post_title'       => array( __CLASS__, 'var_current_title' ),
		'page_title'       => array( __CLASS__, 'var_current_title' ),
		'category_title'   => array( __CLASS__, 'var_current_title' ),
		'tag_title'        => array( __CLASS__, 'var_current_title' ),
		'search_term'      => array( __CLASS__, 'var_search_term' ),
		'archive_title'    => array( __CLASS__, 'var_current_title' ),
	);

	/**
	 * TitleFormatter constructor.
	 */
	public function __construct() {
		add_filter( 'pre_get_document_title', array( $this, 'maybe_filter_title' ), 5 );
		add_action( 'wp_head', array( $this, 'maybe_output_description' ), 5 );
	}

	/**
	 * @param string $title Core's own already-resolved title (unused - this
	 *                       either replaces it wholesale or returns it untouched).
	 * @return string
	 */
	public function maybe_filter_title( string $title ): string {
		$settings = wp_parse_args( get_option( Utill::VULOPILOT_SETTINGS_KEY, array() ), Utill::VULOPILOT_SETTINGS_DEFAULTS );

		if ( empty( $settings['site_identity_enabled'] ) || 'enabled' !== $settings['site_identity_enabled'] ) {
			return $title;
		}

		$context_key = $this->current_context_key();

		if ( ! $context_key ) {
			return $title; // 404s and any other context this feature doesn't cover - leave core's own title alone.
		}

		$template = trim( (string) ( $settings[ "title_format_{$context_key}" ] ?? '' ) );

		if ( '' === $template ) {
			return $title;
		}

		$resolved = $this->resolve( $template, $context_key, (string) ( $settings['title_separator'] ?? '|' ) );

		return '' !== $resolved ? $resolved : $title;
	}

	/**
	 * Outputs `meta` on `wp_head`, same setting-gated/context-scoped
	 * posture as `maybe_filter_title()` above.
	 *
	 * @return void
	 */
	public function maybe_output_description(): void {
		$settings = wp_parse_args( get_option( Utill::VULOPILOT_SETTINGS_KEY, array() ), Utill::VULOPILOT_SETTINGS_DEFAULTS );

		if ( empty( $settings['site_identity_enabled'] ) || 'enabled' !== $settings['site_identity_enabled'] ) {
			return;
		}

		$context_key = $this->current_context_key();

		if ( ! $context_key ) {
			return;
		}

		$content = '';

		if ( in_array( $context_key, array( 'post', 'page' ), true ) ) {
			$excerpt = trim( wp_strip_all_tags( get_the_excerpt() ) );

			if ( '' !== $excerpt ) {
				$content = $excerpt;
			}
		}

		if ( '' === $content ) {
			$template = trim( (string) ( $settings[ "description_format_{$context_key}" ] ?? '' ) );

			if ( '' !== $template ) {
				$content = $this->resolve( $template, $context_key, (string) ( $settings['title_separator'] ?? '|' ) );
			}
		}

		if ( '' === $content ) {
			return;
		}

		echo '<meta name="description" content="' . esc_attr( $content ) . '" />' . "\n";
	}

	/**
	 * Resolves a template string against one context's own variable set.
	 *
	 * @param string $template   Raw template, e.g. `%post_title% %sep% %site_title%`.
	 * @param string $context    One of `home`/`post`/`page`/`category`/`tag`/`search`/`archive`.
	 * @param string $separator  What `%sep%` itself resolves to.
	 * @return string
	 */
	public function resolve( string $template, string $context, string $separator ): string {
		$replacements = array( '%sep%' => $separator );

		foreach ( self::VARIABLES as $token => $resolver ) {
			$replacements[ "%{$token}%" ] = call_user_func( $resolver, $token, $context );
		}

		$resolved = strtr( $template, $replacements );

		// Collapse the empty-separator runs a template produces when one of its own tokens resolves
		// empty in this context (e.g. `%site_description%` when the site tagline is blank).
		$resolved = preg_replace( '/\s*' . preg_quote( $separator, '/' ) . '\s*$/', '', $resolved );
		$resolved = preg_replace( '/^\s*' . preg_quote( $separator, '/' ) . '\s*/', '', $resolved );

		return trim( (string) $resolved );
	}

	/**
	 * @return string|null One of home/post/page/category/tag/search/archive, or null for anything else (404, embeds, ...).
	 */
	private function current_context_key(): ?string {
		if ( is_front_page() || is_home() ) {
			return 'home';
		}

		if ( is_search() ) {
			return 'search';
		}

		if ( is_category() ) {
			return 'category';
		}

		if ( is_tag() ) {
			return 'tag';
		}

		if ( is_page() ) {
			return 'page';
		}

		if ( is_singular() ) {
			return 'post';
		}

		if ( is_archive() ) {
			return 'archive';
		}

		return null;
	}

	/**
	 * @return string
	 */
	private static function var_site_title(): string {
		return get_bloginfo( 'name' );
	}

	/**
	 * @return string
	 */
	private static function var_site_description(): string {
		return get_bloginfo( 'description' );
	}

	/**
	 * `%post_title%`/`%page_title%`/`%category_title%`/`%tag_title%`/ `%archive_title%`
	 * all resolve the same way.
	 *
	 * @return string
	 */
	private static function var_current_title(): string {
		if ( is_category() || is_tag() ) {
			return single_term_title( '', false ) ? single_term_title( '', false ) : '';
		}

		if ( is_archive() ) {
			return wp_strip_all_tags( get_the_archive_title() );
		}

		return get_the_title();
	}

	/**
	 * @return string
	 */
	private static function var_search_term(): string {
		return get_search_query();
	}
}
