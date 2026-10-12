<?php
/**
 * Backups REST controller file.
 *
 * @package VuloBackup
 */

namespace VuloBackup\Rest;

use VuloBackup\Backup\Bundle;
use VuloBackup\Backup\Manifest;
use VuloBackup\Backup\Retention;
use VuloBackup\Backup\Verifier;
use VuloBackup\Jobs\Store;
use VuloBackup\Logging\Logger;
use VuloBackup\Security\PathGuard;
use VuloBackup\Utill;

defined( 'ABSPATH' ) || exit;

/**
 * REST route vulobackup/v1/backups - create, list, inspect, verify, download, import and delete
 * backups, and the route the admin screen calls to move the running job forward.
 */
class Backups extends Controller {

	/**
	 * Registers this controller's routes.
	 *
	 * @return void
	 */
	public function register_routes() {
		$id = '(?P<id>[a-z0-9\-]{6,48})';

		$this->route( '/backups', \WP_REST_Server::READABLE, 'get_items' );
		$this->route( '/backups', \WP_REST_Server::CREATABLE, 'create_item' );
		$this->route( '/backups/import', \WP_REST_Server::CREATABLE, 'import' );
		$this->route( '/backups/' . $id, \WP_REST_Server::READABLE, 'get_item' );
		$this->route( '/backups/' . $id, \WP_REST_Server::DELETABLE, 'delete_item' );
		$this->route( '/backups/' . $id . '/cancel', \WP_REST_Server::CREATABLE, 'cancel' );
		$this->route( '/backups/' . $id . '/verify', \WP_REST_Server::CREATABLE, 'verify' );
		$this->route( '/backups/' . $id . '/download', \WP_REST_Server::READABLE, 'download' );
		$this->route( '/jobs/run', \WP_REST_Server::CREATABLE, 'run' );
	}

	/**
	 * Lists backups, newest first.
	 *
	 * @param \WP_REST_Request $request Request.
	 * @return \WP_REST_Response
	 */
	public function get_items( $request ) {
		$search = strtolower( trim( sanitize_text_field( (string) $request->get_param( 'search' ) ) ) );
		$status = sanitize_key( (string) $request->get_param( 'status' ) );
		$all    = VuloBackup()->jobs->all( Store::KIND_BACKUP );
		$counts = array(
			'all'       => count( $all ),
			'completed' => 0,
			'failed'    => 0,
			'running'   => 0,
		);
		$rows   = array();

		foreach ( $all as $job ) {
			$group = 'completed' === $job['status'] ? 'completed' : ( in_array( $job['status'], array( 'failed', 'cancelled' ), true ) ? 'failed' : 'running' );

			++$counts[ $group ];

			if ( '' !== $status && 'all' !== $status && $group !== $status ) {
				continue;
			}

			if ( '' !== $search && false === strpos( strtolower( $job['name'] . ' ' . $job['id'] ), $search ) ) {
				continue;
			}

			$rows[] = $this->view( $job );
		}

		$per_page = max( 1, min( 100, absint( $request->get_param( 'per_page' ) ) ?: 10 ) ); // phpcs:ignore Universal.Operators.DisallowShortTernary.Found
		$page     = max( 1, absint( $request->get_param( 'page' ) ) );

		return rest_ensure_response(
			array(
				'data'   => array_slice( $rows, ( $page - 1 ) * $per_page, $per_page ),
				'total'  => count( $rows ),
				'counts' => $counts,
			)
		);
	}

