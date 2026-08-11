<?php
/**
 * CoreWebVitalsBeaconRest controller file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\RestAPI\Controllers;

use VuloPilot\Repositories\CoreWebVitalsRepository;

defined( 'ABSPATH' ) || exit;

/**
 * `POST /performance-vitals-beacon` — this codebase's first public,
 * anonymous REST route (confirmed via a full audit: every other
 * `permission_callback` in this plugin is `current_user_can('manage_options')`).
 * Called by real visitors' browsers (public/js/performance-vitals-beacon.js,
 * enqueued by Services\CoreWebVitalsBeacon), so it can't use a nonce the
 * way every logged-in-admin route here does — every value is sanitized
 * and range-clamped rather than trusted, and the whole endpoint is
 * rate-limited by a single global rolling-window counter (deliberately
 * **not** keyed on the visitor's IP — this codebase has twice already
 * promised never to log or key anything on IP, see
 * Services\CrawlerTrafficLogger's and Services\PerformanceRequestLogger's
 * own docblocks).
 *
 * @class       CoreWebVitalsBeaconRest controller
 * @version     1.0.0
 * @author      VuloLabs
 */
class CoreWebVitalsBeaconRest extends \WP_REST_Controller {

    /**
     * REST base for this controller's routes.
     *
     * @var string
     */
    protected $rest_base = 'performance-vitals-beacon';

    private const RATE_LIMIT_KEY = 'vulopilot_cwv_beacon_rl';

    private const RATE_LIMIT_WINDOW_SECONDS = 5 * MINUTE_IN_SECONDS;

    private const RATE_LIMIT_MAX = 1000;

    /**
     * A metric outside this range (ms) is treated as unmeasured rather
     * than trusted — a real LCP/INP is never a full minute.
     */
    private const MAX_MS = 60000;

    /**
     * CLS ×1000 — a real CLS is essentially never above 10.0.
     */
    private const MAX_CLS_THOUSANDTHS = 10000;

    /**
     * Registers POST /performance-vitals-beacon.
     *
     * @inheritDoc
     */
    public function register_routes() {
        register_rest_route(
            VuloPilot()->rest_namespace,
            '/' . $this->rest_base,
            array(
                array(
                    'methods'             => \WP_REST_Server::CREATABLE,
                    'callback'            => array( $this, 'create_item' ),
                    'permission_callback' => '__return_true',
                ),
            )
        );
    }

    /**
     * @param \WP_REST_Request $request Full request object.
     * @return \WP_REST_Response|\WP_Error
     */
    public function create_item( $request ) {
        if ( ! $this->consume_rate_limit_slot() ) {
            return new \WP_Error( 'vulopilot_rate_limited', __( 'Too many requests.', 'vulopilot' ), array( 'status' => 429 ) );
        }

        $lcp_ms          = $this->sanitize_ms( $request->get_param( 'lcp_ms' ) );
        $inp_ms          = $this->sanitize_ms( $request->get_param( 'inp_ms' ) );
        $cls_thousandths = $this->sanitize_cls( $request->get_param( 'cls_thousandths' ) );

        if ( null === $lcp_ms && null === $inp_ms && null === $cls_thousandths ) {
            return new \WP_Error( 'vulopilot_no_metrics', __( 'No usable metrics in this request.', 'vulopilot' ), array( 'status' => 400 ) );
        }

        ( new CoreWebVitalsRepository() )->record( $lcp_ms, $cls_thousandths, $inp_ms );

        return rest_ensure_response( array( 'recorded' => true ) );
    }

    /**
     * @param mixed $value Raw request value.
     * @return int|null
     */
    private function sanitize_ms( $value ): ?int {
        if ( ! is_numeric( $value ) ) {
            return null;
        }

        $ms = (int) round( (float) $value );

        return ( $ms >= 0 && $ms <= self::MAX_MS ) ? $ms : null;
    }

    /**
     * @param mixed $value Raw request value (already ×1000 from the client).
     * @return int|null
     */
    private function sanitize_cls( $value ): ?int {
        if ( ! is_numeric( $value ) ) {
            return null;
        }

        $thousandths = (int) round( (float) $value );

        return ( $thousandths >= 0 && $thousandths <= self::MAX_CLS_THOUSANDTHS ) ? $thousandths : null;
    }

    /**
     * A single sitewide rolling-window counter — global rather than
     * per-visitor since this endpoint deliberately has no visitor
     * identifier of any kind to key a per-visitor limit on.
     *
     * @return bool True if this request may proceed, false if rate-limited.
     */
    private function consume_rate_limit_slot(): bool {
        $now   = time();
        $state = get_transient( self::RATE_LIMIT_KEY );

        if ( ! is_array( $state ) || ! isset( $state['resets_at'] ) || $now >= $state['resets_at'] ) {
            $state = array(
                'count'     => 0,
                'resets_at' => $now + self::RATE_LIMIT_WINDOW_SECONDS,
            );
        }

        if ( $state['count'] >= self::RATE_LIMIT_MAX ) {
            return false;
        }

        ++$state['count'];
        set_transient( self::RATE_LIMIT_KEY, $state, self::RATE_LIMIT_WINDOW_SECONDS );

        return true;
    }
}
