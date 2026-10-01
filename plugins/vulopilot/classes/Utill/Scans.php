<?php
namespace VuloPilot\Utill;

defined( 'ABSPATH' ) || exit;

/**
 * GET /scans lists past scan runs; POST /scans triggers one synchronously via
 * VuloPilot()->scan_runner (ScanRunner - already wired in VuloPilot::init_classes()).
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
	 * Accepts comma-separated `scanner_id` and/or `category` params (merged together)
	 * plus `orderby`/`order`, so callers can scope results without paging client-side.
	 */
	public function get_items( $request ) {
		$repository  = new ScanRepository();
		$scanner_ids = $this->parse_comma_separated_list( $request->get_param( 'scanner_id' ) ) ?? array();
		$categories  = $this->parse_comma_separated_list( $request->get_param( 'category' ) );

		if ( $categories ) {
			$registry = new ScannerRegistry();

			foreach ( $categories as $category ) {
				$scanner_ids = array_merge( $scanner_ids, array_keys( $registry->get_scanners_by_category( $category ) ) );
			}
		}

		$scanner_ids = array_values( array_unique( $scanner_ids ) );

		return rest_ensure_response(
			$repository->find_all(
				array(
					'page'       => absint( $request->get_param( 'page' ) ) ? absint( $request->get_param( 'page' ) ) : 1,
					'per_page'   => absint( $request->get_param( 'per_page' ) ) ? absint( $request->get_param( 'per_page' ) ) : 20,
					'status'     => sanitize_key( (string) $request->get_param( 'status' ) ),
					'scanner_id' => $scanner_ids ? $scanner_ids : '',
					'orderby'    => sanitize_key( (string) $request->get_param( 'orderby' ) ),
					'order'      => sanitize_key( (string) $request->get_param( 'order' ) ),
				)
			)
		);
	}

	/**
	 * @inheritDoc
	 *
	 * Comma-separated `category` scopes the run via ScanRunner::run_category() and takes
	 * precedence over `scanner_id`. Treated as a forced, user-initiated run unless the
	 * caller sends `trigger_type=scheduled`, so rate-limited scanners still run on demand.
	 */
	public function create_item( $request ) {
		$force      = 'scheduled' !== sanitize_key( (string) $request->get_param( 'trigger_type' ) );
		$categories = $this->parse_comma_separated_list( $request->get_param( 'category' ) );

		if ( $categories ) {
			$results = array();

			foreach ( $categories as $category ) {
				$results += VuloPilot()->scan_runner->run_category( $category, $force );
			}
		} else {
			$scanner_id = sanitize_key( (string) $request->get_param( 'scanner_id' ) );

			if ( '' === $scanner_id || 'all' === $scanner_id ) {
				$results = VuloPilot()->scan_runner->run_all( $force );
			} else {
				$results = array( $scanner_id => VuloPilot()->scan_runner->run( $scanner_id, $force ) );
			}
		}

		$failed = array_filter(
			$results,
			static fn( $result ) => null === $result || \VuloPilot\Utill\ScanResult::STATUS_FAILED === $result->get_status()
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
	 * Parses a comma-separated request param.
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
