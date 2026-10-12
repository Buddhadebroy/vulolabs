<?php
/**
 * Crypto class file.
 *
 * @package VuloBackup
 */

namespace VuloBackup\Security;

use VuloBackup\Utill;

defined( 'ABSPATH' ) || exit;

/**
 * Optional password encryption of backup archives.
 *
 * Nothing here is home-made: the key is derived from the password with Argon2id
 * (sodium_crypto_pwhash) and files are encrypted with libsodium's secretstream
 * (XChaCha20-Poly1305), which authenticates every chunk and the end of the file, so a changed,
 * truncated or reordered archive is detected rather than restored.
 *
 * It needs PHP's sodium extension. WordPress's pure-PHP fallback does not provide Argon2id, so on
 * a server without the extension the feature is switched off rather than weakened.
 *
 * The password is kept on this site (encrypted, in the database) so that scheduled backups can run.
 * It is never written to a backup, a manifest or a log. An encrypted backup is therefore only as
 * private as the places it is copied to; and without the password it cannot be restored anywhere.
 */
class Crypto {

	const MAGIC      = "VULOBACKUP-ENC-1\n";
	const SALT_BYTES = 16;
	const CHUNK      = 1048576;

	/**
	 * Keys derived during this request, by salt.
	 *
	 * @var array<string, string>
	 */
	private static $keys = array();

	/**
	 * Checks whether this server can encrypt archives.
	 *
	 * @return bool Whether this server can encrypt archives.
	 */
	public static function is_available() {
		return extension_loaded( 'sodium' ) && function_exists( 'sodium_crypto_pwhash' ) && function_exists( 'sodium_crypto_secretstream_xchacha20poly1305_init_push' );
	}

	/**
	 * The password stored for this site's backups, or '' when there is none.
	 *
	 * @return string
	 */
	public static function stored_password() {
		$stored = get_option( Utill::ENCRYPTION_KEY );

		return is_string( $stored ) && '' !== $stored ? VuloBackup()->secrets->decrypt( $stored ) : '';
	}

	/**
	 * Saves or removes the password used for new backups.
	 *
	 * @param string $password Password, or '' to remove it.
	 * @return void
	 */
	public static function store_password( $password ) {
		if ( '' === (string) $password ) {
			delete_option( Utill::ENCRYPTION_KEY );

			return;
		}

		update_option( Utill::ENCRYPTION_KEY, VuloBackup()->secrets->encrypt( (string) $password ), false );
	}

	/**
	 * Derives the file key for a password and salt.
	 *
	 * @param string $password Password.
	 * @param string $salt     Binary salt of SALT_BYTES bytes.
	 * @return string 32-byte key.
	 * @throws \RuntimeException When the key cannot be derived.
	 */
	public static function key( $password, $salt ) {
		$cache = hash( 'sha256', $salt . '|' . $password );

		if ( isset( self::$keys[ $cache ] ) ) {
			return self::$keys[ $cache ];
		}

		if ( ! self::is_available() || self::SALT_BYTES !== strlen( $salt ) || '' === (string) $password ) {
			throw new \RuntimeException( esc_html__( 'This backup is encrypted, and this server cannot decrypt it or no password was given.', 'vulobackup' ) );
		}

		self::$keys[ $cache ] = sodium_crypto_pwhash(
			SODIUM_CRYPTO_SECRETSTREAM_XCHACHA20POLY1305_KEYBYTES,
			(string) $password,
			$salt,
			SODIUM_CRYPTO_PWHASH_OPSLIMIT_INTERACTIVE,
			SODIUM_CRYPTO_PWHASH_MEMLIMIT_INTERACTIVE,
			SODIUM_CRYPTO_PWHASH_ALG_ARGON2ID13
		);

		return self::$keys[ $cache ];
	}

