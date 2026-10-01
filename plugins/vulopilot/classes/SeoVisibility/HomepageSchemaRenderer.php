<?php
namespace VuloPilot\SeoVisibility;

defined( 'ABSPATH' ) || exit;

/**
 * Outputs the saved homepage schema as JSON-LD.
 *
 * @class       HomepageSchemaRenderer class
 * @version     1.0.0
 * @author      VuloLabs
 */
class HomepageSchemaRenderer {

	/**
	 * HomepageSchemaRenderer constructor.
	 */
	public function __construct() {
		add_action( 'wp_head', array( $this, 'maybe_output_schema' ) );
	}

	/**
	 * Outputs the stored homepage schema as JSON-LD, if the front page and set.
	 *
	 * @return void
	 */
	public function maybe_output_schema(): void {
		if ( ! is_front_page() ) {
			return;
		}

		$schema_json = get_option( 'vulopilot_homepage_schema_json', '' );

		if ( '' === $schema_json ) {
			return;
		}

		$decoded = json_decode( (string) $schema_json, true );

		if ( ! is_array( $decoded ) ) {
			return;
		}

		wp_print_inline_script_tag( (string) wp_json_encode( $decoded ), array( 'type' => 'application/ld+json' ) );
	}
}
