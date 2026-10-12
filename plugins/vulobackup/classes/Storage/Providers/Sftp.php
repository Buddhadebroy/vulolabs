<?php
/**
 * SFTP provider class file.
 *
 * @package VuloBackup
 */

namespace VuloBackup\Storage\Providers;

use phpseclib3\Crypt\PublicKeyLoader;
use phpseclib3\Net\SFTP as Client;
use VuloBackup\Security\Redactor;
use VuloBackup\Storage\Provider;

defined( 'ABSPATH' ) || exit;

/**
 * A server reached over SFTP (file transfer over SSH), using the phpseclib library, which needs no
 * PHP extension.
 *
 * The server's key fingerprint is remembered the first time a connection is tested, and every later
 * connection must present the same key. If it changes, nothing is sent until the administrator
 * tests the connection again and accepts the new one; a silent change is what an intercepted
 * connection looks like.
 *
 * SFTP has no checksum of its own, so a finished upload is confirmed by its size on the server.
 */
class Sftp implements Provider {

	const CHUNK_BYTES = 2097152;

	/**
	 * Open connections of this request, by destination.
	 *
	 * @var Client[]
	 */
	private $clients = array();

	/**
	 * @return string
	 */
	public function id() {
		return 'sftp';
	}

	/**
	 * @return string
	 */
	public function label() {
		return __( 'SFTP server', 'vulobackup' );
	}

	/**
	 * @return array[]
	 */
	public function fields() {
		return array(
			array(
				'key'         => 'host',
				'label'       => __( 'Server', 'vulobackup' ),
				'type'        => 'text',
				'required'    => true,
				'placeholder' => 'sftp.example.com',
			),
			array(
				'key'     => 'port',
				'label'   => __( 'Port', 'vulobackup' ),
				'type'    => 'number',
				'default' => 22,
			),
			array(
				'key'      => 'username',
				'label'    => __( 'Username', 'vulobackup' ),
				'type'     => 'text',
				'required' => true,
			),
			array(
				'key'    => 'password',
				'label'  => __( 'Password', 'vulobackup' ),
				'type'   => 'password',
				'secret' => true,
				'help'   => __( 'Leave empty when you sign in with a private key. With a key, this is the key\'s passphrase.', 'vulobackup' ),
			),
			array(
				'key'    => 'private_key',
				'label'  => __( 'Private key', 'vulobackup' ),
				'type'   => 'textarea',
				'secret' => true,
				'help'   => __( 'Optional. Paste the whole key, including its BEGIN and END lines.', 'vulobackup' ),
			),
			array(
				'key'         => 'path',
				'label'       => __( 'Folder', 'vulobackup' ),
				'type'        => 'text',
				'required'    => true,
				'placeholder' => 'backups/my-site',
				'help'        => __( 'Where on the server to keep this site\'s backups. It is created if it does not exist.', 'vulobackup' ),
			),
		);
	}

	/**
	 * @param array $config Field values.
	 * @return string
	 */
	public function describe( array $config ) {
		return ( $config['username'] ?? '' ) . '@' . ( $config['host'] ?? '' ) . ':' . trim( (string) ( $config['path'] ?? '' ) );
	}

	/**
	 * @param array $config Field values.
	 * @return array|\WP_Error
	 */
	public function test( array $config ) {
		// The administrator is looking at the result, so whatever key the server shows now is the one
		// that is remembered.
		$accepted = $config;

		unset( $accepted['fingerprint'] );

		$client = $this->connect( $accepted, true );

		if ( is_wp_error( $client ) ) {
			return $client;
		}

		$name = 'vulobackup-test-' . bin2hex( random_bytes( 6 ) ) . '.txt';
		$body = 'VuloBackup connection test ' . gmdate( 'c' );
		$path = $this->path( $config, $name );

		try {
			if ( ! $client->mkdir( dirname( $path ), -1, true ) && ! $client->is_dir( dirname( $path ) ) ) {
				return new \WP_Error( 'vulobackup_storage_test', __( 'The folder does not exist on the server and could not be created.', 'vulobackup' ) );
			}

			if ( ! $client->put( $path, $body ) ) {
				return new \WP_Error( 'vulobackup_storage_test', __( 'A test file could not be written to the folder. Check the folder\'s permissions.', 'vulobackup' ) );
			}

			$read    = $client->get( $path );
			$deleted = $client->delete( $path, false );
		} catch ( \Throwable $error ) {
			return $this->failure( $error, $config );
		}

		if ( $read !== $body ) {
			return new \WP_Error( 'vulobackup_storage_test', __( 'The test file read back from the server was not the one that was written.', 'vulobackup' ) );
		}

		if ( ! $deleted ) {
			return new \WP_Error( 'vulobackup_storage_test', __( 'Files can be written but not deleted, so old backups could never be removed.', 'vulobackup' ) );
		}

		return array( 'fingerprint' => $this->fingerprint( $client ) );
	}

