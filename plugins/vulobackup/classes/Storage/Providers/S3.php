<?php
/**
 * S3 provider class file.
 *
 * @package VuloBackup
 */

namespace VuloBackup\Storage\Providers;

use VuloBackup\Security\Redactor;
use VuloBackup\Storage\Provider;

defined( 'ABSPATH' ) || exit;

/**
 * Amazon S3 and services that speak its API (Cloudflare R2, Backblaze B2, Wasabi, DigitalOcean
 * Spaces, MinIO and others).
 *
 * Requests are signed with AWS Signature Version 4 and sent with WordPress's HTTP API; no SDK is
 * bundled. Every request carries the SHA-256 of its body in the signature, so the service itself
 * rejects a part that arrives damaged. Large files go up as a multipart upload, a few megabytes at
 * a time, and an interrupted upload carries on from the last part the service accepted.
 *
 * Requests go to the configured endpoint only, over HTTPS, never follow redirects (a redirect
 * would carry signed headers elsewhere), and use wp_safe_remote_request(), which refuses private
 * and loopback addresses.
 */
class S3 implements Provider {

	/**
	 * Smallest multipart part the API allows is 5 MiB; this is the size used.
	 */
	const PART_BYTES = 8388608;

	/**
	 * @return string
	 */
	public function id() {
		return 's3';
	}

	/**
	 * @return string
	 */
	public function label() {
		return __( 'Amazon S3 or S3-compatible', 'vulobackup' );
	}

	/**
	 * @return array[]
	 */
	public function fields() {
		return array(
			array(
				'key'         => 'endpoint',
				'label'       => __( 'Endpoint', 'vulobackup' ),
				'type'        => 'text',
				'placeholder' => 'https://s3.example.com',
				'help'        => __( 'Leave empty for Amazon S3. For another service, the https:// address it gives you.', 'vulobackup' ),
			),
			array(
				'key'         => 'region',
				'label'       => __( 'Region', 'vulobackup' ),
				'type'        => 'text',
				'required'    => true,
				'default'     => 'us-east-1',
				'placeholder' => 'us-east-1',
				'help'        => __( 'The bucket\'s region. Services without regions usually accept "auto" or "us-east-1".', 'vulobackup' ),
			),
			array(
				'key'      => 'bucket',
				'label'    => __( 'Bucket', 'vulobackup' ),
				'type'     => 'text',
				'required' => true,
			),
			array(
				'key'      => 'access_key',
				'label'    => __( 'Access key ID', 'vulobackup' ),
				'type'     => 'text',
				'required' => true,
			),
			array(
				'key'      => 'secret_key',
				'label'    => __( 'Secret access key', 'vulobackup' ),
				'type'     => 'password',
				'secret'   => true,
				'required' => true,
			),
			array(
				'key'         => 'prefix',
				'label'       => __( 'Folder', 'vulobackup' ),
				'type'        => 'text',
				'placeholder' => 'backups/my-site',
				'help'        => __( 'Optional. A folder inside the bucket to keep this site\'s backups in.', 'vulobackup' ),
			),
			array(
				'key'     => 'path_style',
				'label'   => __( 'Path-style addresses', 'vulobackup' ),
				'type'    => 'toggle',
				'default' => true,
				'help'    => __( 'On for most S3-compatible services. Off puts the bucket name in the host name, as Amazon S3 does. Ignored when the endpoint is empty.', 'vulobackup' ),
			),
		);
	}

	/**
	 * @param array $config Field values.
	 * @return string
	 */
	public function describe( array $config ) {
		$host = '' !== (string) ( $config['endpoint'] ?? '' ) ? (string) wp_parse_url( $config['endpoint'], PHP_URL_HOST ) : 'Amazon S3';

		return trim( $host . ' · ' . ( $config['bucket'] ?? '' ) . ( '' !== trim( (string) ( $config['prefix'] ?? '' ), '/' ) ? '/' . trim( $config['prefix'], '/' ) : '' ) );
	}

