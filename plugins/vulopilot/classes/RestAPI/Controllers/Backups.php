<?php
/**
 * Backups controller file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\RestAPI\Controllers;

use VuloPilot\Repositories\BackupRepository;

defined( 'ABSPATH' ) || exit;

/**
 * `GET /backups` lists real backup runs; `POST /backups` starts a real
 * manual backup (never runs synchronously — `VuloPilot()->backup_manager`
 * processes it via WP-Cron in small batches, same "GET lists, POST
 * triggers, persistence happens elsewhere" shape `Scans.php`/`PageSpeed.php`
 * already use); `GET /backups/{id}/download` streams the real archive
 * through this permission-checked handler rather than ever exposing
 * `file_path` to the client, same posture `Reports.php::download_item()`
 * already established; `DELETE /backups/{id}` removes the real row + real
 * file; `POST /backups/{id}/restore` is Recovery's real, destructive
 * restore — always preceded here by a real, synchronously-completed
 * pre-restore safety snapshot before `BackupManager::restore()` is ever
 * called (Recovery's first of three safety nets; the second — a typed
 * confirmation gate — lives in the frontend; the third is
 * `BackupManager::restore()`'s own real activity-log audit entry).
 *
 * @class       Backups controller
 * @version     1.0.0
 * @author      VuloLabs
 */
class Backups extends \WP_REST_Controller {

    /**
     * @var string
     */
    protected $rest_base = 'backups';

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

        register_rest_route(
            VuloPilot()->rest_namespace,
            '/' . $this->rest_base . '/(?P<id>\d+)',
            array(
                array(
                    'methods'             => \WP_REST_Server::DELETABLE,
                    'callback'            => array( $this, 'delete_item' ),
                    'permission_callback' => array( $this, 'create_item_permissions_check' ),
                ),
            )
        );

        register_rest_route(
            VuloPilot()->rest_namespace,
            '/' . $this->rest_base . '/(?P<id>\d+)/download',
            array(
                array(
                    'methods'             => \WP_REST_Server::READABLE,
                    'callback'            => array( $this, 'download_item' ),
                    'permission_callback' => array( $this, 'get_items_permissions_check' ),
                ),
            )
        );

        register_rest_route(
            VuloPilot()->rest_namespace,
            '/' . $this->rest_base . '/(?P<id>\d+)/restore',
            array(
                array(
                    'methods'             => \WP_REST_Server::CREATABLE,
                    'callback'            => array( $this, 'restore_item' ),
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
     */
    public function get_items( $request ) {
        $repository = new BackupRepository();

        $result = $repository->find_all(
            array(
                'page'         => absint( $request->get_param( 'page' ) ) ?: 1,
                'per_page'     => absint( $request->get_param( 'per_page' ) ) ?: 20,
                'status'       => sanitize_key( (string) $request->get_param( 'status' ) ),
                'trigger_type' => sanitize_key( (string) $request->get_param( 'trigger_type' ) ),
                'orderby'      => sanitize_key( (string) $request->get_param( 'orderby' ) ) ?: 'id',
                'order'        => sanitize_key( (string) $request->get_param( 'order' ) ) ?: 'desc',
            )
        );

        // file_path is deliberately never exposed to the client — same
        // DATABASE.md posture Reports.php::get_items() already established.
        $result['data'] = array_map(
            static function ( array $row ): array {
                $row['has_file'] = ! empty( $row['file_path'] );
                unset( $row['file_path'] );
                return $row;
            },
            $result['data']
        );

        return rest_ensure_response( $result );
    }

    /**
     * Starts a real manual backup — never runs synchronously.
     *
     * @param \WP_REST_Request $request Full request object.
     * @return \WP_REST_Response
     */
    public function create_item( $request ) {
        $backup_id = VuloPilot()->backup_manager->start_backup( 'manual' );

        return rest_ensure_response(
            array(
                'success' => true,
                'id'      => $backup_id,
            )
        );
    }

    /**
     * Deletes a real backup row and its real file.
     *
     * @param \WP_REST_Request $request Full request object.
     * @return \WP_REST_Response|\WP_Error
     */
    public function delete_item( $request ) {
        $id         = absint( $request->get_param( 'id' ) );
        $repository = new BackupRepository();
        $backup     = $repository->find( $id );

        if ( ! $backup ) {
            return new \WP_Error( 'vulopilot_backup_not_found', __( 'Backup not found.', 'vulopilot' ), array( 'status' => 404 ) );
        }

        if ( ! empty( $backup['file_path'] ) ) {
            $file_path = VuloPilot()->backup_manager->resolve_file_path( (string) $backup['file_path'] );

            if ( file_exists( $file_path ) ) {
                // phpcs:ignore WordPress.WP.AlternativeFunctions.unlink -- deleting VuloPilot's own controlled backup file, not arbitrary user input.
                unlink( $file_path );
            }
        }

        $repository->delete( $id );

        return rest_ensure_response( array( 'success' => true ) );
    }

    /**
     * Streams a real backup archive rather than ever returning its
     * filesystem path to the client — same posture
     * `Reports.php::download_item()` already established.
     *
     * @param \WP_REST_Request $request Full request object.
     * @return \WP_REST_Response|void
     */
    public function download_item( $request ) {
        $id         = absint( $request->get_param( 'id' ) );
        $repository = new BackupRepository();
        $backup     = $repository->find( $id );

        if ( ! $backup ) {
            return new \WP_Error( 'vulopilot_backup_not_found', __( 'Backup not found.', 'vulopilot' ), array( 'status' => 404 ) );
        }

        if ( 'completed' !== $backup['status'] || empty( $backup['file_path'] ) ) {
            return new \WP_Error( 'vulopilot_backup_not_ready', __( 'This backup is not ready to download yet.', 'vulopilot' ), array( 'status' => 409 ) );
        }

        $file_path = VuloPilot()->backup_manager->resolve_file_path( (string) $backup['file_path'] );

        if ( ! file_exists( $file_path ) ) {
            return new \WP_Error( 'vulopilot_backup_file_missing', __( 'This backup\'s file could not be found on disk.', 'vulopilot' ), array( 'status' => 404 ) );
        }

        nocache_headers();
        header( 'Content-Type: application/zip' );
        header( 'Content-Disposition: attachment; filename="' . basename( $file_path ) . '"' );
        header( 'Content-Length: ' . filesize( $file_path ) ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_filesize -- reading the size of VuloPilot's own controlled backup file, not an arbitrary path.

        readfile( $file_path ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_read_readfile -- streaming VuloPilot's own controlled backup file to an already permission-checked request; not arbitrary user input.
        exit;
    }

    /**
     * Real, destructive Recovery restore. Always takes a real,
     * synchronously-completed pre-restore safety snapshot first — see this
     * class's own docblock for the full 3-safety-net posture.
     *
     * @param \WP_REST_Request $request Full request object.
     * @return \WP_REST_Response|\WP_Error
     */
    public function restore_item( $request ) {
        $id = absint( $request->get_param( 'id' ) );

        $safety_backup_id = VuloPilot()->backup_manager->start_backup( 'pre_restore_safety' );
        VuloPilot()->backup_manager->run_queue_synchronously();

        $result = VuloPilot()->backup_manager->restore( $id );

        if ( is_wp_error( $result ) ) {
            return $result;
        }

        return rest_ensure_response(
            array(
                'success'           => true,
                'safety_backup_id'  => $safety_backup_id,
            )
        );
    }
}