	/**
	 * Returns one backup with what it holds and its log.
	 *
	 * @param \WP_REST_Request $request Request.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function get_item( $request ) {
		$job = VuloBackup()->jobs->get( Store::KIND_BACKUP, (string) $request['id'] );

		if ( ! $job ) {
			return $this->not_found();
		}

		$directory = VuloBackup()->jobs->dir( $job );
		$manifest  = 'completed' === $job['status'] ? Manifest::read( $directory ) : null;
		$view      = $this->view( $job );

		$view['log']      = Logger::read( $directory . '/log.jsonl', 200 );
		$view['manifest'] = null;

		if ( is_array( $manifest ) ) {
			$view['manifest'] = array(
				'site'           => $manifest['site'],
				'plugin_version' => $manifest['plugin_version'],
				'database'       => $manifest['database']
					? array(
						'tables' => $manifest['database']['tables'],
						'rows'   => $manifest['database']['rows'],
					)
					: null,
				'files'          => $manifest['files']
					? array(
						'count'         => $manifest['files']['count'],
						'bytes_display' => Utill::size( $manifest['files']['bytes'] ),
						'by_area'       => $manifest['files']['by_area'],
						'skipped'       => $manifest['files']['skipped'],
					)
					: null,
				'parts'          => array_map(
					static function ( $part ) {
						return array(
							'name'          => $part['name'],
							'bytes_display' => Utill::size( $part['bytes'] ),
							'sha256'        => $part['sha256'],
						);
					},
					$manifest['parts']
				),
			);
		} elseif ( is_wp_error( $manifest ) ) {
			$view['error'] = $manifest->get_error_message();
		}

		return rest_ensure_response( $view );
	}

	/**
	 * Starts a backup.
	 *
	 * @param \WP_REST_Request $request Request.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function create_item( $request ) {
		$input = (array) $request->get_json_params();
		$job   = VuloBackup()->runner->start_backup(
			array(
				'type'  => sanitize_key( (string) ( $input['type'] ?? 'full' ) ),
				'areas' => isset( $input['areas'] ) && is_array( $input['areas'] ) ? array_map( 'sanitize_key', $input['areas'] ) : null,
				'name'  => (string) ( $input['name'] ?? '' ),
			)
		);

		return is_wp_error( $job ) ? $job : rest_ensure_response( $this->view( $job ) );
	}

	/**
	 * Moves the running job forward by one slice and reports where it is. The admin screen calls
	 * this in a loop while a job is running.
	 *
	 * @return \WP_REST_Response
	 */
	public function run() {
		$result = VuloBackup()->runner->tick( true );

		return rest_ensure_response(
			array(
				'job'  => $result['job'] ? $this->view( $result['job'] ) : null,
				'busy' => $result['busy'],
			)
		);
	}

