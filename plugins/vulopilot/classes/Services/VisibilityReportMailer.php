<?php
/**
 * VisibilityReportMailer class file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\Services;

use VuloPilot\Reports\ReportGenerator;
use VuloPilot\Repositories\FindingRepository;
use VuloPilot\Repositories\ReportRepository;
use VuloPilot\Utill;

defined( 'ABSPATH' ) || exit;

/**
 * Free's "Send Visibility Report" automation's real action — generates a
 * `scan_summary` report (Reports\Types\ScanSummaryReport already has
 * exactly the headline numbers/trend the spec's own bullet list wants: open/
 * resolved/critical finding counts, week-over-week trend) and emails a
 * plain-language summary of it. No new report type needed.
 *
 * Deliberately its own small class rather than reusing
 * vulopilot-pro's AdvancedReports\ScheduledReportRunner — that class is Pro
 * business logic keyed to `vulopilot_scheduled_jobs`/multi-format/multi-
 * recipient job configs; this is Free's own fixed, single-recipient,
 * single-report-type case, following the same "own small class per
 * concern" precedent Services\BackupScheduler/BackupManager already set
 * rather than being forced through a heavier Pro-oriented job system.
 *
 * @class       VisibilityReportMailer class
 * @version     1.0.0
 * @author      VuloLabs
 */
class VisibilityReportMailer {

    private const REPORT_TYPE = 'scan_summary';

    /**
     * @var ReportGenerator
     */
    private ReportGenerator $generator;

    /**
     * @var ReportRepository
     */
    private ReportRepository $reports;

    /**
     * @var FindingRepository
     */
    private FindingRepository $findings;

    /**
     * @param ReportGenerator         $generator Generates the underlying scan_summary report.
     * @param ReportRepository|null   $reports   Defaults to a new instance — injectable for tests.
     * @param FindingRepository|null  $findings  Defaults to a new instance — injectable for tests.
     */
    public function __construct( ReportGenerator $generator, ?ReportRepository $reports = null, ?FindingRepository $findings = null ) {
        $this->generator = $generator;
        $this->reports    = $reports ?? new ReportRepository();
        $this->findings   = $findings ?? new FindingRepository();
    }

    /**
     * @param string $frequency 'weekly'|'monthly' — the automation row's own `trigger_config.frequency`.
     * @return bool True if a report was generated and an email was sent (or there was nothing to email to).
     */
    public function send( string $frequency ): bool {
        [ $period_start, $period_end ] = $this->period_for_frequency( $frequency );

        $report_id = $this->generator->generate( self::REPORT_TYPE, 'json', $period_start, $period_end, array(), 0 );

        $report = $this->reports->find( $report_id );

        if ( ! $report || 'ready' !== $report['status'] ) {
            return false;
        }

        $meta = json_decode( (string) $report['meta'], true );
        $meta = is_array( $meta ) ? $meta : array();

        $recipient = $this->resolve_recipient();

        if ( ! $recipient ) {
            return false;
        }

        $top_findings = $this->findings->get_top_findings_for_period( $period_start, $period_end, null, 5 );

        return $this->mail(
            $recipient,
            (array) ( $meta['summary'] ?? array() ),
            (array) ( $meta['trend'] ?? array() ),
            $top_findings,
            $period_start,
            $period_end
        );
    }

    /**
     * @param string $frequency 'weekly'|'monthly'.
     * @return array{0: string, 1: string} [period_start, period_end], both Y-m-d.
     */
    private function period_for_frequency( string $frequency ): array {
        $end = current_time( 'Y-m-d' );

        $start = 'monthly' === $frequency
            ? gmdate( 'Y-m-d', strtotime( '-29 days', strtotime( $end ) ) )
            : gmdate( 'Y-m-d', strtotime( '-6 days', strtotime( $end ) ) );

        return array( $start, $end );
    }

