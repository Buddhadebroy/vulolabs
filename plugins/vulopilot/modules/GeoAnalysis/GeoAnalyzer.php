<?php
/**
 * GeoAnalyzer class file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\GeoAnalysis;

use VuloPilot\AiAssistant\AiRequestSender;
use VuloPilot\GeoAnalysis\ValueObjects\GeoScore;
use VuloPilot\Dashboard\ActivityLogRepository;
use VuloPilot\Utill\FindingRepository;
use VuloPilot\GeoAnalysis\Scanners\GeoCitationOpportunityScanner;

defined( 'ABSPATH' ) || exit;

/**
 * Generates a GeoScore for one post.
 *
 * @class       GeoAnalyzer class
 * @version     1.0.0
 * @author      VuloLabs
 */
class GeoAnalyzer {

    /**
     * The 8 GEO-MODULE.md scanners scoped to a single post, plus the one sitewide check that applies identically to every post.
     */
    private const TOTAL_DETERMINISTIC_CHECKS = 9;

    public const META_KEY = '_vulopilot_geo_score';

    private FindingRepository $findings;
    private AiRequestSender $request_sender;
    private ActivityLogRepository $activity_logs;

    /**
     * $request_sender is deliberately required, not defaulted.
     *
     * @param AiRequestSender            $request_sender Sends a prompt through the safety-validate → send → sanitize sequence.
     * @param FindingRepository|null     $findings       Defaults to a new instance (injectable for tests).
     * @param ActivityLogRepository|null $activity_logs  Defaults to a new instance (injectable for tests).
     */
    public function __construct( AiRequestSender $request_sender, ?FindingRepository $findings = null, ?ActivityLogRepository $activity_logs = null ) {
        $this->request_sender = $request_sender;
        $this->findings       = $findings ?? new FindingRepository();
        $this->activity_logs  = $activity_logs ?? new ActivityLogRepository();
    }

    /**
     * Runs a fresh analysis, persists it to postmeta, and returns it.
     *
     * @param int $post_id Post to analyze.
     * @return GeoScore
     * @throws \InvalidArgumentException If post_id doesn't refer to a published post/page.
     * @throws \RuntimeException If no AI connection is configured, or the AI response is unusable.
     */
    public function analyze( int $post_id ): GeoScore {
        $post = get_post( $post_id );

        if ( ! $post || ! in_array( $post->post_type, array( 'post', 'page' ), true ) || 'publish' !== $post->post_status ) {
            throw new \InvalidArgumentException( esc_html__( 'post_id must refer to a published post or page.', 'vulopilot' ) );
        }

        $settings = wp_parse_args( get_option( \VuloPilot\Utill::VULOPILOT_SETTINGS_KEY, array() ), \VuloPilot\Utill::VULOPILOT_SETTINGS_DEFAULTS );

        $deterministic_score       = $this->calculate_deterministic_score( $post_id );
        $sub_scores                = $this->calculate_sub_scores( $post_id, $post );
        $context                   = $this->build_context( $post, $deterministic_score, $settings );
        $response                  = $this->request_sender->send_feature( 'geo_analysis', 'analyze', $context, 'geo_analysis', null, false );
        $ai_scores_and_suggestions = $this->parse_response( $response );

        // Scanning → GEO's "Flag weak entity coverage".
        if ( empty( $settings['ai_visibility_scans']['entity']['enable'] ) ) {
            unset( $ai_scores_and_suggestions['ai_scores']['entity_coverage'] );
        }

        $overall_score = $this->calculate_overall_score( $deterministic_score, $ai_scores_and_suggestions['ai_scores'], $sub_scores );

        $score = new GeoScore(
            $post_id,
            $deterministic_score,
            $ai_scores_and_suggestions['ai_scores'],
            $sub_scores,
            $overall_score,
            $ai_scores_and_suggestions['suggestions'],
            current_time( 'mysql', true )
        );

        $this->maybe_notify_score_drop( $post, $overall_score );

        update_post_meta( $post_id, self::META_KEY, wp_json_encode( $score->to_array() ) );

        return $score;
    }

