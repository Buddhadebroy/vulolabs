<?php
/**
 * Rest class file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\Migration;

defined( 'ABSPATH' ) || exit;

/**
 * `/migration/sources` (list detected plugins + found-data counts) and
 * `/migration/run` (import one of them) - backs the Settings → Migration tab.
 *
 * @class       Rest class
 * @version     1.0.0
 * @author      VuloLabs
 */
class Rest extends \WP_REST_Controller {

	/**
	 * @var string
	 */
	protected $rest_base = 'migration';

	/**
	 * @var MigrationManager
	 */
	private MigrationManager $manager;

	/**
	 * Rest constructor.
	 */
	public function __construct() {
		$this->manager = new MigrationManager();
	}

	/**
	 * @inheritDoc
	 */
	public function register_routes() {
		register_rest_route(
			VuloPilot()->rest_namespace,
			'/' . $this->rest_base . '/sources',
			array(
				array(
					'methods'             => \WP_REST_Server::READABLE,
					'callback'            => array( $this, 'get_sources' ),
					'permission_callback' => array( $this, 'permissions_check' ),
				),
			)
		);

		register_rest_route(
			VuloPilot()->rest_namespace,
			'/' . $this->rest_base . '/run',
			array(
				array(
					'methods'             => \WP_REST_Server::CREATABLE,
					'callback'            => array( $this, 'run_migration' ),
					'permission_callback' => array( $this, 'permissions_check' ),
					'args'                => array(
						'source'    => array(
							'type'     => 'string',
							'required' => true,
						),
						'overwrite' => array(
							'type'    => 'boolean',
							'default' => false,
						),
					),
				),
			)
		);
	}

	/**
	 * @inheritDoc
	 */
	public function permissions_check( $request ) {
		return current_user_can( 'manage_options' );
	}

	/**
	 * @param \WP_REST_Request $request Request.
	 * @return \WP_REST_Response
	 */
	public function get_sources( $request ) {
		return rest_ensure_response(
			array(
				'data' => $this->manager->list_sources(),
			)
		);
	}

	/**
	 * @param \WP_REST_Request $request Request.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function run_migration( $request ) {
		$source    = (string) $request->get_param( 'source' );
		$overwrite = (bool) $request->get_param( 'overwrite' );
		$migrator  = $this->manager->get_migrator( $source );

		if ( ! $migrator ) {
			return new \WP_Error(
				'vulopilot_unknown_migration_source',
				__( 'Unknown migration source.', 'vulopilot' ),
				array( 'status' => 400 )
			);
		}

		return rest_ensure_response( $migrator->migrate( $overwrite ) );
	}
}
