<?php
namespace VuloPilot\SeoVisibility;

use VuloPilot\Utill;

defined( 'ABSPATH' ) || exit;

/**
 * Scanning → SEO's "Auto-generate robots.txt" toggle, plus Crawl & URLs → Robots &
 * Sitemap's own "Edit" action (RobotsSitemap).
 *
 * @class       RobotsTxtManager class
 * @version     1.0.0
 * @author      VuloLabs
 */
class RobotsTxtManager {

	/**
	 * Admin-authored robots.txt override; empty/absent falls back to WordPress's default output.
	 */
	private const CUSTOM_CONTENT_OPTION = 'vulopilot_custom_robots_txt';

	/**
	 * RobotsTxtManager constructor.
	 */
	public function __construct() {
		add_filter( 'robots_txt', array( $this, 'maybe_use_custom_robots_txt' ), 5, 1 );
		add_filter( 'robots_txt', array( $this, 'maybe_strip_admin_ajax_allow' ), 15, 1 );
		add_filter( 'robots_txt', array( $this, 'maybe_append_sitemap_line' ), 20, 2 );
	}

	/**
	 * Core's own `do_robots()` always adds `Allow: /wp-admin/admin-ajax.php` under the `Disallow: /wp-admin/` block it generates.
	 *
	 * @param string $output The robots.txt content built so far.
	 * @return string
	 */
	public function maybe_strip_admin_ajax_allow( $output ) {
		$settings = wp_parse_args( get_option( Utill::VULOPILOT_SETTINGS_KEY, array() ), Utill::VULOPILOT_SETTINGS_DEFAULTS );

		if ( empty( $settings['robots_auto_generate'] ) || '' !== $this->get_custom_content() ) {
			return $output;
		}

		return trim( preg_replace( '/^Allow: \/wp-admin\/admin-ajax\.php\R?/m', '', $output ) );
	}

	/**
	 * @param string $output The robots.txt content built so far.
	 * @return string
	 */
	public function maybe_use_custom_robots_txt( $output ) {
		$custom = $this->get_custom_content();

		return '' !== $custom ? $custom : $output;
	}

	/**
	 * @param string $output       The robots.txt content built so far.
	 * @param bool   $is_public    Whether the site is set to be publicly indexed.
	 * @return string
	 */
	public function maybe_append_sitemap_line( $output, $is_public ) {
		$settings = wp_parse_args( get_option( Utill::VULOPILOT_SETTINGS_KEY, array() ), Utill::VULOPILOT_SETTINGS_DEFAULTS );

		if ( empty( $settings['robots_auto_generate'] ) || empty( $settings['sitemap_enabled'] ) || ! $is_public ) {
			return $output;
		}

		if ( false !== strpos( $output, 'Sitemap:' ) ) {
			return $output; // Another plugin/theme (or the real custom override above) already added one - don't duplicate.
		}

		return rtrim( $output ) . "\nSitemap: " . VuloPilot()->sitemap_url_rewriter->get_index_url() . "\n";
	}

	/**
	 * @return string Real saved override content, or '' when none is set.
	 */
	public function get_custom_content(): string {
		return (string) get_option( self::CUSTOM_CONTENT_OPTION, '' );
	}

	/**
	 * @param string $content New override content; '' clears it.
	 * @return void
	 */
	public function save_custom_content( string $content ): void {
		if ( '' === $content ) {
			delete_option( self::CUSTOM_CONTENT_OPTION );
			return;
		}

		update_option( self::CUSTOM_CONTENT_OPTION, $content, false );
	}
}