	/**
	 * @param array $config Field values.
	 * @return array|\WP_Error
	 */
	public function test( array $config ) {
		$problem = $this->config_problem( $config );

		if ( $problem ) {
			return $problem;
		}

		$name = 'vulobackup-test-' . bin2hex( random_bytes( 6 ) ) . '.txt';
		$body = 'VuloBackup connection test ' . gmdate( 'c' );
		$put  = $this->request( $config, 'PUT', $name, array(), $body );

		if ( is_wp_error( $put ) ) {
			return $put;
		}

		$get = $this->request( $config, 'GET', $name );

		if ( is_wp_error( $get ) ) {
			return $get;
		}

		$delete = $this->request( $config, 'DELETE', $name );

		if ( $get['body'] !== $body ) {
			return new \WP_Error( 'vulobackup_storage_test', __( 'The test file read back from the bucket was not the one that was written.', 'vulobackup' ) );
		}

		if ( is_wp_error( $delete ) ) {
			return new \WP_Error(
				'vulobackup_storage_test',
				/* translators: %s: error from the storage service. */
				sprintf( __( 'Files can be written but not deleted, so old backups could never be removed. %s', 'vulobackup' ), $delete->get_error_message() )
			);
		}

		return array();
	}

	/**
	 * @param array  $config   Field values.
	 * @param string $local    File to send.
	 * @param string $remote   Key, relative to the folder.
	 * @param array  $state    Progress.
	 * @param float  $deadline Deadline.
	 * @return bool|\WP_Error
	 */
	public function upload( array $config, $local, $remote, array &$state, $deadline ) {
		$size = (int) filesize( $local );

		if ( $size <= self::PART_BYTES ) {
			$sent = $this->request( $config, 'PUT', $remote, array(), (string) file_get_contents( $local ) ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents -- a local file of at most one part.

			return is_wp_error( $sent ) ? $sent : true;
		}

		// Never more than 9000 parts (the API allows 10000).
		$part_bytes = max( self::PART_BYTES, (int) ceil( $size / 9000 ) );

		if ( empty( $state['upload_id'] ) || (int) ( $state['size'] ?? 0 ) !== $size || (int) ( $state['part_bytes'] ?? 0 ) !== $part_bytes ) {
			$started = $this->request( $config, 'POST', $remote, array( 'uploads' => '' ) );

			if ( is_wp_error( $started ) ) {
				return $started;
			}

			if ( ! preg_match( '#<UploadId>([^<]+)</UploadId>#', $started['body'], $match ) ) {
				return new \WP_Error( 'vulobackup_storage', __( 'The storage service did not start the upload.', 'vulobackup' ) );
			}

			$state = array(
				'upload_id'  => html_entity_decode( $match[1], ENT_QUOTES | ENT_XML1 ),
				'size'       => $size,
				'part_bytes' => $part_bytes,
				'etags'      => array(),
			);
		}

		$handle = fopen( $local, 'rb' ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fopen

		if ( ! $handle ) {
			return new \WP_Error( 'vulobackup_storage', __( 'The archive to upload could not be read.', 'vulobackup' ) );
		}

		$total = (int) ceil( $size / $part_bytes );

		while ( count( $state['etags'] ) < $total ) { // phpcs:ignore Squiz.PHP.DisallowSizeFunctionsInLoops.Found -- the list grows inside the loop.
			$number = count( $state['etags'] ) + 1;

			fseek( $handle, ( $number - 1 ) * $part_bytes );

			// stream_get_contents() returns the whole part; a single fread() may return less.
			$body = (string) stream_get_contents( $handle, $part_bytes );
			$sent = $this->request(
				$config,
				'PUT',
				$remote,
				array(
					'partNumber' => (string) $number,
					'uploadId'   => $state['upload_id'],
				),
				$body
			);

			unset( $body );

			if ( is_wp_error( $sent ) ) {
				fclose( $handle ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fclose

				// The service has forgotten the upload (expired or aborted): begin again next time.
				if ( 'NoSuchUpload' === $sent->get_error_data() ) {
					$state = array();
				}

				return $sent;
			}

			if ( empty( $sent['headers']['etag'] ) ) {
				fclose( $handle ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fclose

				return new \WP_Error( 'vulobackup_storage', __( 'The storage service did not confirm a part of the upload.', 'vulobackup' ) );
			}

			$state['etags'][] = $sent['headers']['etag'];

			if ( microtime( true ) > $deadline && count( $state['etags'] ) < $total ) {
				fclose( $handle ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fclose

				return false;
			}
		}

		fclose( $handle ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fclose

		$xml = '<CompleteMultipartUpload>';

		foreach ( $state['etags'] as $index => $etag ) {
			$xml .= '<Part><PartNumber>' . ( $index + 1 ) . '</PartNumber><ETag>' . esc_xml( $etag ) . '</ETag></Part>';
		}

		$done = $this->request( $config, 'POST', $remote, array( 'uploadId' => $state['upload_id'] ), $xml . '</CompleteMultipartUpload>' );

		if ( is_wp_error( $done ) ) {
			return $done;
		}

		$state = array();

		return true;
	}

	/**
	 * @param array  $config Field values.
	 * @param string $remote Key.
	 * @param array  $state  Progress of the upload.
	 * @return void
	 */
	public function abort( array $config, $remote, array $state ) {
		if ( ! empty( $state['upload_id'] ) ) {
			$this->request( $config, 'DELETE', $remote, array( 'uploadId' => (string) $state['upload_id'] ) );
		}
	}

	/**
	 * @param array  $config Field values.
	 * @param string $remote Key.
	 * @param int    $bytes  Expected size.
	 * @return true|\WP_Error
	 */
	public function verify( array $config, $remote, $bytes ) {
		$head = $this->request( $config, 'HEAD', $remote );

		if ( is_wp_error( $head ) ) {
			return $head;
		}

		if ( ! isset( $head['headers']['content-length'] ) || (int) $head['headers']['content-length'] !== (int) $bytes ) {
			return new \WP_Error( 'vulobackup_storage_verify', __( 'The file at the storage service is not the size of the one that was sent.', 'vulobackup' ) );
		}

		return true;
	}

	/**
	 * @param array  $config   Field values.
	 * @param string $remote   Key.
	 * @param string $local    File to write.
	 * @param int    $bytes    Expected size.
	 * @param array  $state    Progress.
	 * @param float  $deadline Deadline.
	 * @return bool|\WP_Error
	 */
	public function download( array $config, $remote, $local, $bytes, array &$state, $deadline ) {
		$offset = (int) ( $state['offset'] ?? 0 );
		$handle = fopen( $local, 0 === $offset ? 'wb' : 'r+b' ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fopen

		if ( ! $handle ) {
			return new \WP_Error( 'vulobackup_storage', __( 'The downloaded archive could not be written.', 'vulobackup' ) );
		}

		ftruncate( $handle, $offset );
		fseek( $handle, $offset );

		while ( $offset < $bytes ) {
			$end = min( $bytes, $offset + self::PART_BYTES ) - 1;
			$got = $this->request( $config, 'GET', $remote, array(), '', array( 'range' => 'bytes=' . $offset . '-' . $end ) );

			if ( is_wp_error( $got ) ) {
				fclose( $handle ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fclose

				return $got;
			}

			if ( strlen( $got['body'] ) !== $end - $offset + 1 || strlen( $got['body'] ) !== fwrite( $handle, $got['body'] ) ) { // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fwrite
				fclose( $handle ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fclose

				return new \WP_Error( 'vulobackup_storage', __( 'The download from the storage service was incomplete.', 'vulobackup' ) );
			}

			$offset         += strlen( $got['body'] );
			$state['offset'] = $offset;

			if ( microtime( true ) > $deadline && $offset < $bytes ) {
				fclose( $handle ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fclose

				return false;
			}
		}

		fclose( $handle ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fclose

		return true;
	}

	/**
	 * @param array  $config Field values.
	 * @param string $remote Key.
	 * @return true|\WP_Error
	 */
	public function delete( array $config, $remote ) {
		$deleted = $this->request( $config, 'DELETE', $remote );

		return is_wp_error( $deleted ) && 'NoSuchKey' !== $deleted->get_error_data() ? $deleted : true;
	}

	/**
	 * Why a configuration cannot be used, before anything is sent.
	 *
	 * @param array $config Field values.
	 * @return \WP_Error|null
	 */
	public function config_problem( array $config ) {
		$endpoint = trim( (string) ( $config['endpoint'] ?? '' ) );

		if ( '' !== $endpoint ) {
			$parts = wp_parse_url( $endpoint );

			/**
			 * Filters whether a plain http:// storage endpoint is accepted. Off by default: without
			 * TLS the backup itself crosses the network unprotected. For local testing only.
			 *
			 * @param bool $allow Whether to allow it.
			 */
			$insecure = (bool) apply_filters( 'vulobackup_allow_insecure_storage', false );

			if (
				! is_array( $parts )
				|| empty( $parts['host'] )
				|| ! in_array( $parts['scheme'] ?? '', $insecure ? array( 'https', 'http' ) : array( 'https' ), true )
				|| isset( $parts['user'] )
				|| isset( $parts['pass'] )
				|| isset( $parts['query'] )
				|| isset( $parts['fragment'] )
				|| '' !== trim( (string) ( $parts['path'] ?? '' ), '/' )
			) {
				return new \WP_Error( 'vulobackup_storage_config', __( 'The endpoint must be an https:// address with nothing after the host name.', 'vulobackup' ) );
			}
		}

		if ( ! preg_match( '/^[a-z0-9][a-z0-9.\-]{1,61}[a-z0-9]$/', (string) ( $config['bucket'] ?? '' ) ) ) {
			return new \WP_Error( 'vulobackup_storage_config', __( 'Enter the bucket\'s name: 3 to 63 lowercase letters, digits, dots and hyphens.', 'vulobackup' ) );
		}

		if ( ! preg_match( '/^[A-Za-z0-9\-]{1,40}$/', (string) ( $config['region'] ?? '' ) ) ) {
			return new \WP_Error( 'vulobackup_storage_config', __( 'Enter the bucket\'s region, for example us-east-1.', 'vulobackup' ) );
		}

		if ( '' === (string) ( $config['access_key'] ?? '' ) || '' === (string) ( $config['secret_key'] ?? '' ) ) {
			return new \WP_Error( 'vulobackup_storage_config', __( 'Enter the access key ID and the secret access key.', 'vulobackup' ) );
		}

		return null;
	}

	/**
	 * Sends one signed request.
	 *
	 * @param array  $config  Field values.
	 * @param string $method  HTTP method.
	 * @param string $key     Object key, relative to the configured folder.
	 * @param array  $query   Query parameters.
	 * @param string $body    Request body.
	 * @param array  $headers Extra headers (lower-case names).
	 * @return array|\WP_Error {
	 *     @type int    $code    Status code.
	 *     @type string $body    Response body.
	 *     @type array  $headers Response headers, lower-case names.
	 * }
	 */
	private function request( array $config, $method, $key, array $query = array(), $body = '', array $headers = array() ) {
		$problem = $this->config_problem( $config );

		if ( $problem ) {
			return $problem;
		}

		$endpoint = trim( (string) ( $config['endpoint'] ?? '' ) );
		$region   = (string) $config['region'];
		$bucket   = (string) $config['bucket'];
		$prefix   = trim( (string) ( $config['prefix'] ?? '' ), '/' );
		$path     = '/' . implode( '/', array_map( 'rawurlencode', explode( '/', ltrim( ( '' !== $prefix ? $prefix . '/' : '' ) . ltrim( $key, '/' ), '/' ) ) ) );

		if ( '' === $endpoint ) {
			$scheme = 'https';
			$host   = $bucket . '.s3.' . $region . '.amazonaws.com';
		} else {
			$parts  = wp_parse_url( $endpoint );
			$scheme = $parts['scheme'];
			$host   = $parts['host'] . ( isset( $parts['port'] ) ? ':' . (int) $parts['port'] : '' );

			if ( ! isset( $config['path_style'] ) || $config['path_style'] ) {
				$path = '/' . $bucket . $path;
			} else {
				$host = $bucket . '.' . $host;
			}
		}

		ksort( $query );

		$pairs = array();

		foreach ( $query as $name => $value ) {
			$pairs[] = rawurlencode( (string) $name ) . '=' . rawurlencode( (string) $value );
		}

		$query_string = implode( '&', $pairs );
		$time         = time();
		$date         = gmdate( 'Ymd', $time );
		$hash         = hash( 'sha256', $body );
		$headers      = array_merge(
			$headers,
			array(
				'host'                 => $host,
				'x-amz-content-sha256' => $hash,
				'x-amz-date'           => gmdate( 'Ymd\THis\Z', $time ),
			)
		);

		ksort( $headers );

		$canonical = '';

		foreach ( $headers as $name => $value ) {
			$canonical .= $name . ':' . trim( (string) $value ) . "\n";
		}

		$signed  = implode( ';', array_keys( $headers ) );
		$scope   = $date . '/' . $region . '/s3/aws4_request';
		$to_sign = "AWS4-HMAC-SHA256\n" . $headers['x-amz-date'] . "\n" . $scope . "\n" . hash( 'sha256', $method . "\n" . $path . "\n" . $query_string . "\n" . $canonical . "\n" . $signed . "\n" . $hash );
		$secret  = (string) $config['secret_key'];
		$signing = hash_hmac( 'sha256', 'aws4_request', hash_hmac( 'sha256', 's3', hash_hmac( 'sha256', $region, hash_hmac( 'sha256', $date, 'AWS4' . $secret, true ), true ), true ), true );

		$headers['authorization'] = 'AWS4-HMAC-SHA256 Credential=' . $config['access_key'] . '/' . $scope . ', SignedHeaders=' . $signed . ', Signature=' . hash_hmac( 'sha256', $to_sign, $signing );

		unset( $headers['host'] );

		$response = wp_safe_remote_request(
			$scheme . '://' . $host . $path . ( '' !== $query_string ? '?' . $query_string : '' ),
			array(
				'method'      => $method,
				'timeout'     => (int) apply_filters( 'vulobackup_http_timeout', 120 ),
				'redirection' => 0,
				'headers'     => $headers,
				'body'        => 'GET' === $method || 'HEAD' === $method || 'DELETE' === $method ? null : $body,
				'user-agent'  => 'VuloBackup/' . VULOBACKUP_PLUGIN_VERSION,
			)
		);

		if ( is_wp_error( $response ) ) {
			return new \WP_Error(
				'vulobackup_storage',
				/* translators: %s: network error. */
				sprintf( __( 'The storage service could not be reached. %s', 'vulobackup' ), Redactor::scrub( $response->get_error_message(), array( $secret ) ) )
			);
		}

		$code   = (int) wp_remote_retrieve_response_code( $response );
		$text   = (string) wp_remote_retrieve_body( $response );
		$result = array(
			'code'    => $code,
			'body'    => $text,
			'headers' => array(),
		);

		foreach ( wp_remote_retrieve_headers( $response ) as $name => $value ) {
			$result['headers'][ strtolower( (string) $name ) ] = is_array( $value ) ? implode( ', ', $value ) : (string) $value;
		}

		// "Complete multipart upload" can answer 200 with an error in the body.
		$failed = $code < 200 || $code >= 300 || ( 'POST' === $method && false !== strpos( $text, '<Error>' ) );

		if ( ! $failed ) {
			return $result;
		}

		$error  = preg_match( '#<Code>([^<]+)</Code>#', $text, $match ) ? $match[1] : ( 404 === $code ? 'NoSuchKey' : '' );
		$detail = preg_match( '#<Message>([^<]+)</Message>#', $text, $match ) ? html_entity_decode( $match[1], ENT_QUOTES | ENT_XML1 ) : '';

		$messages = array(
			'InvalidAccessKeyId'    => __( 'The access key ID is not recognised.', 'vulobackup' ),
			'SignatureDoesNotMatch' => __( 'The secret access key is wrong, or the region does not match the bucket.', 'vulobackup' ),
			'AccessDenied'          => __( 'Access was denied. Check that the key may read, write and delete in this bucket.', 'vulobackup' ),
			'NoSuchBucket'          => __( 'There is no bucket with that name.', 'vulobackup' ),
			'NoSuchKey'             => __( 'The file is not at the storage service.', 'vulobackup' ),
		);

		$message = isset( $messages[ $error ] )
			? $messages[ $error ]
			/* translators: 1: HTTP status code, 2: error detail from the storage service. */
			: sprintf( __( 'The storage service answered with error %1$d. %2$s', 'vulobackup' ), $code, Redactor::scrub( $detail, array( $secret ) ) );

		return new \WP_Error( 'vulobackup_storage', trim( $message ), $error );
	}
}
