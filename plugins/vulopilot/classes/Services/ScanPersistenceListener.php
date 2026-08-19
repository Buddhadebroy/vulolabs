<?php
/**
 * ScanPersistenceListener class file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\Services;

use VuloPilot\ValueObjects\Finding;
use VuloPilot\ValueObjects\ScanResult;
use VuloPilot\ValueObjects\Severity;
use VuloPilot\Repositories\ActivityLogRepository;
use VuloPilot\Repositories\FindingRepository;
use VuloPilot\Repositories\ScanRepository;
use VuloPilot\Utill;

defined( 'ABSPATH' ) || exit;

/**
 * VuloPilot ScanPersistenceListener class.
 *
 * The first real occupant of the "Services" layer ARCHITECTURE.md
 * describes — self-hooks `vulopilot_scan_completed` (fired by
 * Scanners\ScanRunner, which deliberately never persists anything itself;
 * see its own docblock) and is the thing that turns a ScanResult into
 * real vulopilot_scans/vulopilot_scan_findings rows. Neither ScanRunner
 * nor RuleEngine has any idea this class exists — the hook is the only
 * coupling, same one-way-dependency shape used throughout.
 *
 * Fires `vulopilot_scan_persisted` after its own persistence work — the
 * seam vulopilot-pro's AdvancedReports module hooks to recalculate and
 * upsert today's site-health snapshot (historical trend data is Pro
 * business logic; this class only owns "did the scan's own rows get
 * written," not what anyone else derives from that afterward).
 *
 * @class       ScanPersistenceListener class
 * @version     1.0.0
 * @author      VuloLabs
 */
class ScanPersistenceListener {

    /**
     * Scanners whose findings get looked up (via
     * FindingRepository::find_open_duplicate()) and refreshed in place
     * instead of always inserted fresh — see handle_scan_completed()'s own
     * comment for why this dedup is scoped to just these two rather than
     * applied to every scanner: they're the one pair a manual "Run scan"/
     * daily cron genuinely re-checks the exact same URL against, so a
     * still-broken link would otherwise pile up one duplicate open finding
     * per run. Other scanners keep today's "one row per scan run" behavior
     * unchanged.
     *
     * @var string[]
     */
    private const DEDUPE_ON_RESCAN = array( 'broken-links', 'broken-images' );

    /**
     * @var ScanRepository
     */
    private ScanRepository $scans;

    /**
     * @var FindingRepository
     */
    private FindingRepository $findings;

    /**
     * @var ActivityLogRepository
     */
    private ActivityLogRepository $activity_logs;

    /**
     * ScanPersistenceListener constructor.
     */
    public function __construct() {
        $this->scans         = new ScanRepository();
        $this->findings      = new FindingRepository();
        $this->activity_logs = new ActivityLogRepository();

        add_action( 'vulopilot_scan_completed', array( $this, 'handle_scan_completed' ) );
    }

