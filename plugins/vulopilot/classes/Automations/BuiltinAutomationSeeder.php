<?php
/**
 * BuiltinAutomationSeeder class file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\Automations;

use VuloPilot\Repositories\AutomationsRepository;

defined( 'ABSPATH' ) || exit;

/**
 * Seeds Free's own two fixed, schedule-only automations — "Run Full Site
 * Scan" and "Send Visibility Report" (VuloPilot Free vs Pro Automation
 * Builder Prompt.md: "Free will get only 2 predefined automations"). Real
 * `vulopilot_automations` rows, same table every automation (Free or Pro)
 * lives in, so they show up in the existing Automations table/dashboard
 * widget for free — but their own `trigger_type` (`TRIGGER_FULL_SITE_SCAN`/
 * `TRIGGER_VISIBILITY_REPORT`) is deliberately outside vulopilot-pro's
 * TriggerRegistry vocabulary (hourly/daily/weekly/monthly/...), so Pro's
 * AutomationsEngine — which is Recommendation-driven, see
 * WebsiteHealthScanScheduler's own docblock for why that engine can't run a
 * bare site-level action like these two — never selects or fires these
 * rows even when Pro is active. Services\AutomationScheduler is the only
 * thing that ever reads/runs them.
 *
 * Idempotent the same way vulopilot-pro's WebsiteHealthScanScheduler
 * already is: a stable `trigger_config.system_default` marker
 * (AutomationsRepository::find_by_system_default_marker()) means a renamed
 * row is never mistaken for "not seeded yet," and a site-wide "already
 * seeded" option means a deleted row is never silently resurrected.
 *
 * @class       BuiltinAutomationSeeder class
 * @version     1.0.0
 * @author      VuloLabs
 */
class BuiltinAutomationSeeder {

    /**
     * @var string
     */
    public const TRIGGER_FULL_SITE_SCAN = 'free_full_site_scan';

    /**
     * @var string
     */
    public const TRIGGER_VISIBILITY_REPORT = 'free_visibility_report';

    /**
     * @var string Public — Services\AutomationScheduler looks its two rows up by these same markers.
     */
    public const MARKER_FULL_SITE_SCAN = 'free-full-site-scan';

    /**
     * @var string
     */
    public const MARKER_VISIBILITY_REPORT = 'free-visibility-report';

    /**
     * @var string
     */
    private const SEEDED_OPTION = 'vulopilot_builtin_automations_seeded';

    /**
     * @var AutomationsRepository
     */
    private AutomationsRepository $automations;

    /**
     * @param AutomationsRepository|null $automations Defaults to a new instance — injectable for tests.
     */
    public function __construct( ?AutomationsRepository $automations = null ) {
        $this->automations = $automations ?? new AutomationsRepository();

        add_action( 'init', array( $this, 'ensure_seeded' ), 20 );
    }

    /**
     * Runs on every request (cheap no-op after the first, via
     * SEEDED_OPTION) rather than only on activation — same posture
     * WebsiteHealthScanScheduler::ensure_seeded() already documents.
     *
     * @return void
     */
    public function ensure_seeded(): void {
        if ( get_option( self::SEEDED_OPTION ) ) {
            return;
        }

        $scan_ok = $this->ensure_row(
            self::MARKER_FULL_SITE_SCAN,
            self::TRIGGER_FULL_SITE_SCAN,
            __( 'Run Full Site Scan', 'vulopilot' ),
            'monitoring',
            array( 'frequency' => 'daily' ),
            array(
                array(
                    'type'   => 'run-full-site-scan',
                    'config' => array(),
                ),
            ),
            'enabled'
        );

        $report_ok = $this->ensure_row(
            self::MARKER_VISIBILITY_REPORT,
            self::TRIGGER_VISIBILITY_REPORT,
            __( 'Send Visibility Report', 'vulopilot' ),
            'reporting',
            array(
                'frequency'   => 'weekly',
                'day_of_week' => 1, // Monday, matching the spec's own example.
            ),
            array(
                array(
                    'type'   => 'send-visibility-report',
                    'config' => array(),
                ),
            ),
            'disabled' // Opt-in — unlike a schedule scan, an unsolicited recurring email shouldn't start firing without the site owner choosing it.
        );

        if ( $scan_ok && $report_ok ) {
            update_option( self::SEEDED_OPTION, '1', false );
        }
    }

    /**
     * @param string $marker         Stable `trigger_config.system_default` value.
     * @param string $trigger_type   One of this class's own TRIGGER_* constants.
     * @param string $name           Automation row name.
     * @param string $category       Automation row category.
     * @param array  $trigger_config Merged with `system_default` before insert.
     * @param array  $actions        Automation row `actions`.
     * @param string $default_status 'enabled'|'disabled'.
     * @return bool True if the row already existed or was just created; false only on a real insert failure (retried next request).
     */
    private function ensure_row( string $marker, string $trigger_type, string $name, string $category, array $trigger_config, array $actions, string $default_status ): bool {
        if ( $this->automations->find_by_system_default_marker( $marker ) ) {
            return true;
        }

        $trigger_config['system_default'] = $marker;

        $automation_id = $this->automations->insert(
            array(
                'name'           => $name,
                'rule_id'        => null,
                'category'       => $category,
                'trigger_type'   => $trigger_type,
                'trigger_config' => wp_json_encode( $trigger_config ),
                'conditions'     => null,
                'actions'        => wp_json_encode( $actions ),
                'status'         => $default_status,
                'created_by'     => 0, // System-seeded, not a specific admin user.
            )
        );

        return (bool) $automation_id;
    }
}