	/**
	 * @param array  $config   Field values.
	 * @param string $local    File to send.
	 * @param string $remote   Path relative to the folder.
	 * @param array  $state    Progress.
	 * @param float  $deadline Deadline.
	 * @return bool|\WP_Error
	 */
	public function upload( array $config, $local, $remote, array &$state, $deadline ) {
		$client = $this->connect( $config );

		if ( is_wp_error( $client ) ) {
			return $client;
		}

		$size   = (int) filesize( $local );
		$path   = $this->path( $config, $remote );
		$handle = fopen( $local, 'rb' ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fopen

		if ( ! $handle ) {
			return new \WP_Error( 'vulobackup_storage', __( 'The archive to upload could not be read.', 'vulobackup' ) );
		}

		try {
			if ( empty( $state['started'] ) || (int) ( $state['size'] ?? -1 ) !== $size ) {
				$client->mkdir( dirname( $path ), -1, true );
				// An earlier, different file under this name must not be continued.
				$client->delete( $path, false );

				$state = array(
					'started' => true,
					'size'    => $size,
					'offset'  => 0,
				);
			}

			if ( 0 === $size && ! $client->put( $path, '' ) ) {
				fclose( $handle ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fclose

				return new \WP_Error( 'vulobackup_storage', __( 'The file could not be written to the SFTP server.', 'vulobackup' ) );
			}

			while ( $state['offset'] < $size ) {
				fseek( $handle, $state['offset'] );

				$chunk = (string) stream_get_contents( $handle, self::CHUNK_BYTES );

				if ( '' === $chunk || ! $client->put( $path, $chunk, Client::SOURCE_STRING, $state['offset'] ) ) {
					fclose( $handle ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fclose

					return new \WP_Error( 'vulobackup_storage', __( 'The upload to the SFTP server stopped. The server\'s disk may be full.', 'vulobackup' ) );
				}

				$state['offset'] += strlen( $chunk );

				if ( microtime( true ) > $deadline && $state['offset'] < $size ) {
					fclose( $handle ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fclose

					return false;
				}
			}
		} catch ( \Throwable $error ) {
			fclose( $handle ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fclose

			return $this->failure( $error, $config );
		}

		fclose( $handle ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fclose

		$state = array();

		return true;
	}

	/**
	 * @param array  $config Field values.
	 * @param string $remote Path.
	 * @param array  $state  Progress of the upload.
	 * @return void
	 */
	public function abort( array $config, $remote, array $state ) {
		if ( ! empty( $state['started'] ) ) {
			$this->delete( $config, $remote );
		}
	}

	/**
	 * @param array  $config Field values.
	 * @param string $remote Path.
	 * @param int    $bytes  Expected size.
	 * @return true|\WP_Error
	 */
	public function verify( array $config, $remote, $bytes ) {
		$client = $this->connect( $config );

		if ( is_wp_error( $client ) ) {
			return $client;
		}

		try {
			$client->clearStatCache();

			$stat = $client->stat( $this->path( $config, $remote ) );
		} catch ( \Throwable $error ) {
			return $this->failure( $error, $config );
		}

		if ( ! is_array( $stat ) || ! isset( $stat['size'] ) ) {
			return new \WP_Error( 'vulobackup_storage_verify', __( 'The file is not on the SFTP server.', 'vulobackup' ) );
		}

		if ( (int) $stat['size'] !== (int) $bytes ) {
			return new \WP_Error( 'vulobackup_storage_verify', __( 'The file on the SFTP server is not the size of the one that was sent.', 'vulobackup' ) );
		}

		return true;
	}

	/**
	 * @param array  $config   Field values.
	 * @param string $remote   Path.
	 * @param string $local    File to write.
	 * @param int    $bytes    Expected size.
	 * @param array  $state    Progress.
	 * @param float  $deadline Deadline.
	 * @return bool|\WP_Error
	 */
	public function download( array $config, $remote, $local, $bytes, array &$state, $deadline ) {
		$client = $this->connect( $config );

		if ( is_wp_error( $client ) ) {
			return $client;
		}

		$offset = (int) ( $state['offset'] ?? 0 );
		$handle = fopen( $local, 0 === $offset ? 'wb' : 'r+b' ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fopen

		if ( ! $handle ) {
			return new \WP_Error( 'vulobackup_storage', __( 'The downloaded archive could not be written.', 'vulobackup' ) );
		}

		ftruncate( $handle, $offset );
		fseek( $handle, $offset );

		try {
			while ( $offset < $bytes ) {
				$chunk = $client->get( $this->path( $config, $remote ), false, $offset, min( self::CHUNK_BYTES, $bytes - $offset ) );

				if ( ! is_string( $chunk ) || '' === $chunk || strlen( $chunk ) !== fwrite( $handle, $chunk ) ) { // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fwrite
					fclose( $handle ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fclose

					return new \WP_Error( 'vulobackup_storage', __( 'The download from the SFTP server was incomplete.', 'vulobackup' ) );
				}

				$offset         += strlen( $chunk );
				$state['offset'] = $offset;

				if ( microtime( true ) > $deadline && $offset < $bytes ) {
					fclose( $handle ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fclose

					return false;
				}
			}
		} catch ( \Throwable $error ) {
			fclose( $handle ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fclose

			return $this->failure( $error, $config );
		}

		fclose( $handle ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fclose

		return true;
	}

	/**
	 * @param array  $config Field values.
	 * @param string $remote Path.
	 * @return true|\WP_Error
	 */
	public function delete( array $config, $remote ) {
		$client = $this->connect( $config );

		if ( is_wp_error( $client ) ) {
			return $client;
		}

		try {
			$path = $this->path( $config, $remote );

			if ( $client->file_exists( $path ) && ! $client->delete( $path, false ) ) {
				return new \WP_Error( 'vulobackup_storage', __( 'The file could not be deleted from the SFTP server.', 'vulobackup' ) );
			}

			// The backup's own folder, once it is empty. rmdir() refuses a folder with files in it.
			if ( false !== strpos( trim( $remote, '/' ), '/' ) ) {
				$client->rmdir( dirname( $path ) );
			}
		} catch ( \Throwable $error ) {
			return $this->failure( $error, $config );
		}

		return true;
	}

	/**
	 * Why a configuration cannot be used, before connecting.
	 *
	 * @param array $config Field values.
	 * @return \WP_Error|null
	 */
	public function config_problem( array $config ) {
		$host = (string) ( $config['host'] ?? '' );

		if ( ! preg_match( '/^[A-Za-z0-9]([A-Za-z0-9.\-]{0,251}[A-Za-z0-9])?$/', $host ) && ! filter_var( $host, FILTER_VALIDATE_IP ) ) {
			return new \WP_Error( 'vulobackup_storage_config', __( 'Enter the server\'s host name or IP address, without sftp:// in front.', 'vulobackup' ) );
		}

		$port = (int) ( $config['port'] ?? 22 );

		if ( $port < 1 || $port > 65535 ) {
			return new \WP_Error( 'vulobackup_storage_config', __( 'The port must be a number between 1 and 65535.', 'vulobackup' ) );
		}

		if ( '' === (string) ( $config['username'] ?? '' ) || ( '' === (string) ( $config['password'] ?? '' ) && '' === trim( (string) ( $config['private_key'] ?? '' ) ) ) ) {
			return new \WP_Error( 'vulobackup_storage_config', __( 'Enter a username and either a password or a private key.', 'vulobackup' ) );
		}

		$path = (string) ( $config['path'] ?? '' );

		if ( '' === trim( $path, '/' ) || preg_match( '#(^|/)\.\.(/|$)#', $path ) || preg_match( '/[\x00-\x1F]/', $path ) ) {
			return new \WP_Error( 'vulobackup_storage_config', __( 'Enter the folder on the server to keep backups in.', 'vulobackup' ) );
		}

		return null;
	}

	/**
	 * Opens (or reuses) a connection and signs in.
	 *
	 * @param array $config  Field values.
	 * @param bool  $testing Whether an unknown server key is acceptable (only while testing).
	 * @return Client|\WP_Error
	 */
	private function connect( array $config, $testing = false ) {
		$problem = $this->config_problem( $config );

		if ( $problem ) {
			return $problem;
		}

		$cache = md5( wp_json_encode( array( $config['host'], $config['port'] ?? 22, $config['username'], $config['path'] ) ) );

		if ( isset( $this->clients[ $cache ] ) && $this->clients[ $cache ]->isConnected() ) {
			return $this->clients[ $cache ];
		}

		try {
			$client = new Client( (string) $config['host'], (int) ( $config['port'] ?? 22 ), (int) apply_filters( 'vulobackup_sftp_timeout', 20 ) );
			$known  = (string) ( $config['fingerprint'] ?? '' );
			$shown  = $this->fingerprint( $client );

			if ( '' === $shown ) {
				return new \WP_Error( 'vulobackup_storage', __( 'The SFTP server could not be reached. Check the server name and port.', 'vulobackup' ) );
			}

			if ( ! $testing && ( '' === $known || ! hash_equals( $known, $shown ) ) ) {
				return new \WP_Error( 'vulobackup_storage_hostkey', __( 'The SFTP server\'s identity key is not the one saved for this destination, so nothing was sent. If the server was changed on purpose, open the destination in Settings → Storage and test it again.', 'vulobackup' ) );
			}

			$key = trim( (string) ( $config['private_key'] ?? '' ) );

			if ( '' !== $key ) {
				$passphrase = (string) ( $config['password'] ?? '' );
				$credential = PublicKeyLoader::load( $key, '' === $passphrase ? false : $passphrase );
			} else {
				$credential = (string) $config['password'];
			}

			if ( ! $client->login( (string) $config['username'], $credential ) ) {
				return new \WP_Error( 'vulobackup_storage', __( 'The SFTP server refused the username, password or key.', 'vulobackup' ) );
			}
		} catch ( \Throwable $error ) {
			return $this->failure( $error, $config );
		}

		$this->clients[ $cache ] = $client;

		return $client;
	}

	/**
	 * @param Client $client Connection.
	 * @return string The server key's SHA-256 fingerprint, or '' when the server cannot be reached.
	 */
	private function fingerprint( Client $client ) {
		try {
			$key = $client->getServerPublicHostKey();
		} catch ( \Throwable $error ) {
			return '';
		}

		if ( ! is_string( $key ) || '' === $key ) {
			return '';
		}

		$parts = explode( ' ', $key );
		$raw   = base64_decode( $parts[1] ?? '', true ); // phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_decode -- decoding the server's public key to fingerprint it.

		return false === $raw ? '' : 'SHA256:' . rtrim( base64_encode( hash( 'sha256', $raw, true ) ), '=' ); // phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_encode -- the conventional fingerprint format.
	}

	/**
	 * @param array  $config Field values.
	 * @param string $remote Path relative to the configured folder.
	 * @return string Path on the server.
	 */
	private function path( array $config, $remote ) {
		return rtrim( (string) $config['path'], '/' ) . '/' . ltrim( $remote, '/' );
	}

	/**
	 * Turns a library exception into an error that is safe to show.
	 *
	 * @param \Throwable $error  Exception.
	 * @param array      $config Field values, for redaction.
	 * @return \WP_Error
	 */
	private function failure( \Throwable $error, array $config ) {
		return new \WP_Error(
			'vulobackup_storage',
			sprintf(
				/* translators: %s: error detail. */
				__( 'The SFTP connection failed. %s', 'vulobackup' ),
				Redactor::scrub( $error->getMessage(), array( (string) ( $config['password'] ?? '' ), (string) ( $config['private_key'] ?? '' ) ) )
			)
		);
	}
}