    /**
     * @param ScanResult $scan_result The completed scan.
     * @return void
     */
    public function handle_scan_completed( ScanResult $scan_result ): void {
        $scan_id = $this->scans->insert(
            array(
                'scanner_id'      => $scan_result->get_scanner_id(),
                'status'          => $scan_result->get_status(),
                'duration_ms'     => (int) $scan_result->get_duration_ms(),
                'summary'         => wp_json_encode( $scan_result->get_summary() ),
                'scanned_objects' => wp_json_encode( $scan_result->get_scanned_post_ids() ),
                'error_message'   => $scan_result->get_error_message(),
                'started_at'      => current_time( 'mysql', true ),
                'finished_at'     => current_time( 'mysql', true ),
            )
        );

        foreach ( $scan_result->get_findings() as $finding ) {
            $duplicate = in_array( $scan_result->get_scanner_id(), self::DEDUPE_ON_RESCAN, true )
                && $finding->get_object_type()
                && $finding->get_object_ref()
                ? $this->findings->find_open_duplicate(
                    $scan_result->get_scanner_id(),
                    (string) $finding->get_object_type(),
                    (string) $finding->get_object_ref(),
                    $finding->get_title()
                )
                : null;

            if ( null !== $duplicate ) {
                // Same URL is still broken as of this run — refresh the
                // existing open row's own scan-run-specific fields rather
                // than inserting a second identical one (see
                // FindingRepository::find_open_duplicate()'s own
                // docblock). `created_at`/`id` deliberately untouched, so
                // this stays "first detected" for the finding, not
                // "detected again."
                $this->findings->update(
                    (int) $duplicate['id'],
                    array(
                        'scan_id'     => $scan_id,
                        'severity'    => $finding->get_severity(),
                        'category'    => $finding->get_category(),
                        'description' => $finding->get_description(),
                        'meta'        => wp_json_encode( $finding->get_meta() ),
                    )
                );
                continue;
            }

            $this->findings->insert(
                array(
                    'scan_id'     => $scan_id,
                    'scanner_id'  => $scan_result->get_scanner_id(),
                    'severity'    => $finding->get_severity(),
                    'category'    => $finding->get_category(),
                    'title'       => $finding->get_title(),
                    'description' => $finding->get_description(),
                    'object_type' => $finding->get_object_type(),
                    'object_ref'  => $finding->get_object_ref(),
                    'meta'        => wp_json_encode( $finding->get_meta() ),
                )
            );
        }

        $this->activity_logs->log(
            'scan.completed',
            sprintf(
                /* translators: 1: scanner id, 2: number of findings. */
                __( 'Scan "%1$s" completed with %2$d finding(s).', 'vulopilot' ),
                $scan_result->get_scanner_id(),
                count( $scan_result->get_findings() )
            ),
            ScanResult::STATUS_FAILED === $scan_result->get_status() ? Severity::HIGH : Severity::INFO,
            'system',
            'scan',
            (string) $scan_id
        );

        $this->maybe_notify_critical_findings( $scan_result );

        /**
         * Fires after a scan's own rows are persisted — vulopilot-pro's
         * AdvancedReports module hooks this to recalculate and upsert
         * today's site-health snapshot (historical trend data). Free
         * itself doesn't do anything with $scan_id beyond handing it out;
         * a hooked callback can re-query FindingRepository itself for
         * current open-finding counts, the same way this class used to.
         *
         * @param ScanResult $scan_result The completed scan.
         * @param int        $scan_id     The just-inserted `vulopilot_scans` row id.
         */
        do_action( 'vulopilot_scan_persisted', $scan_result, $scan_id );
    }

    /**
     * Emails the site's notification address when this scan raised any
     * critical-severity finding, gated behind the Settings screen's
     * Notifications tab (`notify_on_critical_findings`, default off — this
     * is opt-in, not a change to a previously-silent default).
     *
     * @param ScanResult $scan_result The completed scan.
     * @return void
     */
    private function maybe_notify_critical_findings( ScanResult $scan_result ): void {
        $settings = wp_parse_args( get_option( Utill::VULOPILOT_SETTINGS_KEY, array() ), Utill::VULOPILOT_SETTINGS_DEFAULTS );

        if ( empty( $settings['notify_on_critical_findings'] ) ) {
            return;
        }

        $critical_findings = array_values(
            array_filter(
                $scan_result->get_findings(),
                static fn( Finding $finding ) => Severity::CRITICAL === $finding->get_severity()
            )
        );

        if ( empty( $critical_findings ) ) {
            return;
        }

        $recipient = $settings['notification_email'] ?: get_option( 'admin_email' );
        $headers   = array();

        if ( ! empty( $settings['email_from_address'] ) && is_email( $settings['email_from_address'] ) ) {
            $from_name = $settings['email_from_name'] ?: get_bloginfo( 'name' );
            $headers[] = sprintf( 'From: %s <%s>', $from_name, $settings['email_from_address'] );
        }

        wp_mail(
            $recipient,
            sprintf(
                /* translators: 1: site name, 2: number of critical findings. */
                __( '[%1$s] VuloPilot found %2$d critical issue(s)', 'vulopilot' ),
                get_bloginfo( 'name' ),
                count( $critical_findings )
            ),
            implode(
                "\n",
                array_map(
                    static fn( Finding $finding ): string => '- ' . $finding->get_title(),
                    $critical_findings
                )
            ),
            $headers
        );
    }
}
