<?php
namespace VuloPilot\SiteHealth;

use VuloPilot\Utill\Finding;
use VuloPilot\Utill\Severity;
use VuloPilot\Utill\ScannerUtil;

defined( 'ABSPATH' ) || exit;

/**
 * Same `WP_Site_Health`-wrapping approach WordPressHealthScanner uses.
 *
 * @class       ServerHealthScanner class
 * @version     1.0.0
 * @author      VuloLabs
 */
class ServerHealthScanner extends ScannerUtil {

	/**
	 * @inheritDoc
	 */
	public function get_id(): string {
		return 'server-health';
	}

	/**
	 * @inheritDoc
	 */
	public function get_label(): string {
		return __( 'Server', 'vulopilot' );
	}

	/**
	 * @inheritDoc
	 */
	public function get_category(): string {
		return 'server';
	}

	/**
	 * @inheritDoc
	 */
	public function scan(): array {
		$this->load_dependencies();

		$health   = \WP_Site_Health::get_instance();
		$findings = array();

		foreach ( array( 'get_test_php_version', 'get_test_sql_server' ) as $test_method ) {
			if ( ! method_exists( $health, $test_method ) ) {
				continue;
			}

			$finding = $this->finding_from_test_result( $health->$test_method() );

			if ( $finding ) {
				$findings[] = $finding;
			}
		}

		return $findings;
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

		if ( ! function_exists( 'wp_check_php_version' ) ) {
			require_once ABSPATH . 'wp-admin/includes/misc.php';
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
			wp_strip_all_tags( (string) ( $result['label'] ?? __( 'Server health check', 'vulopilot' ) ) ),
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
	 * Same real paragraph-recovery (and same `br`-within-a-paragraph handling)
	 * `WordPressHealthScanner`'s own `split_into_paragraphs()` documents.
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