    /**
     * @return string Empty string when there's genuinely nowhere to send this.
     */
    private function resolve_recipient(): string {
        $settings = wp_parse_args( get_option( Utill::VULOPILOT_SETTINGS_KEY, array() ), Utill::VULOPILOT_SETTINGS_DEFAULTS );

        $recipient = (string) ( $settings['notification_email'] ?? '' );

        if ( $recipient && is_email( $recipient ) ) {
            return $recipient;
        }

        return (string) get_option( 'admin_email' );
    }

    /**
     * @param string                $recipient    Real, already-validated email address.
     * @param array<string, mixed>  $summary      ReportResult::get_summary() from the just-generated report.
     * @param array<string, mixed>  $trend        ReportResult::get_trend() from the just-generated report.
     * @param array<int, array>     $top_findings Up to 5 real open findings, most severe first.
     * @param string                $period_start Y-m-d.
     * @param string                $period_end   Y-m-d.
     * @return bool wp_mail()'s own return value.
     */
    private function mail( string $recipient, array $summary, array $trend, array $top_findings, string $period_start, string $period_end ): bool {
        $settings = wp_parse_args( get_option( Utill::VULOPILOT_SETTINGS_KEY, array() ), Utill::VULOPILOT_SETTINGS_DEFAULTS );
        $headers  = array( 'Content-Type: text/html; charset=UTF-8' );

        if ( ! empty( $settings['email_from_address'] ) && is_email( $settings['email_from_address'] ) ) {
            $from_name = $settings['email_from_name'] ?: get_bloginfo( 'name' );
            $headers[] = sprintf( 'From: %s <%s>', $from_name, $settings['email_from_address'] );
        }

        $subject = sprintf(
            /* translators: %s: site name. */
            __( '[%s] Your VuloPilot Visibility Report', 'vulopilot' ),
            get_bloginfo( 'name' )
        );

        ob_start();
        ?>
        <p><?php echo esc_html( sprintf( /* translators: 1: period start, 2: period end. */ __( 'Here\'s your visibility summary for %1$s – %2$s.', 'vulopilot' ), $period_start, $period_end ) ); ?></p>
        <ul>
            <li><?php echo esc_html( sprintf( /* translators: %d: number. */ __( '%d open issues', 'vulopilot' ), (int) ( $summary['open_findings'] ?? 0 ) ) ); ?></li>
            <li><?php echo esc_html( sprintf( /* translators: %d: number. */ __( '%d resolved this period', 'vulopilot' ), (int) ( $summary['resolved_findings'] ?? 0 ) ) ); ?></li>
            <li><?php echo esc_html( sprintf( /* translators: %d: number. */ __( '%d critical issues', 'vulopilot' ), (int) ( $summary['critical_findings'] ?? 0 ) ) ); ?></li>
        </ul>
        <?php if ( isset( $trend['total_findings'] ) && null !== $trend['total_findings']['change_percent'] ) : ?>
            <p><?php echo esc_html( sprintf( /* translators: %s: signed percent change, e.g. "+12%" or "-8%". */ __( 'Total findings changed %s vs. the previous period.', 'vulopilot' ), ( $trend['total_findings']['change_percent'] >= 0 ? '+' : '' ) . round( $trend['total_findings']['change_percent'], 1 ) . '%' ) ); ?></p>
        <?php endif; ?>
        <?php if ( $top_findings ) : ?>
            <p><strong><?php esc_html_e( 'Pages needing attention:', 'vulopilot' ); ?></strong></p>
            <ul>
                <?php foreach ( $top_findings as $finding ) : ?>
                    <li><?php echo esc_html( (string) $finding['title'] ); ?> (<?php echo esc_html( ucfirst( (string) $finding['severity'] ) ); ?>)</li>
                <?php endforeach; ?>
            </ul>
        <?php endif; ?>
        <p><?php esc_html_e( 'Sign in to your dashboard to see the full picture and recommended next steps.', 'vulopilot' ); ?></p>
        <?php
        $body = (string) ob_get_clean();

        return wp_mail( $recipient, $subject, $body, $headers );
    }
}
