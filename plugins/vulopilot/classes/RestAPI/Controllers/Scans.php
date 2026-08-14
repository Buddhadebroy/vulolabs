<?php
/**
 * Scans controller file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\RestAPI\Controllers;

use VuloPilot\Repositories\ScanRepository;

defined( 'ABSPATH' ) || exit;

/**
 * GET /scans lists past scan runs; POST /scans triggers one synchronously
 * via VuloPilot()->scan_runner (Scanners\ScanRunner — already wired in
 * VuloPilot::init_classes()). Persistence of the result happens via
 * Services\ScanPersistenceListener's `vulopilot_scan_completed` hook, not
 * anything in this controller — it only asks the runner to run.
 *
 * @class       Scans controller
 * @version     1.0.0
 * @author      VuloLabs
 */
class Scans extends \WP_REST_Controller {

    /**
     * @var string
     */
    protected $rest_base = 'scans';

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
                    'methods'             => \WP_REST_Server::CREATABLE,
                    'callback'            => array( $this, 'create_item' ),
                    'permission_callback' => array( $this, 'create_item_permissions_check' ),
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
    public function create_item_permissions_check( $request ) {
        return current_user_can( 'manage_options' );
    }

    /**
     * @inheritDoc
     *
     * `scanner_id` (comma-separated, e.g. `ssl-monitoring` or
     * `core-file-integrity,integrity-monitoring`) plus `orderby`/`order` —
     * same `parse_comma_separated_list()` shape `create_item()` already uses
     * for `category` below, added so a tile that only cares about one
     * scanner group's own most recent run (e.g. "last scan time" on a
     * summary card) can ask for `?scanner_id=...&status=completed&
     * per_page=1&orderby=finished_at&order=desc` instead of paging through
     * every scan run to find it client-side.
     */
    public function get_items( $request ) {
        $repository  = new ScanRepository();
        $scanner_ids = $this->parse_comma_separated_list( $request->get_param( 'scanner_id' ) );

        return rest_ensure_response(
            $repository->find_all(
                array(
                    'page'       => absint( $request->get_param( 'page' ) ) ?: 1,
                    'per_page'   => absint( $request->get_param( 'per_page' ) ) ?: 20,
                    'status'     => sanitize_key( (string) $request->get_param( 'status' ) ),
                    'scanner_id' => $scanner_ids ?? '',
                    'orderby'    => sanitize_key( (string) $request->get_param( 'orderby' ) ),
                    'order'      => sanitize_key( (string) $request->get_param( 'order' ) ),
                )
            )
        );
    }

    /**
     * @inheritDoc
     *
     * `category` (comma-separated, e.g. `security,accessibility`) scopes
     * the run to just those categories via ScanRunner::run_category() —
     * a category page's own header "Run scan" button passes its own
     * category set here instead of always running every registered
     * scanner, same `parse_comma_separated_list` shape
     * Findings::get_items()'s own `category`/`scanner_id` params already
     * use. Takes precedence over `scanner_id` when both are present;
     * omitting `category` keeps every existing caller (Dashboard's Run
     * Audit widget, Health.tsx's own "Run scan") working exactly as
     * before.
     */
    public function create_item( $request ) {
        $categories = $this->parse_comma_separated_list( $request->get_param( 'category' ) );

        if ( $categories ) {
            $results = array();

            foreach ( $categories as $category ) {
                $results += VuloPilot()->scan_runner->run_category( $category );
            }
        } else {
            $scanner_id = sanitize_key( (string) $request->get_param( 'scanner_id' ) );

            if ( '' === $scanner_id || 'all' === $scanner_id ) {
                $results = VuloPilot()->scan_runner->run_all();
            } else {
                $results = array( $scanner_id => VuloPilot()->scan_runner->run( $scanner_id ) );
            }
        }

        $failed = array_filter(
            $results,
            static fn( $result ) => null === $result || \VuloPilot\ValueObjects\ScanResult::STATUS_FAILED === $result->get_status()
        );

        if ( count( $failed ) === count( $results ) && count( $results ) > 0 ) {
            return new \WP_Error(
                'vulopilot_scan_failed',
                __( 'The scan could not be completed.', 'vulopilot' ),
                array( 'status' => 500 )
            );
        }

        return rest_ensure_response(
            array(
                'success'     => true,
                'scanner_ids' => array_keys( $results ),
            )
        );
    }

    /**
     * Same shape as Findings::parse_comma_separated_list() — a single
     * value (no comma) still round-trips correctly as a one-element array.
     *
     * @param mixed $raw_param Raw comma-separated request param.
     * @return string[]|null Sanitized values, or null when the param was empty/absent.
     */
    private function parse_comma_separated_list( $raw_param ): ?array {
        if ( empty( $raw_param ) ) {
            return null;
        }

        $values = array_filter( array_map( 'sanitize_key', explode( ',', (string) $raw_param ) ) );

        return $values ? array_values( $values ) : null;
    }
}
