<?php
/**
 * AiUsageLogUtil class file.
 *
 * @package VuloCart
 */

namespace VuloCart\AI;

defined( 'ABSPATH' ) || exit;

/**
 * Insert-only log of every real AI provider call this site has made —
 * `AiClient::send()`/`generate_image()`/`embed()` write one row per
 * attempt (successful or not, `success` distinguishes), what the AI
 * top-level menu's own Usage view reads. `feature` is a short dotted tag
 * the caller supplies (e.g. `'catalog.description'`, `'checkout.fraud'`,
 * `'support.merchant'`) — the only per-feature attribution this table
 * carries, since usage isn't split into a table-per-module.
 *
 * @class       AiUsageLogUtil class
 * @version     1.0.0
 * @author      VuloLabs
 */
class AiUsageLogUtil {

	/**
	 * @return string
	 */
	public function get_table(): string {
		global $wpdb;
		return $wpdb->prefix . 'vulocart_ai_usage_log';
	}

	/**
	 * @param array<string, mixed> $data Row fields: provider, model, feature, prompt_tokens, completion_tokens, success, error_message.
	 * @return void
	 */
	public function insert( array $data ): void {
		global $wpdb;

		$wpdb->insert( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
			$this->get_table(),
			array(
				'provider'           => $data['provider'],
				'model'              => $data['model'],
				'feature'            => $data['feature'],
				'prompt_tokens'      => $data['prompt_tokens'] ?? 0,
				'completion_tokens'  => $data['completion_tokens'] ?? 0,
				'success'            => empty( $data['success'] ) ? 0 : 1,
				'error_message'      => $data['error_message'] ?? null,
			)
		);
	}

	/**
	 * @param int $limit Max rows to return, most recent first.
	 * @return array<int, array<string, mixed>>
	 */
	public function list_recent( int $limit = 50 ): array {
		global $wpdb;

		return (array) $wpdb->get_results( $wpdb->prepare( "SELECT * FROM {$this->get_table()} ORDER BY id DESC LIMIT %d", $limit ), ARRAY_A ); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
	}

	/**
	 * @return array{total_calls: int, total_prompt_tokens: int, total_completion_tokens: int, failed_calls: int}
	 */
	public function get_summary(): array {
		global $wpdb;

		$row = $wpdb->get_row( "SELECT COUNT(*) as total_calls, SUM(prompt_tokens) as total_prompt_tokens, SUM(completion_tokens) as total_completion_tokens, SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) as failed_calls FROM {$this->get_table()}", ARRAY_A ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.PreparedSQL.InterpolatedNotPrepared

		return array(
			'total_calls'              => (int) ( $row['total_calls'] ?? 0 ),
			'total_prompt_tokens'      => (int) ( $row['total_prompt_tokens'] ?? 0 ),
			'total_completion_tokens'  => (int) ( $row['total_completion_tokens'] ?? 0 ),
			'failed_calls'             => (int) ( $row['failed_calls'] ?? 0 ),
		);
	}
}
