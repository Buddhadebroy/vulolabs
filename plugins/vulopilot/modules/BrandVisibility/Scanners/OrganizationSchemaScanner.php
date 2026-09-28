<?php
/**
 * OrganizationSchemaScanner class file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\BrandVisibility\Scanners;

use VuloPilot\Utill\Finding;
use VuloPilot\Utill\Severity;
use VuloPilot\Utill\ScannerUtil;

defined( 'ABSPATH' ) || exit;

/**
 * Fetches the live homepage and checks it has an `Organization` or `LocalBusiness` schema,
 * including one added by a theme or another plugin.
 *
 * @class       OrganizationSchemaScanner class
 * @version     1.0.0
 * @author      VuloLabs
 */
class OrganizationSchemaScanner extends ScannerUtil {

	private const REQUEST_TIMEOUT_SECONDS = 8;

	/**
	 * @inheritDoc
	 */
	public function get_id(): string {
		return 'organization-schema';
	}

	/**
	 * @inheritDoc
	 */
	public function get_label(): string {
		return __( 'Organization Schema', 'vulopilot' );
	}

	/**
	 * @inheritDoc
	 */
	public function get_category(): string {
		return 'brand';
	}

	/**
	 * @inheritDoc
	 */
	public function scan(): array {
		$settings = wp_parse_args( get_option( \VuloPilot\Utill::VULOPILOT_SETTINGS_KEY, array() ), \VuloPilot\Utill::VULOPILOT_SETTINGS_DEFAULTS );

		if ( empty( $settings['flag_missing_schema'] ) ) {
			return array();
		}

		$response = wp_remote_get(
			home_url( '/' ),
			array(
				'timeout'   => self::REQUEST_TIMEOUT_SECONDS,
				'sslverify' => false,
			)
		);

		if ( is_wp_error( $response ) || 200 !== (int) wp_remote_retrieve_response_code( $response ) ) {
			return array();
		}

		if ( $this->has_organization_schema( wp_remote_retrieve_body( $response ) ) ) {
			return array();
		}

		return array(
			new Finding(
				__( 'No Organization schema found on the homepage', 'vulopilot' ),
				Severity::MEDIUM,
				$this->get_category(),
				__( 'Organization (or LocalBusiness) structured data is what AI answer engines and Google Knowledge Panels use to resolve "who runs this site" as a real-world entity. Its absence makes this site harder to confidently identify and cite.', 'vulopilot' ),
				'url',
				home_url( '/' )
			),
		);
	}

	/**
	 * @param string $html Fetched homepage HTML.
	 * @return bool
	 */
	private function has_organization_schema( string $html ): bool {
		return 1 === preg_match( '/"@type"\s*:\s*"(Organization|LocalBusiness)"/i', $html );
	}
}
