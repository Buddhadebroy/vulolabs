<?php
/**
 * BackupHealthScanner class file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\Scanners\Basic;

use VuloPilot\Repositories\BackupRepository;
use VuloPilot\ValueObjects\Finding;
use VuloPilot\ValueObjects\Severity;
use VuloPilot\Utill;

defined( 'ABSPATH' ) || exit;

/**
 * Turns Services\BackupManager/BackupScheduler's own real backup-run log
 * (`vulopilot_backups`) into a real Finding when automatic backups are
 * enabled but something's actually wrong — the most recent run failed, or
 * nothing has completed in over 2x the configured `backup_frequency`
 * interval. Zero findings when healthy, or — deliberately — when automatic
 * backups simply aren't turned on at all (no nagging about an opt-in
 * feature nobody enabled; a manual-only backup user isn't "unhealthy").
 *
 * @class       BackupHealthScanner class
 * @version     1.0.0
 * @author      VuloLabs
 */
class BackupHealthScanner extends AbstractBasicScanner {

    /**
     * Real days-per-cadence, matching Services\BackupScheduler's own
     * `wp_schedule_event()` interval choices.
     *
     * @var array<string, int>
     */
    private const FREQUENCY_DAYS = array(
        'daily'  => 1,
        'weekly' => 7,
    );

    /**
     * @inheritDoc
     */
    public function get_id(): string {
        return 'backup-health';
    }

    /**
     * @inheritDoc
     */
    public function get_label(): string {
        return __( 'Backup Health', 'vulopilot' );
    }

    /**
     * @inheritDoc
     */
    public function get_category(): string {
        return 'security';
    }

    /**
     * @inheritDoc
     */
    public function scan(): array {
        $findings = array();

        $settings = wp_parse_args( get_option( Utill::VULOPILOT_SETTINGS_KEY, array() ), Utill::VULOPILOT_SETTINGS_DEFAULTS );

        if ( empty( $settings['enable_automatic_backups'] ) ) {
            return $findings;
        }

        $repository = new BackupRepository();
        $latest     = $repository->get_latest();

        if ( $latest && 'failed' === $latest['status'] ) {
            $findings[] = new Finding(
                __( 'Your most recent automatic backup failed', 'vulopilot' ),
                Severity::MEDIUM,
                $this->get_category(),
                ! empty( $latest['error_message'] )
                    ? sprintf(
                        /* translators: %s is the real error message the failed backup recorded. */
                        __( 'Real error from the last backup run: %s', 'vulopilot' ),
                        $latest['error_message']
                    )
                    : __( 'The last automatic backup run did not complete successfully. Check the Backups tab and try running one manually.', 'vulopilot' ),
                'backup',
                (string) $latest['id']
            );

            return $findings;
        }

        $frequency      = (string) ( $settings['backup_frequency'] ?? 'disabled' );
        $frequency_days = self::FREQUENCY_DAYS[ $frequency ] ?? null;

        if ( null === $frequency_days ) {
            return $findings;
        }

        $latest_completed = $repository->get_latest_completed();
        $stale_threshold  = time() - ( $frequency_days * 2 * DAY_IN_SECONDS );

        if ( ! $latest_completed ) {
            $findings[] = new Finding(
                __( 'No automatic backup has completed yet', 'vulopilot' ),
                Severity::MEDIUM,
                $this->get_category(),
                __( 'Automatic backups are enabled, but none has finished successfully yet. If this persists, check the Backups tab for the real error.', 'vulopilot' )
            );

            return $findings;
        }

        $finished_timestamp = strtotime( (string) $latest_completed['finished_at'] );

        if ( $finished_timestamp && $finished_timestamp < $stale_threshold ) {
            $findings[] = new Finding(
                __( 'Your automatic backups are overdue', 'vulopilot' ),
                Severity::MEDIUM,
                $this->get_category(),
                sprintf(
                    /* translators: %s is the real date/time of the last successful backup. */
                    __( 'The last successful backup completed on %s — longer ago than your configured schedule allows for. Check the Backups tab.', 'vulopilot' ),
                    get_date_from_gmt( $latest_completed['finished_at'], get_option( 'date_format' ) . ' ' . get_option( 'time_format' ) )
                ),
                'backup',
                (string) $latest_completed['id']
            );
        }

        return $findings;
    }
}
