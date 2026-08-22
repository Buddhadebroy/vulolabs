<?php
/**
 * Settings controller file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\RestAPI\Controllers;

use VuloPilot\Utill;
use VuloPilot\Services\EntityExtractor;
use VuloPilot\Services\SchemaCoverageAnalyzer;
use VuloPilot\Services\RobotsTxtBotAccess;

defined( 'ABSPATH' ) || exit;

/**
 * GET/POST /settings backs src/pages/Settings/Settings.tsx, now built on
 * zyra's real settings framework (`InputRenderer`/`NavigatorComponent`,
 * `getAvailableSettings`/`getSettingById` from zyra's core module — see the
 * free vulolabs plugin's own `components/Settings/Settings.tsx` for the
 * pattern this mirrors). `InputRenderer` auto-saves each tab's fields as
 * `{ setting, settingName }` — a SUBSET of the full settings object, not
 * the whole thing — so update_item() merges into the existing stored
 * option rather than replacing it wholesale (the previous version's
 * `update_option()` call replaced the *entire* option with only the 2
 * keys it knew about, which would have silently wiped every other tab's
 * values the moment a second tab existed).
 *
 * Reads/writes a single wp_options row (Utill::VULOPILOT_SETTINGS_KEY),
 * not a custom table — see Utill::VULOPILOT_SETTINGS_DEFAULTS's docblock
 * for why. Also backs the Import/Export/Reset tab (a hand-built panel,
 * not an InputRenderer-driven one — see Settings.tsx's own docblock for
 * why those three actions don't fit the auto-save field pattern).
 *
 * No per-field type/sanitization allowlist here — matches the sibling
 * free plugins' own Settings controllers (vulolabs/catalogx/moowoodle,
 * see their own RestAPI/Controllers/Settings.php), which likewise store
 * whatever `{ setting }` the client sends with no server-side field-type
 * validation. The only thing this class still does beyond that baseline
 * is merge into the existing option rather than replace it outright,
 * which is a consequence of the single-flat-option storage above, not a
 * sanitization layer.
 *
 * @class       Settings controller
 * @version     1.0.0
 * @author      VuloLabs
 */
class Settings extends \WP_REST_Controller {

    /**
     * @var string
     */
    protected $rest_base = 'settings';

    /**
     * @var string
     */
    protected $modules_base = 'modules';

