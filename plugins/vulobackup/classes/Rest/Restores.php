<?php
/**
 * Restores REST controller file.
 *
 * @package VuloBackup
 */

namespace VuloBackup\Rest;

use VuloBackup\Backup\Manifest;
use VuloBackup\Jobs\Store;
use VuloBackup\Logging\Logger;
use VuloBackup\Restore\FilesRestorer;
use VuloBackup\Security\Crypto;
use VuloBackup\Utill;

defined( 'ABSPATH' ) || exit;

/**
 * vulobackup/v1/restores - preview what a restore would do, start one, follow it, cancel it.
 *
 * A restore is destructive, so starting one takes more than a click: the request must carry the
 * word the administrator was asked to type, and it is refused while anything else is running.
 */
class Restores extends Controller {

	/**
	 * The word the administrator types to confirm.
	 */
	const CONFIRMATION = 'RESTORE';

	/**
	 * Registers this controller's routes.
	 *
	 * @return void
	 */
	public function register_routes() {
		$id = '(?P<id>[a-z0-9\-]{6,48})';

		$this->route( '/restores', \WP_REST_Server::READABLE, 'get_items' );
		$this->route( '/restores', \WP_REST_Server::CREATABLE, 'create_item' );
		$this->route( '/restores/preview', \WP_REST_Server::READABLE, 'preview' );
		$this->route( '/restores/' . $id, \WP_REST_Server::READABLE, 'get_item' );
		$this->route( '/restores/' . $id . '/cancel', \WP_REST_Server::CREATABLE, 'cancel' );
	}

	/**
	 * Lists past restores, newest first.
	 *
	 * @param \WP_REST_Request|null $request Request.
	 * @return \WP_REST_Response
	 */
	public function get_items( $request = null ) {
		return rest_ensure_response( array_map( array( $this, 'view' ), array_slice( VuloBackup()->jobs->all( Store::KIND_RESTORE ), 0, 20 ) ) );
	}