    /**
     * Compares the overall_score against the previously stored one and emails/logs when it fell by at least `visibility_alerts['geo']['threshold']`, gated behind `email_on_visibility_alerts` and `visibility_alerts['geo']['enable']`.
     *
     * @param \WP_Post $post          Post just analyzed.
     * @param int      $overall_score The just-computed overall_score.
     * @return void
     */
    private function maybe_notify_score_drop( \WP_Post $post, int $overall_score ): void {
        $settings = wp_parse_args( get_option( \VuloPilot\Utill::VULOPILOT_SETTINGS_KEY, array() ), \VuloPilot\Utill::VULOPILOT_SETTINGS_DEFAULTS );

        $geo_alert = (array) ( $settings['visibility_alerts']['geo'] ?? array() );

        if ( empty( $settings['email_on_visibility_alerts'] ) || empty( $geo_alert['enable'] ) ) {
            return;
        }

        $previous = $this->get_stored_score( $post->ID );

        if ( null === $previous || ! isset( $previous['overall_score'] ) ) {
            return;
        }

        $threshold = absint( $geo_alert['threshold'] ?? 5 );
        $drop      = (int) $previous['overall_score'] - $overall_score;

        if ( $drop < $threshold ) {
            return;
        }

        $message = sprintf(
            /* translators: 1: previous score, 2: new score, 3: post title. */
            __( 'The GEO score for "%3$s" fell from %1$d to %2$d.', 'vulopilot' ),
            (int) $previous['overall_score'],
            $overall_score,
            $post->post_title
        );

        $channels = (array) ( $settings['visibility_alert_channels'] ?? array() );

        if ( in_array( 'dashboard', $channels, true ) ) {
            $this->activity_logs->log( 'visibility_alert.geo_score_drop', $message, 'warning', 'system', 'post', (string) $post->ID );
        }

        if ( ! in_array( 'email', $channels, true ) ) {
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
                /* translators: 1: site name, 2: post title. */
                __( '[%1$s] GEO score dropped for "%2$s"', 'vulopilot' ),
                get_bloginfo( 'name' ),
                $post->post_title
            ),
            $message,
            $headers
        );
    }

    /**
     * Reads back a previously generated score without spending another AI call.
     *
     * @param int $post_id Post to read a score for.
     * @return array|null
     */
    public function get_stored_score( int $post_id ): ?array {
        $stored = get_post_meta( $post_id, self::META_KEY, true );

        if ( '' === $stored ) {
            return null;
        }

        $decoded = json_decode( (string) $stored, true );

        return is_array( $decoded ) ? $decoded : null;
    }

    /**
     * Percentage of GEO-MODULE.md's 9 deterministic checks that have no open finding for this post.
     *
     * @param int $post_id Post to score.
     * @return int|null 0-100, or null if no 'geo' category finding has ever been recorded.
     */
    private function calculate_deterministic_score( int $post_id ): ?int {
        $has_any_geo_history = 0 < (int) $this->findings->find_all(
            array(
                'category' => 'geo',
                'per_page' => 1,
            )
        )['total'];

        if ( ! $has_any_geo_history ) {
            return null;
        }

        $per_post_failures = (int) $this->findings->find_all(
            array(
                'category'   => 'geo',
                'status'     => 'open',
                'object_ref' => (string) $post_id,
                'per_page'   => self::TOTAL_DETERMINISTIC_CHECKS,
            )
        )['total'];

        $sitewide_trust_signal_failure = 0 < (int) $this->findings->find_all(
            array(
                'category'   => 'geo',
                'status'     => 'open',
                'object_ref' => home_url( '/' ),
                'per_page'   => 1,
            )
        )['total'];

        return self::score_from_failures( $per_post_failures, $sitewide_trust_signal_failure );
    }

    /**
     * The deterministic-score formula, extracted so Controllers\GeoAnalysis::get_pages() can compute the same score in bulk for every published page without calculate_deterministic_score()'s per-post queries.
     *
     * @param int      $per_post_failures             Open findings against this specific post.
     * @param bool     $sitewide_trust_signal_failure Whether the sitewide Trust Signals check is currently open.
     * @param int|null $total_checks                  Denominator - defaults to GEO's own 9-check total.
     * @return int 0-100.
     */
    public static function score_from_failures( int $per_post_failures, bool $sitewide_trust_signal_failure, ?int $total_checks = null ): int {
        $total_checks = $total_checks && $total_checks > 0 ? $total_checks : self::TOTAL_DETERMINISTIC_CHECKS;

        $failures = min(
            $total_checks,
            $per_post_failures + ( $sitewide_trust_signal_failure ? 1 : 0 )
        );

        return (int) round( ( $total_checks - $failures ) / $total_checks * 100 );
    }

    /**
     * The 6 readme.txt AI-Visibility sub-metrics that don't need an AI judgment call.
     *
     * @param int      $post_id Post to score.
     * @param \WP_Post $post    Same post, already loaded by analyze().
     * @return array
     */
    private function calculate_sub_scores( int $post_id, \WP_Post $post ): array {
        $ref = (string) $post_id;

        $retrieval_checks = array( 'geo-chunking', 'geo-semantic-structure' );
        $retrieval_passed = 0;
        foreach ( $retrieval_checks as $scanner_id ) {
            if ( ! $this->has_open_finding( $scanner_id, $ref ) ) {
                ++$retrieval_passed;
            }
        }

        $qa_checks = array( 'geo-summary-block', 'geo-faq-opportunity' );
        $qa_passed = 0;
        foreach ( $qa_checks as $scanner_id ) {
            if ( ! $this->has_open_finding( $scanner_id, $ref ) ) {
                ++$qa_passed;
            }
        }

        return array(
            'retrieval_score'             => (int) round( $retrieval_passed / count( $retrieval_checks ) * 100 ),
            'citation_readiness'          => $this->has_open_finding( 'geo-citation-opportunities', $ref ) ? 0 : 100,
            'ai_summary_qa_detection'     => (int) round( $qa_passed / count( $qa_checks ) * 100 ),
            'entity_naming_consistency'   => $this->has_open_finding( 'geo-entity-naming-consistency', $ref ) ? 0 : 100,
            'content_freshness'           => $this->calculate_content_freshness( $post ),
            'data_point_evidence_density' => $this->calculate_evidence_density( $post ),
        );
    }

    /**
     * Whether one specific scanner has an open finding against one specific object.
     *
     * @param string $scanner_id One of the Geo*Scanner::get_id() strings.
     * @param string $object_ref Post id (or home_url('/') for the sitewide Trust Signals check).
     * @return bool
     */
    private function has_open_finding( string $scanner_id, string $object_ref ): bool {
        return 0 < (int) $this->findings->find_all(
            array(
                'category'   => 'geo',
                'status'     => 'open',
                'scanner_id' => $scanner_id,
                'object_ref' => $object_ref,
                'per_page'   => 1,
            )
        )['total'];
    }

    /**
     * Coarse recency tiering off `post_modified_gmt`, scored on a 0-100 scale.
     *
     * @param \WP_Post $post Post being scored.
     * @return int 0-100.
     */
    private function calculate_content_freshness( \WP_Post $post ): int {
        $settings            = wp_parse_args( get_option( \VuloPilot\Utill::VULOPILOT_SETTINGS_KEY, array() ), \VuloPilot\Utill::VULOPILOT_SETTINGS_DEFAULTS );
        $stale_after_days    = absint( $settings['ai_visibility_scans']['freshness']['stale_months'] ?? 12 ) * 30;
        $days_since_modified = ( time() - strtotime( $post->post_modified_gmt ) ) / DAY_IN_SECONDS;

        if ( $days_since_modified <= $stale_after_days * 0.25 ) {
            return 100;
        }
        if ( $days_since_modified <= $stale_after_days * 0.5 ) {
            return 75;
        }
        if ( $days_since_modified <= $stale_after_days ) {
            return 50;
        }
        return 25;
    }

    /**
     * Scores evidence density using GeoCitationOpportunityScanner's claim regex, counting matches per 500 words against the "Evidence checks" setting's `ai_visibility_scans.evidence.min_data_points` threshold.
     *
     * @param \WP_Post $post Post being scored.
     * @return int 0-100.
     */
    private function calculate_evidence_density( \WP_Post $post ): int {
        $settings        = wp_parse_args( get_option( \VuloPilot\Utill::VULOPILOT_SETTINGS_KEY, array() ), \VuloPilot\Utill::VULOPILOT_SETTINGS_DEFAULTS );
        $min_data_points = max( 1, absint( $settings['ai_visibility_scans']['evidence']['min_data_points'] ?? 3 ) );

        $plain_text  = wp_strip_all_tags( $post->post_content );
        $word_count  = str_word_count( $plain_text );
        $match_count = preg_match_all( GeoCitationOpportunityScanner::CLAIM_PATTERN, $plain_text );
        $match_count = false !== $match_count ? $match_count : 0;

        $per_500_words = $word_count > 0 ? $match_count / ( $word_count / 500 ) : 0;

        if ( $per_500_words >= $min_data_points ) {
            return 100;
        }
        if ( $per_500_words >= $min_data_points / 2 ) {
            return 60;
        }
        return 20;
    }

    /**
     * The GEO analysis feature's input.
     *
     * @param \WP_Post $post                Post being analyzed.
     * @param int|null $deterministic_score Already-known deterministic score, if any.
     * @param array    $settings            Stored plugin settings.
     * @return array
     */
    private function build_context( \WP_Post $post, ?int $deterministic_score, array $settings ): array {
        $context = array(
            'title'   => $post->post_title,
            'content' => wp_strip_all_tags( $post->post_content ),
        );

        if ( null !== $deterministic_score ) {
            $context['deterministic_score'] = $deterministic_score;
        }

        // Settings → Scanning → AI Visibility's "Entity clarity" row.
        if ( ! empty( $settings['ai_visibility_scans']['entity']['enable'] ) ) {
            $context['entity_min_mentions'] = max( 1, absint( $settings['ai_visibility_scans']['entity']['min_mentions'] ?? 2 ) );
        }

        return $context;
    }

    /**
     * @param \VuloPilot\AiAssistant\AIResponse $response Raw AI response.
     * @return array
     * @throws \RuntimeException If the response isn't usable JSON in the expected shape.
     */
    private function parse_response( \VuloPilot\AiAssistant\AIResponse $response ): array {
        $content = preg_replace( '/^```(?:json)?\s*|\s*```$/', '', trim( $response->get_content() ) );
        $decoded = json_decode( trim( (string) $content ), true );

        if ( ! is_array( $decoded ) ) {
            throw new \RuntimeException( esc_html__( 'The AI did not return a usable GEO analysis.', 'vulopilot' ) );
        }

        $ai_scores = array();

        foreach ( array( 'entity_coverage', 'question_coverage', 'answer_completeness', 'llm_readability', 'purpose_clarity', 'conversation_readiness', 'knowledge_graph_coverage', 'answer_first_structure' ) as $key ) {
            $value = $decoded[ $key ] ?? null;

            if ( ! is_int( $value ) && ! ( is_numeric( $value ) && (string) (int) $value === (string) $value ) ) {
                throw new \RuntimeException(
                    sprintf(
                        /* translators: %s is the missing/invalid score dimension. */
                        esc_html__( 'The AI response is missing a valid "%s" score.', 'vulopilot' ),
                        esc_html( $key )
                    )
                );
            }

            $ai_scores[ $key ] = max( 0, min( 100, (int) $value ) );
        }

        $suggestions = array_values(
            array_filter(
                is_array( $decoded['suggestions'] ?? null ) ? $decoded['suggestions'] : array(),
                static fn( $suggestion ) => is_string( $suggestion ) && '' !== trim( $suggestion )
            )
        );

        if ( empty( $suggestions ) ) {
            throw new \RuntimeException( esc_html__( 'The AI did not return any suggestions.', 'vulopilot' ) );
        }

        return array(
            'ai_scores'   => $ai_scores,
            'suggestions' => $suggestions,
        );
    }

    /**
     * Simple, documented average.
     *
     * @param int|null $deterministic_score 0-100, or null.
     * @param array    $ai_scores           8 keys, each 0-100.
     * @param array    $sub_scores          6 keys, each 0-100 (calculate_sub_scores()'s return shape).
     * @return int 0-100.
     */
    private function calculate_overall_score( ?int $deterministic_score, array $ai_scores, array $sub_scores ): int {
        $ai_average  = array_sum( $ai_scores ) / count( $ai_scores );
        $sub_average = array_sum( $sub_scores ) / count( $sub_scores );

        $components = array( $ai_average, $sub_average );

        if ( null !== $deterministic_score ) {
            $components[] = $deterministic_score;
        }

        return (int) round( array_sum( $components ) / count( $components ) );
    }
}
