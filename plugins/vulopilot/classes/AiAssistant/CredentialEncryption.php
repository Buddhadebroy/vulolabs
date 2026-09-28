<?php
namespace VuloPilot\AiAssistant;

defined( 'ABSPATH' ) || exit;

/**
 * Encrypts/decrypts third-party secrets (Backups' S3/Drive credentials, the site secret,
 * Google tokens) before they're stored.
 *
 * @class       CredentialEncryption class
 * @version     1.0.0
 * @author      VuloLabs
 */
class CredentialEncryption {

	private const CIPHER = 'aes-256-cbc';

	/**
	 * @return string 32 raw bytes, suitable for aes-256-cbc.
	 */
	private static function get_key(): string {
		return hash( 'sha256', wp_salt( 'auth' ), true );
	}

	/**
	 * @param string $plaintext The raw API key.
	 * @return string Base64-encoded IV + ciphertext.
	 */
	public static function encrypt( string $plaintext ): string {
		$iv         = random_bytes( openssl_cipher_iv_length( self::CIPHER ) );
		$ciphertext = openssl_encrypt( $plaintext, self::CIPHER, self::get_key(), OPENSSL_RAW_DATA, $iv );

		return base64_encode( $iv . $ciphertext ); // phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_encode -- binary-to-text encoding of AES ciphertext, not code obfuscation.
	}

	/**
	 * @param string $encoded Value previously returned by encrypt().
	 * @return string|null The original plaintext, or null if $encoded is malformed/undecryptable.
	 */
	public static function decrypt( string $encoded ): ?string {
		$raw       = base64_decode( $encoded, true ); // phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_decode -- reversing encrypt()'s binary-to-text encoding, not code obfuscation.
		$iv_length = openssl_cipher_iv_length( self::CIPHER );

		if ( false === $raw || strlen( $raw ) <= $iv_length ) {
			return null;
		}

		$iv         = substr( $raw, 0, $iv_length );
		$ciphertext = substr( $raw, $iv_length );
		$plaintext  = openssl_decrypt( $ciphertext, self::CIPHER, self::get_key(), OPENSSL_RAW_DATA, $iv );

		return false === $plaintext ? null : $plaintext;
	}
}
