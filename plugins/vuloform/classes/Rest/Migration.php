<?php
/**
 * Migration REST controller file.
 *
 * @package VuloForm
 */

namespace VuloForm\Rest;

use VuloForm\Migration\MigrationManager;

defined( 'ABSPATH' ) || exit;

/**
 * vuloform/v1/migration - detect forms in other plugins and import them. Mirrors VuloPilot's own
 * `/migration/sources` + `/migration/run` pair (its SEO-plugin migration tab).
 */
class Migration extends Controller {

	/**
	 * @var MigrationManager
	 */
	private $manager;

	public function __construct() {
		$this->manager = new MigrationManager();
	}

	/**
	 * @inheritDoc
	 */
	public function register_routes() {
		$this->route( '/migration/sources', \WP_REST_Server::READABLE, 'get_sources' );
		$this->route( '/migration/run', \WP_REST_Server::CREATABLE, 'run_migration' );
		$this->route( '/migration/deactivate-source', \WP_REST_Server::CREATABLE, 'deactivate_source' );
	}

	/**
	 * @param \WP_REST_Request $request Request.
	 * @return \WP_REST_Response
	 */
	public function get_sources( $request ) {
		return rest_ensure_response( array( 'data' => $this->manager->list_sources() ) );
	}

	/**
	 * @param \WP_REST_Request $request Request.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function run_migration( $request ) {
		$input     = (array) $request->get_json_params();
		$source    = sanitize_key( (string) ( $input['source'] ?? '' ) );
		$overwrite = ! empty( $input['overwrite'] );
		$form_ids  = array_map( 'sanitize_text_field', (array) ( $input['form_ids'] ?? array() ) );
		$migrator  = $this->manager->get_migrator( $source );

		if ( ! $migrator ) {
			return new \WP_Error( 'vuloform_unknown_migration_source', __( 'Unknown migration source.', 'vuloform' ), array( 'status' => 400 ) );
		}

		return rest_ensure_response( $migrator->migrate( $form_ids, $overwrite ) );
	}

	/**
	 * Deactivates the source plugin a migration was just run for, once the user opts in from the
	 * "migration successful" notice. Requires `activate_plugins`, same as the plugins screen itself.
	 *
	 * @param \WP_REST_Request $request Request.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function deactivate_source( $request ) {
		if ( ! current_user_can( 'activate_plugins' ) ) {
			return new \WP_Error( 'vuloform_cannot_deactivate_plugin', __( 'You are not allowed to deactivate plugins.', 'vuloform' ), array( 'status' => 403 ) );
		}

		$input  = (array) $request->get_json_params();
		$source = sanitize_key( (string) ( $input['source'] ?? '' ) );

		if ( ! $this->manager->get_migrator( $source ) ) {
			return new \WP_Error( 'vuloform_unknown_migration_source', __( 'Unknown migration source.', 'vuloform' ), array( 'status' => 400 ) );
		}

		if ( ! function_exists( 'deactivate_plugins' ) ) {
			require_once ABSPATH . 'wp-admin/includes/plugin.php';
		}

		$deactivated = $this->manager->deactivate_source_plugin( $source );

		if ( ! $deactivated ) {
			return new \WP_Error( 'vuloform_plugin_already_inactive', __( 'That plugin is already inactive.', 'vuloform' ), array( 'status' => 400 ) );
		}

		return rest_ensure_response( array( 'deactivated' => true ) );
	}
}
