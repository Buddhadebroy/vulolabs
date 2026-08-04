<?php
/**
 * AiProviderConfigUtil class file.
 *
 * @package VuloCart
 */

namespace VuloCart\AI;

defined( 'ABSPATH' ) || exit;

/**
 * Plain `$wpdb` CRUD over `vulocart_ai_provider_configs` — same Util shape
 * `vulocart-pro`'s own per-table Util classes use (ZoneUtil, RateUtil, ...).
 * `credentials` is always the AES-256-CBC-encrypted form
 * (Services\CredentialEncryption); this class never decrypts — that's
 * ProviderRegistry::build_provider()'s job, the one place a raw key is
 * actually needed.
 *
 * @class       AiProviderConfigUtil class
 * @version     1.0.0
 * @author      VuloLabs
 */
class AiProviderConfigUtil {

	/**
	 * @return string
	 */
	public function get_table(): string {
		global $wpdb;
		return $wpdb->prefix . 'vulocart_ai_provider_configs';
	}

	/**
	 * @return array<int, array<string, mixed>>
	 */
	public function list_all(): array {
		global $wpdb;

		return (array) $wpdb->get_results( "SELECT * FROM {$this->get_table()} ORDER BY id ASC", ARRAY_A ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.PreparedSQL.InterpolatedNotPrepared
	}

	/**
	 * @param string $provider e.g. 'openai'.
	 * @return array<string, mixed>|null
	 */
	public function find_by_provider( string $provider ) {
		global $wpdb;

		$row = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM {$this->get_table()} WHERE provider = %s", $provider ), ARRAY_A ); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared

		return $row ?: null;
	}

	/**
	 * Creates or replaces one provider's own config row (one row per
	 * provider id — a second save for the same provider overwrites the
	 * first rather than accumulating history).
	 *
	 * @param string $provider           e.g. 'openai'.
	 * @param string $encrypted_credential Already-encrypted API key.
	 * @param string $model              Chosen model id.
	 * @param bool   $is_active          Whether this provider is currently usable.
	 * @return array<string, mixed>
	 */
	public function upsert( string $provider, string $encrypted_credential, string $model, bool $is_active ): array {
		global $wpdb;

		$existing = $this->find_by_provider( $provider );
		$data     = array(
			'provider'    => $provider,
			'credentials' => $encrypted_credential,
			'model'       => $model,
			'is_active'   => $is_active ? 1 : 0,
		);

		if ( $existing ) {
			$wpdb->update( $this->get_table(), $data, array( 'id' => $existing['id'] ) ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		} else {
			$wpdb->insert( $this->get_table(), $data ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		}

		return $this->find_by_provider( $provider );
	}

	/**
	 * @param string $provider e.g. 'openai'.
	 * @return bool True if a config row was found and deleted.
	 */
	public function delete( string $provider ): bool {
		if ( ! $this->find_by_provider( $provider ) ) {
			return false;
		}

		global $wpdb;

		return false !== $wpdb->delete( $this->get_table(), array( 'provider' => $provider ) ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
	}
}