	/**
	 * Returns one restore with its log.
	 *
	 * @param \WP_REST_Request $request Request.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function get_item( $request ) {
		$job = VuloBackup()->jobs->get( Store::KIND_RESTORE, (string) $request['id'] );

		if ( ! $job ) {
			return $this->not_found();
		}

		$view        = $this->view( $job );
		$view['log'] = Logger::read( VuloBackup()->jobs->dir( $job ) . '/log.jsonl', 200 );

		return rest_ensure_response( $view );
	}

	/**
	 * Says what a backup holds, where it is from, and what restoring it here would replace.
	 *
	 * @param \WP_REST_Request $request Request.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function preview( $request ) {
		global $wpdb, $wp_version;

		$job = VuloBackup()->jobs->get( Store::KIND_BACKUP, sanitize_key( (string) $request->get_param( 'backup' ) ) );

		if ( ! $job || 'completed' !== $job['status'] ) {
			return $this->not_found();
		}

		$manifest = Manifest::read( VuloBackup()->jobs->dir( $job ) );

		if ( is_wp_error( $manifest ) ) {
			return new \WP_Error( $manifest->get_error_code(), $manifest->get_error_message(), array( 'status' => 409 ) );
		}

		$site     = $manifest['site'];
		$roots    = Utill::area_roots();
		$areas    = array();
		$blockers = array();
		$notes    = array();

		foreach ( (array) ( $manifest['files']['by_area'] ?? array() ) as $area => $counts ) {
			$areas[] = array(
				'id'            => $area,
				'files'         => $counts['files'],
				'bytes_display' => Utill::size( $counts['bytes'] ),
				'available'     => isset( $roots[ $area ] ),
				// Whether the folder is replaced as a whole (and can be put back) or copied over.
				'swapped'       => in_array( $area, FilesRestorer::SWAPPED, true ),
			);
		}

		if ( is_multisite() !== $site['multisite'] ) {
			$blockers[] = $site['multisite']
				? __( 'This backup is of a multisite network and can only be restored to a multisite network.', 'vulobackup' )
				: __( 'This backup is of a single site and cannot be restored over a multisite network.', 'vulobackup' );
		}

		if ( $manifest['encrypted'] && ! Crypto::is_available() ) {
			$blockers[] = __( 'This backup is encrypted, and this server\'s PHP has no sodium extension to decrypt it.', 'vulobackup' );
		}

		if ( $areas && ! class_exists( '\ZipArchive' ) ) {
			$notes[] = __( 'This server\'s PHP has no zip extension, so files cannot be restored here; the database can.', 'vulobackup' );
		}

		$moved = untrailingslashit( $site['home'] ) !== untrailingslashit( home_url() );

		if ( $moved ) {
			$notes[] = sprintf(
				/* translators: 1: address of the site the backup is from, 2: this site's address. */
				__( 'This backup is from %1$s. Its address will be replaced by %2$s throughout the database. Settings of some plugins, licences tied to a domain, and addresses written without the domain may need attention by hand afterwards.', 'vulobackup' ),
				$site['home'],
				home_url()
			);
		}

		if ( '' !== $site['prefix'] && $site['prefix'] !== $wpdb->base_prefix ) {
			$notes[] = sprintf(
				/* translators: 1: table prefix of the backup, 2: this site's table prefix. */
				__( 'The backup\'s database tables start with "%1$s"; they will be restored with this site\'s prefix "%2$s".', 'vulobackup' ),
				$site['prefix'],
				$wpdb->base_prefix
			);
		}

		if ( '' !== $site['wp_version'] && version_compare( $site['wp_version'], $wp_version, '>' ) && $manifest['database'] ) {
			$notes[] = sprintf(
				/* translators: 1: WordPress version of the backup, 2: this site's WordPress version. */
				__( 'The backup was made on WordPress %1$s, which is newer than this site\'s %2$s. Update WordPress first, or restore the WordPress files too.', 'vulobackup' ),
				$site['wp_version'],
				$wp_version
			);
		}

		if ( '' !== $site['php'] && (int) $site['php'] > PHP_MAJOR_VERSION ) {
			$notes[] = sprintf(
				/* translators: 1: PHP version of the backup's site, 2: this server's PHP version. */
				__( 'The backup\'s site ran PHP %1$s; this server runs PHP %2$s. Plugins and themes in the backup may need the newer version.', 'vulobackup' ),
				$site['php'],
				PHP_VERSION
			);
		}

		if ( empty( $job['local'] ) ) {
			$notes[] = __( 'The archives of this backup are at a remote destination and will be downloaded first.', 'vulobackup' );
		}

		$active = VuloBackup()->jobs->active();

		return rest_ensure_response(
			array(
				'backup'         => $this->view( $job ),
				'site'           => $site,
				'this_site'      => array(
					'home'       => home_url(),
					'prefix'     => $wpdb->base_prefix,
					'wp_version' => $wp_version,
					'php'        => PHP_VERSION,
				),
				'made_display'   => Utill::format_datetime( $manifest['created_at'] ),
				'moved'          => $moved,
				'database'       => $manifest['database']
					? array(
						'tables' => $manifest['database']['tables'],
						'rows'   => $manifest['database']['rows'],
					)
					: null,
				'areas'          => $areas,
				'encrypted'      => $manifest['encrypted'],
				// This site's own password decrypts its own backups; another site's needs asking for.
				'needs_password' => $manifest['encrypted'] && ( 'import' === $job['trigger'] || '' === Crypto::stored_password() ),
				'blockers'       => $blockers,
				'notes'          => $notes,
				'safety'         => (bool) VuloBackup()->settings->get( 'safety_backup' ),
				'confirmation'   => self::CONFIRMATION,
				'busy'           => $active ? $this->view( $active ) : null,
			)
		);
	}

	/**
	 * Starts a restore.
	 *
	 * @param \WP_REST_Request $request Request.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function create_item( $request ) {
		$input = (array) $request->get_json_params();
		$jobs  = VuloBackup()->jobs;

		if ( self::CONFIRMATION !== trim( (string) ( $input['confirm'] ?? '' ) ) ) {
			return new \WP_Error(
				'vulobackup_unconfirmed',
				/* translators: %s: the word to type. */
				sprintf( __( 'Type %s to confirm that you want to replace this site with the backup.', 'vulobackup' ), self::CONFIRMATION ),
				array( 'status' => 400 )
			);
		}

		$backup = $jobs->get( Store::KIND_BACKUP, sanitize_key( (string) ( $input['backup'] ?? '' ) ) );

		if ( ! $backup || 'completed' !== $backup['status'] ) {
			return $this->not_found();
		}

		// One restore at a time, and never alongside a backup.
		if ( ! $jobs->lock() ) {
			return new \WP_Error( 'vulobackup_busy', __( 'A backup or restore is running. Wait for it to finish, or cancel it.', 'vulobackup' ), array( 'status' => 409 ) );
		}

		if ( $jobs->active() ) {
			$jobs->unlock();

			return new \WP_Error( 'vulobackup_busy', __( 'A backup or restore is running. Wait for it to finish, or cancel it.', 'vulobackup' ), array( 'status' => 409 ) );
		}

		$areas    = array_values( array_intersect( Utill::AREAS, array_map( 'sanitize_key', is_array( $input['areas'] ?? null ) ? $input['areas'] : array() ) ) );
		$password = (string) ( $input['password'] ?? '' );

		$job = $jobs->create(
			Store::KIND_RESTORE,
			array(
				'backup_id'   => $backup['id'],
				'backup_name' => $backup['name'],
				'token'       => bin2hex( random_bytes( 4 ) ),
				'changed'     => 'nothing',
				'components'  => array(
					'database' => ! empty( $input['database'] ),
					'areas'    => $areas,
				),
				'options'     => array(
					'safety'   => ! isset( $input['safety'] ) || ! empty( $input['safety'] ),
					// Kept only for the length of the restore, and encrypted while it is.
					'password' => '' !== $password ? VuloBackup()->secrets->encrypt( $password ) : '',
				),
				'started_by'  => get_current_user_id(),
			)
		);

		$jobs->unlock();

		return is_wp_error( $job ) ? $job : rest_ensure_response( $this->view( $job ) );
	}

	/**
	 * Cancels a restore that has not yet switched the site over.
	 *
	 * @param \WP_REST_Request $request Request.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function cancel( $request ) {
		$job = VuloBackup()->jobs->get( Store::KIND_RESTORE, (string) $request['id'] );

		if ( ! $job ) {
			return $this->not_found();
		}

		$job = VuloBackup()->runner->cancel( $job );

		return is_wp_error( $job ) ? $job : rest_ensure_response( $this->view( $job ) );
	}
}
