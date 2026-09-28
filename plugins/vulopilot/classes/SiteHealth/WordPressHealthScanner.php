<?php
namespace VuloPilot\SiteHealth;

use VuloPilot\Utill\Finding;
use VuloPilot\Utill\Severity;
use VuloPilot\Utill\ScannerUtil;

defined( 'ABSPATH' ) || exit;

/**
 * Wraps 3 of WordPress core's own `WP_Site_Health` tests - the same class and same cached
 * results Tools → Site Health already computes.
 *
 * @class       WordPressHealthScanner class
 * @version     1.0.0
 * @author      VuloLabs
 */
class WordPressHealthScanner extends ScannerUtil {

	/**
	 * @inheritDoc
	 */
	public function get_id(): string {
		return 'wordpress-health';
	}

	/**
	 * @inheritDoc
	 */
	public function get_label(): string {
		return __( 'WordPress', 'vulopilot' );
	}

	/**
	 * @inheritDoc
	 */
	public function get_category(): string {
		return 'WordPress';
	}

	/**
	 * @inheritDoc
	 */
	public function scan(): array {
		$this->load_dependencies();

		$health   = \WP_Site_Health::get_instance();
		$findings = array();

		foreach ( array( 'get_test_wordpress_version', 'get_test_https_status', 'get_test_rest_availability' ) as $test_method ) {
			if ( ! method_exists( $health, $test_method ) ) {
				continue;
			}

			$finding = $this->finding_from_test_result( $health->$test_method() );

			if ( $finding ) {
				$findings[] = $finding;
			}
		}

		$inactive_plugins_finding = $this->check_inactive_plugins();

		if ( $inactive_plugins_finding ) {
			$findings[] = $inactive_plugins_finding;
		}

		return $findings;
	}

	/**
	 * Flags installed but deactivated plugins, which remain on disk as an attack surface.
	 * Core Site Health only lists them.
	 *
	 * @return Finding|null Null when there are no inactive plugins.
	 */
	private function check_inactive_plugins(): ?Finding {
		if ( ! function_exists( 'get_plugins' ) ) {
			require_once ABSPATH . 'wp-admin/includes/plugin.php';
		}

		$all_plugins    = get_plugins();
		$active_plugins = (array) get_option( 'active_plugins', array() );
		$inactive_names = array();
		$inactive_files = array();

		foreach ( $all_plugins as $plugin_file => $plugin_data ) {
			if ( in_array( $plugin_file, $active_plugins, true ) ) {
				continue;
			}

			$inactive_names[] = $plugin_data['Name']; // phpcs:ignore WordPress.NamingConventions.ValidVariableName.UsedPropertyNotSnakeCase -- get_plugins()'s own array key, not ours to rename.
			$inactive_files[] = $plugin_file;
		}

		if ( empty( $inactive_names ) ) {
			return null;
		}

		$count = count( $inactive_names );

		return new Finding(
			sprintf(
				/* translators: %d is how many installed plugins are currently deactivated. */
				_n(
					'%d inactive plugin installed',
					'%d inactive plugins installed',
					$count,
					'vulopilot'
				),
				$count
			),
			Severity::LOW,
			$this->get_category(),
			sprintf(
				/* translators: %s is a comma-separated list of inactive plugin names. */
				__( 'Deactivated plugins are still real files on disk and still a real attack surface if one has a known vulnerability, even while not running. Review and remove what you no longer use: %s.', 'vulopilot' ),
				implode( ', ', $inactive_names )
			),
			'wordpress_inactive_plugins',
			null,
			array(
				'inactive_plugins'      => $inactive_names,
				'inactive_plugin_files' => $inactive_files,
			),
			// The title's own count legitimately fluctuates scan to scan (a plugin gets
			// deactivated/deleted).
			'wordpress_inactive_plugins'
		);
	}

	/**
	 * `WP_Site_Health` itself is only autoloaded in wp-admin.
	 *
	 * @return void
	 */
	private function load_dependencies(): void {
		if ( ! class_exists( '\WP_Site_Health' ) ) {
			require_once ABSPATH . 'wp-admin/includes/class-wp-site-health.php';
		}

		if ( ! function_exists( 'get_core_updates' ) ) {
			require_once ABSPATH . 'wp-admin/includes/update.php';
		}
	}

	/**
	 * @param array $result A `WP_Site_Health::get_test_*()` return value.
	 * @return Finding|null Null when the test's own status is 'good'.
	 */
	private function finding_from_test_result( array $result ): ?Finding {
		$status = $result['status'] ?? 'good';

		if ( 'good' === $status ) {
			return null;
		}

		$description = (string) ( $result['description'] ?? '' );
		$paragraphs  = $this->split_into_paragraphs( $description );

		return new Finding(
			wp_strip_all_tags( (string) ( $result['label'] ?? __( 'WordPress health check', 'vulopilot' ) ) ),
			'critical' === $status ? Severity::HIGH : Severity::MEDIUM,
			$this->get_category(),
			wp_strip_all_tags( $description ),
			'site_health_test',
			(string) ( $result['test'] ?? '' ),
			count( $paragraphs ) >= 2
				? array(
					'why_it_matters' => $paragraphs[0],
					'what_happened'  => implode( ' ', array_slice( $paragraphs, 1 ) ),
				)
				: array()
		);
	}

	/**
	 * `WP_Site_Health`'s own test descriptions are built from separate real HTML `p`
	 * blocks (confirmed by reading `WP_Site_Health`'s own core source).
	 *
	 * @param string $html_description Raw HTML `description` from a `WP_Site_Health` test result.
	 * @return array<int, string> Plain-text paragraphs, in order, empty ones dropped.
	 */
	private function split_into_paragraphs( string $html_description ): array {
		$chunks = preg_split( '/<\/p>\s*/i', $html_description ) ? preg_split( '/<\/p>\s*/i', $html_description ) : array();

		return array_values(
			array_filter(
				array_map(
					static fn( string $chunk ): string => trim(
						wp_strip_all_tags( preg_replace( '/<br\s*\/?>/i', ' - ', $chunk ) ?? $chunk )
					),
					$chunks
				),
				static fn( string $paragraph ): bool => '' !== $paragraph
			)
		);
	}
}