	/**
	 * Encrypts a file.
	 *
	 * @param string $source      Plain file.
	 * @param string $destination Encrypted file to write.
	 * @param string $password    Password.
	 * @param string $salt        Binary salt, the same for every file of one backup.
	 * @return void
	 * @throws \RuntimeException When a file cannot be read or written.
	 */
	public static function encrypt_file( $source, $destination, $password, $salt ) {
		$key = self::key( $password, $salt );
		$in  = fopen( $source, 'rb' ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fopen
		$out = fopen( $destination, 'wb' ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fopen

		if ( ! $in || ! $out ) {
			throw new \RuntimeException( esc_html__( 'A backup archive could not be encrypted: the file could not be opened.', 'vulobackup' ) );
		}

		list( $state, $header ) = sodium_crypto_secretstream_xchacha20poly1305_init_push( $key );

		clearstatcache( true, $source );

		$ok   = self::put( $out, self::MAGIC . $salt . $header );
		$size = (int) filesize( $source );
		$read = 0;

		do {
			$chunk = self::read( $in, self::CHUNK );
			$read += strlen( $chunk );
			$last  = $read >= $size || feof( $in );
			$ok    = $ok && self::put(
				$out,
				sodium_crypto_secretstream_xchacha20poly1305_push(
					$state,
					$chunk,
					'',
					$last ? SODIUM_CRYPTO_SECRETSTREAM_XCHACHA20POLY1305_TAG_FINAL : SODIUM_CRYPTO_SECRETSTREAM_XCHACHA20POLY1305_TAG_MESSAGE
				)
			);
		} while ( ! $last && $ok );

		fclose( $in ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fclose
		$ok = fclose( $out ) && $ok; // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fclose

		if ( ! $ok || $read !== $size ) {
			wp_delete_file( $destination );

			throw new \RuntimeException( esc_html__( 'A backup archive could not be encrypted. The disk may be full.', 'vulobackup' ) );
		}
	}

	/**
	 * Decrypts a file, refusing one that was changed or cut short.
	 *
	 * @param string $source      Encrypted file.
	 * @param string $destination Plain file to write.
	 * @param string $password    Password.
	 * @return void
	 * @throws \RuntimeException When the password is wrong or the file is damaged.
	 */
	public static function decrypt_file( $source, $destination, $password ) {
		$in = fopen( $source, 'rb' ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fopen

		if ( ! $in ) {
			throw new \RuntimeException( esc_html__( 'An encrypted archive could not be opened.', 'vulobackup' ) );
		}

		$magic  = self::read( $in, strlen( self::MAGIC ) );
		$salt   = self::read( $in, self::SALT_BYTES );
		$header = self::read( $in, SODIUM_CRYPTO_SECRETSTREAM_XCHACHA20POLY1305_HEADERBYTES );

		if ( self::MAGIC !== $magic || self::SALT_BYTES !== strlen( $salt ) || SODIUM_CRYPTO_SECRETSTREAM_XCHACHA20POLY1305_HEADERBYTES !== strlen( $header ) ) {
			fclose( $in ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fclose

			throw new \RuntimeException( esc_html__( 'This file is not a VuloBackup encrypted archive.', 'vulobackup' ) );
		}

		$state    = sodium_crypto_secretstream_xchacha20poly1305_init_pull( $header, self::key( $password, $salt ) );
		$out      = fopen( $destination, 'wb' ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fopen
		$finished = false;
		$ok       = (bool) $out;

		while ( $ok && ! $finished ) {
			$chunk = self::read( $in, self::CHUNK + SODIUM_CRYPTO_SECRETSTREAM_XCHACHA20POLY1305_ABYTES );

			if ( '' === $chunk ) {
				break;
			}

			$result = sodium_crypto_secretstream_xchacha20poly1305_pull( $state, $chunk );

			if ( false === $result ) {
				$ok = false;
				break;
			}

			$finished = SODIUM_CRYPTO_SECRETSTREAM_XCHACHA20POLY1305_TAG_FINAL === $result[1];
			$ok       = self::put( $out, $result[0] );
		}

		// Data after the final chunk means the file was tampered with.
		$trailing = '' !== self::read( $in, 1 );

		fclose( $in ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fclose

		if ( $out ) {
			fclose( $out ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fclose
		}

		if ( ! $ok || ! $finished || $trailing ) {
			wp_delete_file( $destination );

			throw new \RuntimeException( esc_html__( 'The archive could not be decrypted. The password is wrong, or the file is damaged.', 'vulobackup' ) );
		}
	}

	/**
	 * Reads exactly `$length` bytes, or what is left of the file. A single fread() may return fewer
	 * than asked for on some streams, and the chunk boundaries here have to be exact.
	 *
	 * @param resource $handle File handle.
	 * @param int      $length Bytes wanted.
	 * @return string
	 */
	private static function read( $handle, $length ) {
		$data = stream_get_contents( $handle, $length );

		return false === $data ? '' : $data;
	}

	/**
	 * Writes bytes to a file handle and confirms the full write.
	 *
	 * @param resource $handle File handle.
	 * @param string   $data   Bytes to write.
	 * @return bool Whether every byte was written.
	 */
	private static function put( $handle, $data ) {
		return strlen( $data ) === fwrite( $handle, $data ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fwrite
	}
}
