<?php
namespace VuloPilot\SeoVisibility;

use VuloPilot\TechnicalSeo\Scanners\StructuredDataValidationScanner;

defined( 'ABSPATH' ) || exit;

/**
 * No settings gate: like SchemaJsonLdRenderer, there's nothing to output
 * until the option actually has content, so construction is unconditional
 * and the hook is a no-op until then. Runs alongside SchemaJsonLdRenderer
 * without conflict - a static front page can legitimately have both its
 * own per-post schema (e.g. Article) AND this sitewide WebSite schema
 * output at once; multiple JSON-LD blocks per page is normal.
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
