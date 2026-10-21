<?php
/**
 * Settings class file.
 *
 * @package VuloCart
 */

namespace VuloCart\RestAPI\Controllers;

use VuloCart\Utill;

defined( 'ABSPATH' ) || exit;

/**
 * VuloCart Settings REST controller.
 *
 * `GET`/`POST /vulocart/v1/settings` backs src/pages/Settings/Settings.tsx,
 * built on zyra's real settings framework (`InputRenderer`/
 * `NavigatorComponent`, `getAvailableSettings`/`getSettingById` from
 * `@zyra/core`) - mirrors `VuloPilot\RestAPI\Controllers\Settings`'s
 * flat-option shape (a single `wp_options` row, `Utill::SETTINGS_KEY`),
 * not a per-tab-namespaced `admin_settings` variant, since
 * VuloCart has exactly one settings tab so far.
 *
 * `update_item()` **merges** the `{ setting, settingName }` subset
 * `InputRenderer` actually auto-saves into the existing option rather
 * than replacing it wholesale - with only one tab today a wholesale
 * replace would happen to be equivalent, but merging is what stays
 * correct the moment a second tab exists, and matches every sibling
 * Settings controller's own documented reasoning for doing the same.
 *
 * @class       Settings class
 * @version     1.0.0
 * @author      VuloLabs
 */
class Settings extends \WP_REST_Controller {

    /**
     * REST base for this controller's routes.
     *
     * @var string
     */
    protected $rest_base = 'settings';

    /**
     * Registers this controller's REST routes.
     *
     * @return void
     */
    public function register_routes() {
        register_rest_route(
            VuloCart()->rest_namespace,
            '/' . $this->rest_base,
            array(
                array(
                    'methods'             => \WP_REST_Server::READABLE,
                    'callback'            => array( $this, 'get_items' ),
                    'permission_callback' => array( $this, 'permissions_check' ),
                ),
                array(
                    'methods'             => \WP_REST_Server::EDITABLE,
                    'callback'            => array( $this, 'update_item' ),
                    'permission_callback' => array( $this, 'permissions_check' ),
                ),
            )
        );
    }

    /**
     * Checks whether the current user can view/edit settings.
     *
     * @param \WP_REST_Request $request Full request object.
     * @return bool
     */
    public function permissions_check( $request ) { // phpcs:ignore Generic.CodeAnalysis.UnusedFunctionParameter.Found
        return current_user_can( 'manage_options' );
    }

    /**
     * Returns the stored settings, merged over the defaults.
     *
     * @param \WP_REST_Request $request Full request object.
     * @return \WP_REST_Response
     */
    public function get_items( $request ) { // phpcs:ignore Generic.CodeAnalysis.UnusedFunctionParameter.Found
        $settings = $this->get_stored_settings();

        // Customer and Payment are always part of checkout; a stored list (disabled boxes are never posted back) may
        // lack them, which would draw those two boxes unticked.
        if ( isset( $settings['checkout_steps'] ) && is_array( $settings['checkout_steps'] ) ) {
            $settings['checkout_steps'] = array_values( array_unique( array_merge( array( 'customer' ), $settings['checkout_steps'], array( 'payment' ) ) ) );
        }

        return rest_ensure_response( $settings );
    }

    /**
     * Merges the posted field subset into the stored settings.
     *
     * @param \WP_REST_Request $request Full request object.
     * @return \WP_REST_Response
     */
    public function update_item( $request ) {
        $fields = $request->get_param( 'setting' );

        // Fall back to treating the whole body as the field set when no
        // `setting` wrapper is present (a direct API call rather than
        // InputRenderer's own auto-save) - still merged, never a
        // wholesale replace either way.
        if ( ! is_array( $fields ) ) {
            $fields = $request->get_json_params();
        }

        if ( ! is_array( $fields ) ) {
            $fields = array();
        }

        $sanitized = array();

        foreach ( $fields as $key => $value ) {
            $sanitized[ sanitize_key( (string) $key ) ] = $this->sanitize_field_value( $value );
        }

        $updated = array_merge( $this->get_stored_settings(), $sanitized );

        update_option( Utill::SETTINGS_KEY, $updated );

        /**
         * Fires after the settings were saved, so a plugin can react (VuloCart Pro keeps its modules in step with them).
         *
         * @param array $updated The full stored settings.
         */
        do_action( 'vulocart_settings_updated', $updated );

        return rest_ensure_response(
            array(
                'success' => true,
                'message' => __( 'Settings saved.', 'vulocart' ),
            )
        );
    }

    /**
     * Sanitizes one posted field value, array-aware.
     *
     * `type: 'checkbox', look: 'toggle'` fields (src/settings/*.ts) post an
     * array (zyra's MultiCheckboxInput - the selected option's own value
     * when on, `[]` when off; Utill::SETTINGS_DEFAULTS' docblock explains
     * why this isn't a literal bool). Casting an array straight to string
     * (the previous, scalar-only version of this method) silently
     * corrupted every toggle field into the literal string `"Array"` on
     * first save - caught live via a real save/reload round trip on the
     * Email/MCP tabs.
     *
     * @param mixed $value Raw posted value for one field.
     * @return string|string[]
     */
    private function sanitize_field_value( $value ) {
        if ( is_array( $value ) ) {
            return array_values( array_map( 'sanitize_text_field', array_map( 'strval', $value ) ) );
        }

        return sanitize_text_field( (string) $value );
    }

    /**
     * Returns the stored settings option, defaults filled in.
     *
     * @return array Stored settings, defaults filled in for any never-saved key.
     */
    private function get_stored_settings(): array {
        $saved = get_option( Utill::SETTINGS_KEY, array() );

        return wp_parse_args( is_array( $saved ) ? $saved : array(), Utill::SETTINGS_DEFAULTS );
    }
}
