<?php
/**
 * CredentialEncryption class file.
 *
 * @package VuloCart
 */

namespace VuloCart\AI\Services;

defined( 'ABSPATH' ) || exit;

/**
 * Encrypts/decrypts third-party AI provider API keys before they touch
 * `vulocart_ai_provider_configs.credentials` — same construction as
 * vulopilot's own `Services\CredentialEncryption`: the key is derived from
 * `wp_salt('auth')` rather than stored anywhere in the database, so it
 * moves (or is lost) exactly when the rest of the site's own secrets
 * would too. AES-256-CBC, random IV per call, IV prepended to the
 * ciphertext.
 *
 * @class       CredentialEncryption class
 * @version     1.0.0
 * @author      VuloLabs
 */
class CredentialEncryption {

	const CIPHER = 'aes-256-cbc';

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
	public static function decrypt( string $encoded ) {
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