    /**
     * @inheritDoc
     */
    public function register_routes() {
        register_rest_route(
            VuloPilot()->rest_namespace,
            '/' . $this->rest_base,
            array(
                array(
                    'methods'             => \WP_REST_Server::READABLE,
                    'callback'            => array( $this, 'get_items' ),
                    'permission_callback' => array( $this, 'get_items_permissions_check' ),
                ),
                array(
                    'methods'             => \WP_REST_Server::EDITABLE,
                    'callback'            => array( $this, 'update_item' ),
                    'permission_callback' => array( $this, 'update_item_permissions_check' ),
                ),
            )
        );

        register_rest_route(
            VuloPilot()->rest_namespace,
            '/' . $this->rest_base . '/export',
            array(
                array(
                    'methods'             => \WP_REST_Server::READABLE,
                    'callback'            => array( $this, 'export_settings' ),
                    'permission_callback' => array( $this, 'get_items_permissions_check' ),
                ),
            )
        );

        register_rest_route(
            VuloPilot()->rest_namespace,
            '/' . $this->rest_base . '/import',
            array(
                array(
                    'methods'             => \WP_REST_Server::CREATABLE,
                    'callback'            => array( $this, 'import_settings' ),
                    'permission_callback' => array( $this, 'update_item_permissions_check' ),
                ),
            )
        );

        register_rest_route(
            VuloPilot()->rest_namespace,
            '/' . $this->rest_base . '/reset',
            array(
                array(
                    'methods'             => \WP_REST_Server::CREATABLE,
                    'callback'            => array( $this, 'reset_settings' ),
                    'permission_callback' => array( $this, 'update_item_permissions_check' ),
                ),
            )
        );

        // Settings → Developer Tools' "Clear cache" — same
        // `type: 'button'` + `apilink` shape as /reset above, its own
        // dedicated route since it does something conceptually different
        // (clearing transient caches, not touching stored setting values).
        register_rest_route(
            VuloPilot()->rest_namespace,
            '/' . $this->rest_base . '/clear-cache',
            array(
                array(
                    'methods'             => \WP_REST_Server::CREATABLE,
                    'callback'            => array( $this, 'clear_cache' ),
                    'permission_callback' => array( $this, 'update_item_permissions_check' ),
                ),
            )
        );

        // "Send test email" button (Settings → Notifications) — same
        // `type: 'button'` + `apilink` shape zyra's ButtonInputFieldComponent
        // already POSTs through for reset_settings above, just its own
        // dedicated route rather than overloading /reset.
        register_rest_route(
            VuloPilot()->rest_namespace,
            '/' . $this->rest_base . '/test-email',
            array(
                array(
                    'methods'             => \WP_REST_Server::CREATABLE,
                    'callback'            => array( $this, 'send_test_email' ),
                    'permission_callback' => array( $this, 'update_item_permissions_check' ),
                ),
            )
        );

        // "Send Test Alert" (Notifications → AI Crawler Alerts) — same
        // shape as /test-email above. The real check/send logic lives in
        // vulopilot-pro's CrawlerAlertMonitor (that whole feature is
        // Pro-only), so this route only fires the `vulopilot_send_test_crawler_alert`
        // filter and passes its result straight through — see
        // send_test_crawler_alert()'s own docblock.
        register_rest_route(
            VuloPilot()->rest_namespace,
            '/' . $this->rest_base . '/test-crawler-alert',
            array(
                array(
                    'methods'             => \WP_REST_Server::CREATABLE,
                    'callback'            => array( $this, 'send_test_crawler_alert' ),
                    'permission_callback' => array( $this, 'update_item_permissions_check' ),
                ),
            )
        );

        // Enable/disable a module — mirrors the free vulolabs plugin's
        // own Settings controller (module-architecture.md), same GET/POST
        // shape zyra's ModuleGridComponent already expects.
        register_rest_route(
            VuloPilot()->rest_namespace,
            '/' . $this->modules_base,
            array(
                array(
                    'methods'             => \WP_REST_Server::CREATABLE,
                    'callback'            => array( $this, 'set_modules' ),
                    'permission_callback' => array( $this, 'update_item_permissions_check' ),
                ),
                array(
                    'methods'             => \WP_REST_Server::READABLE,
                    'callback'            => array( $this, 'get_modules' ),
                    'permission_callback' => array( $this, 'get_items_permissions_check' ),
                ),
            )
        );
    }

    /**
     * @inheritDoc
     */
    public function get_items_permissions_check( $request ) {
        return current_user_can( 'manage_options' );
    }

    /**
     * @inheritDoc
     */
    public function update_item_permissions_check( $request ) {
        return current_user_can( 'manage_options' );
    }

    /**
     * @inheritDoc
     */
    public function get_items( $request ) {
        return rest_ensure_response( $this->get_stored_settings() );
    }

    /**
     * Merges one tab's fields into the stored settings — the request
     * shape zyra's `InputRenderer` actually sends (`{ setting, settingName }`,
     * see this class's own docblock), not a flat replace-everything body.
     *
     * @inheritDoc
     */
    public function update_item( $request ) {
        $tab_fields = $request->get_param( 'setting' );

        // Fall back to treating the whole body as the field set when no
        // `setting` wrapper is present (e.g. a direct API call rather than
        // InputRenderer's own auto-save) — still merged, never a wholesale
        // replace either way.
        if ( ! is_array( $tab_fields ) ) {
            $tab_fields = $request->get_json_params();
        }

        if ( ! is_array( $tab_fields ) ) {
            $tab_fields = array();
        }

        $updated = array_merge( $this->get_stored_settings(), $tab_fields );

        update_option( Utill::VULOPILOT_SETTINGS_KEY, $updated );

        $response = array(
            'success' => true,
            'message' => __( 'Settings saved.', 'vulopilot' ),
        );

        // Editing llms.txt's content is meant to take effect immediately,
        // not just on the next dynamic /llms.txt request — write the real
        // file straight away so "View live file" reflects this save
        // without the admin needing to trigger anything else. Reported
        // honestly: a locked-down host where ABSPATH isn't writable still
        // saves the setting (the virtual /llms.txt route still serves it),
        // it just can't also write the static file.
        if ( array_key_exists( 'llms_txt_content', $tab_fields ) ) {
            $response['file_saved'] = VuloPilot()->llms_txt_generator->write_file( $updated['llms_txt_content'] );
        }

        // Instant Indexing tab's "Change key" button — same "an edited
        // field also needs an immediate side-effect on save" precedent as
        // llms_txt_content above, keeping /{key}.txt in sync with whatever
        // key was just saved rather than only writing it lazily elsewhere.
        if ( array_key_exists( 'indexnow_api_key', $tab_fields ) && ! empty( $updated['indexnow_api_key'] ) ) {
            VuloPilot()->indexnow_key_file_server->write_key_file( $updated['indexnow_api_key'] );
        }

        return rest_ensure_response( $response );
    }