	/**
	 * Cancels a running backup.
	 *
	 * @param \WP_REST_Request $request Request.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function cancel( $request ) {
		$job = VuloBackup()->jobs->get( Store::KIND_BACKUP, (string) $request['id'] );

		if ( ! $job ) {
			return $this->not_found();
		}

		$job = VuloBackup()->runner->cancel( $job );

		return is_wp_error( $job ) ? $job : rest_ensure_response( $this->view( $job ) );
	}

	/**
	 * Checks a backup against its manifest. Called repeatedly until `done` is true.
	 *
	 * @param \WP_REST_Request $request Request.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function verify( $request ) {
		$jobs = VuloBackup()->jobs;
		$job  = $jobs->get( Store::KIND_BACKUP, (string) $request['id'] );

		if ( ! $job || 'completed' !== $job['status'] ) {
			return $this->not_found();
		}

		$input = (array) $request->get_json_params();
		$state = empty( $input['restart'] ) && isset( $job['verify_state'] ) && is_array( $job['verify_state'] ) ? $job['verify_state'] : array();
		$done  = ( new Verifier() )->run( $job, $state, microtime( true ) + (int) VuloBackup()->settings->get( 'step_seconds' ) );

		if ( ! $done ) {
			$job['verify_state'] = $state;
			$jobs->save( $job );

			return rest_ensure_response(
				array(
					'done' => false,
					'job'  => $this->view( $job ),
				)
			);
		}

		$job = Verifier::record( $job, $state );

		return rest_ensure_response(
			array(
				'done'     => true,
				'problems' => $state['problems'],
				'checked'  => $state['checked'],
				'job'      => $this->view( $job ),
			)
		);
	}

	/**
	 * Deletes a backup: everywhere, from this server only, or from one remote destination only.
	 *
	 * @param \WP_REST_Request $request Request.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function delete_item( $request ) {
		$jobs = VuloBackup()->jobs;
		$job  = $jobs->get( Store::KIND_BACKUP, (string) $request['id'] );

		if ( ! $job ) {
			return $this->not_found();
		}

		if ( ! in_array( $job['status'], Store::FINAL_STATUSES, true ) ) {
			return new \WP_Error( 'vulobackup_busy', __( 'This backup is still running. Cancel it first.', 'vulobackup' ), array( 'status' => 409 ) );
		}

		$active = $jobs->active();

		if ( $active && Store::KIND_RESTORE === $active['kind'] && ( $active['backup_id'] ?? '' ) === $job['id'] ) {
			return new \WP_Error( 'vulobackup_busy', __( 'This backup is being restored right now.', 'vulobackup' ), array( 'status' => 409 ) );
		}

		$input  = (array) $request->get_json_params();
		$scope  = (string) ( $input['scope'] ?? 'all' );
		$failed = array();

		if ( 'local' !== $scope ) {
			foreach ( (array) ( $job['copies'] ?? array() ) as $id => $copy ) {
				if ( 'uploaded' !== ( $copy['status'] ?? '' ) || ( 'all' !== $scope && $scope !== $id ) ) {
					continue;
				}

				$result = Retention::delete_remote( $job, (string) $id );
				$job    = $jobs->get( Store::KIND_BACKUP, $job['id'] );

				if ( is_wp_error( $result ) ) {
					$failed[] = $copy['name'] . ': ' . $result->get_error_message();
				}

				if ( ! $job ) {
					break;
				}
			}
		}

		if ( $failed ) {
			return new \WP_Error(
				'vulobackup_storage',
				/* translators: %s: errors from the storage services. */
				sprintf( __( 'The copy at a remote destination could not be deleted, so the backup was kept. %s', 'vulobackup' ), implode( ' ', $failed ) ),
				array( 'status' => 502 )
			);
		}

		if ( $job && ( 'all' === $scope || 'local' === $scope ) ) {
			if ( 'all' === $scope || ! Retention::has_remote( $job ) ) {
				$jobs->delete( Store::KIND_BACKUP, $job['id'] );
			} else {
				Retention::delete_local( $job );
			}
		}

		VuloBackup()->logger->log(
			Logger::LEVEL_INFO,
			'backup_deleted',
			/* translators: %s: backup name. */
			sprintf( __( 'Backup "%s" was deleted by an administrator.', 'vulobackup' ), (string) $request['id'] ),
			array( 'job' => (string) $request['id'] )
		);

		return rest_ensure_response( array( 'deleted' => true ) );
	}

	/**
	 * Sends a backup to the browser as one zip file.
	 *
	 * @param \WP_REST_Request $request Request.
	 * @return \WP_Error|void
	 */
	public function download( $request ) {
		$job = VuloBackup()->jobs->get( Store::KIND_BACKUP, (string) $request['id'] );

		if ( ! $job || 'completed' !== $job['status'] ) {
			return $this->not_found();
		}

		$entries = Bundle::entries( $job );

		if ( is_wp_error( $entries ) ) {
			return $entries;
		}

		VuloBackup()->logger->log(
			Logger::LEVEL_INFO,
			'backup_downloaded',
			/* translators: %s: backup name. */
			sprintf( __( 'Backup "%s" was downloaded by an administrator.', 'vulobackup' ), $job['name'] ),
			array( 'job' => $job['id'] )
		);

		if ( function_exists( 'set_time_limit' ) ) {
			@set_time_limit( 0 ); // phpcs:ignore WordPress.PHP.NoSilencedErrors.Discouraged, Squiz.PHP.DiscouragedFunctions.Discouraged -- a large download; refused on some hosts.
		}

		while ( ob_get_level() > 0 ) {
			ob_end_clean();
		}

		nocache_headers();
		header( 'Content-Type: application/zip' );
		header( 'Content-Disposition: attachment; filename="' . Bundle::filename( $job ) . '"' );
		header( 'Content-Length: ' . Bundle::size( $entries ) );
		header( 'X-Content-Type-Options: nosniff' );

		$out = fopen( 'php://output', 'wb' ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fopen -- streaming a download.

		Bundle::write( $entries, $out );
		fclose( $out ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fclose
		exit;
	}

	/**
	 * Receives a backup file in pieces and, with the last piece, imports it.
	 *
	 * The browser cuts the file into pieces so that it fits under the server's upload limit. Each
	 * piece must continue exactly where the previous one ended.
	 *
	 * @param \WP_REST_Request $request Request.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function import( $request ) {
		$vault = VuloBackup()->vault;

		if ( ! $vault->ensure() ) {
			return new \WP_Error( 'vulobackup_storage', __( 'The backup folder is not writable.', 'vulobackup' ), array( 'status' => 500 ) );
		}

		$upload = sanitize_key( (string) $request->get_param( 'upload' ) );
		$offset = max( 0, (int) $request->get_param( 'offset' ) );
		$total  = max( 0, (float) $request->get_param( 'total' ) );
		$files  = $request->get_file_params();
		$chunk  = isset( $files['chunk'] ) && is_array( $files['chunk'] ) ? $files['chunk'] : null;

		if ( ! $chunk || UPLOAD_ERR_OK !== (int) $chunk['error'] || ! is_uploaded_file( $chunk['tmp_name'] ) ) {
			return new \WP_Error( 'vulobackup_import', __( 'The upload did not arrive. The file may be larger than this server accepts in one piece.', 'vulobackup' ), array( 'status' => 400 ) );
		}

		if ( 0 === $offset ) {
			$free = $vault->free_space();

			if ( null !== $free && $total > 0 && $free < $total * 2 + 10 * 1024 * 1024 ) {
				return new \WP_Error( 'vulobackup_import', __( 'There is not enough disk space to import this backup.', 'vulobackup' ), array( 'status' => 400 ) );
			}

			$upload = bin2hex( random_bytes( 8 ) );
		}

		if ( ! preg_match( '/^[a-f0-9]{16}$/', $upload ) ) {
			return new \WP_Error( 'vulobackup_import', __( 'The upload could not be continued. Start it again.', 'vulobackup' ), array( 'status' => 400 ) );
		}

		$path = $vault->tmp_dir() . '/upload-' . $upload . '.part';
		$size = file_exists( $path ) ? (int) filesize( $path ) : 0;

		if ( $offset !== $size ) {
			return new \WP_Error( 'vulobackup_import', __( 'The upload could not be continued. Start it again.', 'vulobackup' ), array( 'status' => 409 ) );
		}

		$in  = fopen( $chunk['tmp_name'], 'rb' ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fopen
		$out = fopen( $path, 'ab' ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fopen

		if ( ! $in || ! $out || false === stream_copy_to_stream( $in, $out ) ) {
			return new \WP_Error( 'vulobackup_import', __( 'The upload could not be saved. The disk may be full.', 'vulobackup' ), array( 'status' => 500 ) );
		}

		fclose( $in ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fclose
		fclose( $out ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fclose
		clearstatcache( true, $path );

		if ( ! rest_sanitize_boolean( $request->get_param( 'last' ) ) ) {
			return rest_ensure_response(
				array(
					'upload' => $upload,
					'offset' => (int) filesize( $path ),
				)
			);
		}

		$job = Bundle::import( $path );

		wp_delete_file( $path );

		return is_wp_error( $job ) ? $job : rest_ensure_response( array( 'job' => $this->view( $job ) ) );
	}
}
