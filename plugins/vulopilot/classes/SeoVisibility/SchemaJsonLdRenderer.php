<?php
namespace VuloPilot\SeoVisibility;


defined( 'ABSPATH' ) || exit;

/**
 * No settings gate - unlike SitemapManager/RobotsTxtManager (which decide
 * whether to generate something site-wide), this only ever outputs
 * something a site owner (or an approved AI action) already explicitly
 * created for one specific post; there's nothing to output until that
 * postmeta exists.
 *
 * Self-registers its own hook in the constructor (php-wordpress.md) and
 * is constructed unconditionally in VuloPilot::init_classes().
 *
 * @class       SchemaJsonLdRenderer class
 * @version     1.0.0
 * @author      VuloLabs
 */
class SchemaJsonLdRenderer {

    /**
     * Must match GenerateSchemaAction::META_KEY.
     */
    private const META_KEY = '_vulopilot_schema_json';

    /**
     * SchemaJsonLdRenderer constructor.
     */
    public function __construct() {
        add_action( 'wp_head', array( $this, 'maybe_output_schema' ) );
    }

    /**
     * @return void
     */
    public function maybe_output_schema(): void {
        if ( ! is_singular() ) {
            return;
        }

        $schema_json = get_post_meta( get_queried_object_id(), self::META_KEY, true );

        if ( '' === $schema_json || ! is_string( $schema_json ) ) {
            return;
        }

        $decoded = json_decode( $schema_json, true );

        if ( ! is_array( $decoded ) ) {
            return; // Malformed/edited-outside-the-action value - don't output invalid JSON-LD.
        }

        wp_print_inline_script_tag( (string) wp_json_encode( $decoded ), array( 'type' => 'application/ld+json' ) );
    }
}