    /**
     * Downloads the full stored settings object as JSON — the "Export"
     * action on the Import/Export/Reset tab.
     *
     * @param \WP_REST_Request $request Full details about the request.
     * @return void
     */
    public function export_settings( $request ) {
        nocache_headers();
        header( 'Content-Type: application/json' );
        header( 'Content-Disposition: attachment; filename="vulopilot-settings.json"' );

        echo wp_json_encode( $this->get_stored_settings(), JSON_PRETTY_PRINT ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- a JSON file download, not HTML; wp_json_encode() already produces safe, well-formed output.
        exit;
    }

    /**
     * Restores settings from a previously-exported JSON payload — merges
     * (same posture as update_item()) rather than replacing wholesale.
     *
     * @param \WP_REST_Request $request Full details about the request.
     * @return \WP_REST_Response|\WP_Error
     */
    public function import_settings( $request ) {
        $payload = $request->get_param( 'settings' );

        if ( ! is_array( $payload ) ) {
            return new \WP_Error( 'vulopilot_invalid_import', __( 'That file doesn\'t look like a valid VuloPilot settings export.', 'vulopilot' ), array( 'status' => 400 ) );
        }

        $current = array_merge( $this->get_stored_settings(), $payload );

        update_option( Utill::VULOPILOT_SETTINGS_KEY, $current );

        return rest_ensure_response(
            array(
                'success' => true,
                'message' => __( 'Settings imported.', 'vulopilot' ),
            )
        );
    }

    /**
     * Deletes the stored option entirely, reverting every setting to
     * Utill::VULOPILOT_SETTINGS_DEFAULTS — the "Reset to defaults" action.
     *
     * @param \WP_REST_Request $request Full details about the request.
     * @return \WP_REST_Response
     */
    public function reset_settings( $request ) {
        delete_option( Utill::VULOPILOT_SETTINGS_KEY );

        return rest_ensure_response(
            array(
                'success' => true,
                'message' => __( 'Settings reset to defaults.', 'vulopilot' ),
            )
        );
    }

    /**
     * Settings → Developer Tools' "Clear cache" — every real, transient-
     * cached piece of *content* this plugin (and vulopilot-pro, if active)
     * computes: Knowledge Graph's own extracted entities, the Schema
     * Coverage snapshot, and the AI-crawler-analytics robots.txt bot-group
     * parse. Deliberately scoped to real content caches only, not every
     * transient this plugin owns — the AI-provider per-minute rate-limit
     * counters (AIProviders\Decorators\RateLimitedProvider) and the Core
     * Web Vitals beacon's own rate-limit transient aren't "stale data,"
     * clearing them would just reset a rate limit early, a different
     * (and unwanted here) effect.
     *
     * Pro's own real content cache (`vulopilot_kg_recommendations`,
     * KnowledgeGraph\EntityRecommendationAnalyzer) is cleared via this same
     * action rather than a direct call — Free never imports Pro's
     * namespace, so `vulopilot_clear_all_caches` is the same hook-based
     * cross-boundary contribution `vulopilot_settings_context` (Settings
     * tab registration) already establishes, just an action instead of a
     * filter since nothing needs collecting back. Deliberately does NOT
     * clear Pro's own security-alert-already-sent dedup transient or its
     * license status cache — the same "real content vs. behavioral state"
     * distinction as the rate-limit counters above; each has its own real
     * side effect (resending old alerts, forcing a redundant license
     * re-check) that isn't "refreshing stale data" either.
     *
     * @param \WP_REST_Request $request Full details about the request.
     * @return \WP_REST_Response
     */
    public function clear_cache( $request ) {
        ( new EntityExtractor() )->clear_cache();
        ( new SchemaCoverageAnalyzer() )->clear_cache();
        ( new RobotsTxtBotAccess() )->clear_cache();

        do_action( 'vulopilot_clear_all_caches' );

        return rest_ensure_response(
            array(
                'success' => true,
                'message' => __( 'Cache cleared.', 'vulopilot' ),
            )
        );
    }

    /**
     * "Send test email" (Settings → Notifications) — sends one real email
     * through the exact same recipient/From-header logic every other
     * notification email in this codebase already uses (Services\ScanPersistenceListener,
     * GeoAnalysis\GeoAnalyzer, and their vulopilot-pro counterparts), so a
     * successful test genuinely confirms those settings work rather than
     * exercising a separate code path.
     *
     * @param \WP_REST_Request $request Full details about the request.
     * @return \WP_REST_Response
     */
    public function send_test_email( $request ) {
        $settings  = $this->get_stored_settings();
        $recipient = $settings['notification_email'] ?: get_option( 'admin_email' );

        if ( ! is_email( $recipient ) ) {
            return rest_ensure_response(
                array(
                    'success' => false,
                    'message' => __( 'The notification email address isn\'t valid.', 'vulopilot' ),
                )
            );
        }

        $headers = array();

        if ( ! empty( $settings['email_from_address'] ) && is_email( $settings['email_from_address'] ) ) {
            $from_name = $settings['email_from_name'] ?: get_bloginfo( 'name' );
            $headers[] = sprintf( 'From: %s <%s>', $from_name, $settings['email_from_address'] );
        }

        $sent = wp_mail(
            $recipient,
            sprintf(
                /* translators: %s is the site name. */
                __( '[%s] VuloPilot test email', 'vulopilot' ),
                get_bloginfo( 'name' )
            ),
            __( "This is a test email from VuloPilot's Notifications settings. If you received this, your notification email is configured correctly.", 'vulopilot' ),
            $headers
        );

        return rest_ensure_response(
            array(
                'success' => $sent,
                'message' => $sent
                    ? sprintf(
                        /* translators: %s is the recipient email address. */
                        __( 'Test email sent to %s.', 'vulopilot' ),
                        $recipient
                    )
                    : __( 'wp_mail() returned false — check your site\'s mail configuration.', 'vulopilot' ),
            )
        );
    }

    /**
     * "Send Test Alert" (Notifications → AI Crawler Alerts). The whole AI
     * Crawler Alerts feature (CrawlerAlertMonitor, the 5 real checks it
     * runs daily) lives in vulopilot-pro, and Free never `use`s Pro's
     * namespace (this repo's own CLAUDE.md) — so rather than a direct
     * class reference, this fires the `vulopilot_send_test_crawler_alert`
     * filter and returns whatever comes back. `has_filter()` first means
     * this honestly reports "requires Pro" instead of a generic failure
     * when nothing is listening (Pro inactive, or this specific module
     * toggled off — see Module.php's own registration).
     *
     * On success, also persists a real `crawler_alert_last_test_sent`
     * timestamp into the flat settings option — CrawlerAlertTestPanel.tsx
     * reads it back on load so the "Last test alert sent successfully on
     * ..." line survives a page refresh, not just the moment right after
     * the click.
     *
     * @param \WP_REST_Request $request Full details about the request.
     * @return \WP_REST_Response
     */
    public function send_test_crawler_alert( $request ) {
        if ( ! has_filter( 'vulopilot_send_test_crawler_alert' ) ) {
            return rest_ensure_response(
                array(
                    'success' => false,
                    'message' => __( 'AI Crawler Alerts requires VuloPilot Pro, with the AI Crawler Analytics module active.', 'vulopilot' ),
                )
            );
        }

        $result = apply_filters( 'vulopilot_send_test_crawler_alert', null );

        if ( ! is_array( $result ) || ! isset( $result['success'] ) ) {
            return rest_ensure_response(
                array(
                    'success' => false,
                    'message' => __( 'Could not send a test alert.', 'vulopilot' ),
                )
            );
        }

        if ( $result['success'] ) {
            $updated = array_merge( $this->get_stored_settings(), array( 'crawler_alert_last_test_sent' => current_time( 'mysql' ) ) );
            update_option( Utill::VULOPILOT_SETTINGS_KEY, $updated );
        }

        return rest_ensure_response( $result );
    }

    /**
     * @return array<string, mixed> Stored settings, defaults filled in for anything never saved.
     */
    private function get_stored_settings(): array {
        $saved = get_option( Utill::VULOPILOT_SETTINGS_KEY, array() );

        $settings = wp_parse_args( is_array( $saved ) ? $saved : array(), Utill::VULOPILOT_SETTINGS_DEFAULTS );

        // Sites that saved a checkbox setting before this option's defaults
        // moved to zyra's own wire shape still have a raw PHP boolean
        // sitting in the stored option for that key — normalize it here
        // rather than reintroducing a per-key type allowlist. This is
        // driven by the value's own PHP type, not a field-by-field
        // registry, so it stays consistent with dropping FIELD_TYPES: no
        // setting other than a checkbox has ever stored a real boolean.
        // The wire shape's "on" sentinel is the field's own key (matching
        // every checkbox field's `options: [{ key, value }]` in the *.ts
        // settings configs, e.g. `enable_seo_scanning`'s sole option is
        // `{ key: 'enable_seo_scanning', value: 'enable_seo_scanning' }`),
        // not a shared 'enabled' literal — so `$key` itself is correct here.
        foreach ( $settings as $key => $value ) {
            if ( is_bool( $value ) ) {
                $settings[ $key ] = $value ? array( $key ) : array();
            }
        }

        // 'llms_txt_content' can't live in VULOPILOT_SETTINGS_DEFAULTS as
        // anything but '' (a class const array can't call a method) — so
        // an admin who has never customized it yet sees the real
        // auto-generated content here, not a blank textarea, without that
        // ever being persisted until they actually edit and save it.
        if ( empty( $settings['llms_txt_content'] ) ) {
            $settings['llms_txt_content'] = VuloPilot()->llms_txt_generator->generate();
        }

        // Unlike llms_txt_content above (display-only until an admin
        // explicitly edits/saves), `indexnow_api_key` needs a real,
        // persisted value from the very first read — IndexNowAutoSubmitter
        // and the key file at /{key}.txt both need a stable key to exist
        // before an admin ever visits the Instant Indexing tab, not just
        // whenever they happen to click "Change key" the first time.
        if ( empty( $settings['indexnow_api_key'] ) ) {
            $settings['indexnow_api_key'] = \VuloPilot\Services\IndexNowKeyFileServer::generate_new_key();
            update_option( Utill::VULOPILOT_SETTINGS_KEY, $settings );
            VuloPilot()->indexnow_key_file_server->write_key_file( $settings['indexnow_api_key'] );
        }

        return $settings;
    }

    /**
     * Activates or deactivates one module — the same request shape zyra's
     * `ModuleGridComponent` sends regardless of which plugin it's talking
     * to (`{ id, action, modules? }`), mirrored from the free vulolabs
     * plugin's own `set_modules()`.
     *
     * @param \WP_REST_Request $request Full details about the request.
     * @return \WP_REST_Response|\WP_Error
     */
    public function set_modules( $request ) {
        $module_id = sanitize_key( (string) $request->get_param( 'id' ) );
        $action    = sanitize_key( (string) $request->get_param( 'action' ) );
        $modules   = array_map( 'sanitize_key', (array) $request->get_param( 'modules' ) );

        if ( '' === $module_id && empty( $modules ) ) {
            return new \WP_Error( 'vulopilot_missing_module_id', __( 'No module id given.', 'vulopilot' ), array( 'status' => 400 ) );
        }

        if ( ! empty( $modules ) ) {
            $result = VuloPilot()->modules->activate_modules( $modules );

            return rest_ensure_response( $result );
        }

        $result = 'activate' === $action
            ? VuloPilot()->modules->activate_modules( array( $module_id ) )
            : VuloPilot()->modules->deactivate_modules( array( $module_id ) );

        return rest_ensure_response( $result );
    }

    /**
     * @return array Every currently active module's id — zyra's
     *               `initializeModules()`/`useModules()` (react-frontend.md)
     *               expect this exact flat-array shape.
     */
    public function get_modules() {
        return VuloPilot()->modules->get_active_modules();
    }
}
