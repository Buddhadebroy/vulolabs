<?php
/**
 * LlmsTxtGenerator class file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\GeoAnalysis;

defined( 'ABSPATH' ) || exit;

/**
 * Serves a virtual `/llms.txt`, a Markdown index of the site's key pages for AI systems.
 *
 * @class       LlmsTxtGenerator class
 * @version     1.0.0
 * @author      VuloLabs
 */
class LlmsTxtGenerator {

	private const QUERY_VAR = 'vulopilot_llms_txt';

	/**
	 * Max pages/posts listed in each section - a curated index.
	 */
	private const MAX_ITEMS_PER_SECTION = 20;

	/**
	 * LlmsTxtGenerator constructor.
	 */
	public function __construct() {
		add_action( 'init', array( $this, 'register_rewrite_rule' ) );
		add_filter( 'query_vars', array( $this, 'add_query_var' ) );
		add_action( 'template_redirect', array( $this, 'maybe_serve' ) );
		add_action( 'init', array( $this, 'maybe_bootstrap_physical_file' ), 20 );
	}

	/**
	 * @return void
	 */
	public function register_rewrite_rule(): void {
		add_rewrite_rule( '^llms\.txt$', 'index.php?' . self::QUERY_VAR . '=1', 'top' );
	}

	/**
	 * @param string[] $vars Existing public query vars.
	 * @return string[]
	 */
	public function add_query_var( array $vars ): array {
		$vars[] = self::QUERY_VAR;
		return $vars;
	}

	/**
	 * @return void
	 */
	public function maybe_serve(): void {
		if ( ! get_query_var( self::QUERY_VAR ) ) {
			return;
		}

		$settings = wp_parse_args( get_option( \VuloPilot\Utill::VULOPILOT_SETTINGS_KEY, array() ), \VuloPilot\Utill::VULOPILOT_SETTINGS_DEFAULTS );

		if ( empty( $settings['enable_llms_txt'] ) ) {
			return;
		}

		// Prefer an admin's saved edits over the auto-generated version.
		$file_path = trailingslashit( ABSPATH ) . 'llms.txt';

		if ( ! file_exists( $file_path ) ) {
			$this->write_file( empty( $settings['llms_txt_content'] ) ? $this->generate() : $settings['llms_txt_content'] );
		}

		if ( ! file_exists( $file_path ) ) {
			return;
		}

		header( 'Content-Type: text/plain; charset=utf-8' );
		header( 'X-Content-Type-Options: nosniff' );
		readfile( $file_path ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_readfile -- streams this plugin's own llms.txt.
		exit;
	}

	/**
	 * Writes content to /llms.txt at the site root.
	 *
	 * @param string $content Content to persist.
	 * @return bool True if the file was written.
	 */
	public function write_file( string $content ): bool {
		if ( ! wp_is_writable( ABSPATH ) ) {
			return false;
		}

		$file_path = trailingslashit( ABSPATH ) . 'llms.txt';

        // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_file_put_contents, PluginCheck.CodeAnalysis.WriteFile.ABSPATHDetected -- llms.txt is a site-root convention file (same as robots.txt/ads.txt), not wp_upload_dir()-appropriate; a virtual-route fallback also exists above for hosts where ABSPATH isn't writable. Not a value that needs WP_Filesystem's FTP-credential fallback either; matches the existing precedent in Reports/Exporters/JsonExporter.php.
		return false !== file_put_contents( $file_path, $content );
	}

	/**
	 * Bootstraps /llms.txt on disk the first time it's missing.
	 *
	 * @return void
	 */
	public function maybe_bootstrap_physical_file(): void {
		$settings = wp_parse_args( get_option( \VuloPilot\Utill::VULOPILOT_SETTINGS_KEY, array() ), \VuloPilot\Utill::VULOPILOT_SETTINGS_DEFAULTS );

		if ( empty( $settings['enable_llms_txt'] ) ) {
			return;
		}

		if ( file_exists( trailingslashit( ABSPATH ) . 'llms.txt' ) ) {
			return;
		}

		$this->write_file( empty( $settings['llms_txt_content'] ) ? $this->generate() : $settings['llms_txt_content'] );
	}

	/**
	 * Builds the auto-generated llms.txt content from live WP_Query data.
	 *
	 * @return string
	 */
	public function generate(): string {
		$settings      = wp_parse_args( get_option( \VuloPilot\Utill::VULOPILOT_SETTINGS_KEY, array() ), \VuloPilot\Utill::VULOPILOT_SETTINGS_DEFAULTS );
		$include_types = (array) ( $settings['llms_include_types'] ?? array( 'pages', 'posts' ) );

		$lines = array(
			'# ' . get_bloginfo( 'name' ),
			'',
			'> ' . get_bloginfo( 'description' ),
			'',
		);

		if ( in_array( 'pages', $include_types, true ) ) {
			$this->append_section( $lines, __( 'Pages', 'vulopilot' ), 'page', 'menu_order', 'ASC' );
		}

		if ( in_array( 'posts', $include_types, true ) ) {
			$this->append_section( $lines, __( 'Posts', 'vulopilot' ), 'post', 'date', 'DESC' );
		}

		if ( in_array( 'products', $include_types, true ) && post_type_exists( 'product' ) ) {
			$this->append_section( $lines, __( 'Products', 'vulopilot' ), 'product', 'date', 'DESC' );
		}

		return implode( "\n", $lines );
	}

	/**
	 * Appends one `## Heading` + list-of-links section for one post type.
	 *
	 * @param string[] $lines   Lines built so far, appended to by reference.
	 * @param string   $heading Markdown heading text (no leading `##`).
	 * @param string   $post_type WordPress post type to query.
	 * @param string   $orderby WP_Query orderby.
	 * @param string   $order   WP_Query order.
	 * @return void
	 */
	private function append_section( array &$lines, string $heading, string $post_type, string $orderby, string $order ): void {
		$items = get_posts(
			array(
				'post_type'      => $post_type,
				'post_status'    => 'publish',
				'posts_per_page' => self::MAX_ITEMS_PER_SECTION,
				'orderby'        => $orderby,
				'order'          => $order,
			)
		);

		if ( ! $items ) {
			return;
		}

		$lines[] = '## ' . $heading;
		$lines[] = '';

		foreach ( $items as $item ) {
			$lines[] = sprintf( '- [%s](%s)', get_the_title( $item ), get_permalink( $item ) );
		}

		$lines[] = '';
	}
}
