<?php
/**
 * Base REST controller file.
 *
 * @package VuloBackup
 */

namespace VuloBackup\Rest;

use VuloBackup\Jobs\Store;
use VuloBackup\Utill;

defined( 'ABSPATH' ) || exit;

/**
 * Shared by every VuloBackup route. There is no public route: each one requires an administrator
 * (a network administrator on multisite). WordPress's REST cookie authentication checks the
 * `wp_rest` nonce before the permission callback runs, so another site cannot make an
 * administrator's browser start, download or restore a backup.
 */
abstract class Controller extends \WP_REST_Controller {

	/**
	 * Checks that the current user may manage backups.
	 *
	 * @return bool|\WP_Error
	 */
	public function check_permission() {
		if ( ! Utill::can_manage() ) {
			return new \WP_Error( 'rest_forbidden', __( 'You are not allowed to manage backups.', 'vulobackup' ), array( 'status' => rest_authorization_required_code() ) );
		}

		return true;
	}

	/**
	 * Registers one route of this controller.
	 *
	 * @param string $path     Path after the namespace, starting with a slash.
	 * @param string $methods  HTTP methods.
	 * @param string $callback Method name on this controller.
	 * @return void
	 */
	protected function route( $path, $methods, $callback ) {
		register_rest_route(
			VuloBackup()->rest_namespace,
			$path,
			array(
				'methods'             => $methods,
				'callback'            => array( $this, $callback ),
				'permission_callback' => array( $this, 'check_permission' ),
			)
		);
	}

	/**
	 * Builds a "not found" error.
	 *
	 * @return \WP_Error A "not found" error.
	 */
	protected function not_found() {
		return new \WP_Error( 'vulobackup_not_found', __( 'That backup no longer exists.', 'vulobackup' ), array( 'status' => 404 ) );
	}

	/**
	 * A job as the admin screen sees it: display-ready, and without internal working state.
	 *
	 * @param array $job Job.
	 * @return array
	 */
	protected function view( array $job ) {
		$is_backup = Store::KIND_BACKUP === $job['kind'];
		$final     = in_array( $job['status'], Store::FINAL_STATUSES, true );
		$copies    = array();

		foreach ( (array) ( $job['copies'] ?? array() ) as $id => $copy ) {
			$copies[] = array(
				'id'     => (string) $id,
				'name'   => (string) ( $copy['name'] ?? '' ),
				'where'  => (string) ( $copy['where'] ?? '' ),
				'status' => (string) ( $copy['status'] ?? '' ),
				'error'  => (string) ( $copy['error'] ?? '' ),
			);
		}

		$view = array(
			'id'                  => $job['id'],
			'kind'                => $is_backup ? 'backup' : 'restore',
			'name'                => (string) ( $job['name'] ?? ( $job['backup_name'] ?? '' ) ),
			'status'              => $job['status'],
			'percent'             => (int) $job['percent'],
			'label'               => (string) $job['label'],
			'error'               => (string) $job['error'],
			'warnings'            => array_values( (array) $job['warnings'] ),
			'created_at'          => (string) $job['created_at'],
			'created_at_display'  => Utill::format_datetime( (string) $job['created_at'] ),
			'finished_at_display' => Utill::format_datetime( (string) $job['finished_at'] ),
			'is_final'            => $final,
		);

		if ( ! $is_backup ) {
			return array_merge(
				$view,
				array(
					'backup_id'  => (string) ( $job['backup_id'] ?? '' ),
					'components' => (array) ( $job['components'] ?? array() ),
					'changed'    => (string) ( $job['changed'] ?? 'nothing' ),
					'result'     => (array) ( $job['result'] ?? array() ),
					'migrated'   => (array) ( $job['migrated'] ?? array() ),
					'safety_id'  => (string) ( $job['safety_id'] ?? '' ),
				)
			);
		}

		$completed = 'completed' === $job['status'];
		$local     = ! empty( $job['local'] );
		$remote    = \VuloBackup\Backup\Retention::has_remote( $job );

		return array_merge(
			$view,
			array(
				'type'                => (string) $job['type'],
				'trigger'             => (string) $job['trigger'],
				'areas'               => array_values( (array) ( $job['options']['areas'] ?? array() ) ),
				'size'                => (int) ( $job['size'] ?? 0 ),
				'size_display'        => $completed ? Utill::size( (int) ( $job['size'] ?? 0 ) ) : '',
				'encrypted'           => ! empty( $job['encrypted'] ),
				'local'               => $local,
				'copies'              => $copies,
				'verified'            => ! empty( $job['verified'] ),
				'verified_at_display' => Utill::format_datetime( (string) ( $job['verified_at'] ?? '' ) ),
				'verify_problems'     => array_values( (array) ( $job['verify_problems'] ?? array() ) ),
				'from_site'           => 'import' === $job['trigger'] ? (string) ( $job['site']['home'] ?? '' ) : '',
				'made_at_display'     => 'import' === $job['trigger'] ? Utill::format_datetime( (string) ( $job['made_at'] ?? '' ) ) : '',
				'can_restore'         => $completed && ( $local || $remote ),
				'can_download'        => $completed && $local,
			)
		);
	}
}
