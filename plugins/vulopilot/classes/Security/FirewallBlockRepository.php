<?php
/**
 * FirewallBlockRepository class file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\Security;

use VuloPilot\Utill\RepositoryUtil;


defined( 'ABSPATH' ) || exit;

/**
 * Persistence for `vulopilot_security_events` (type `firewall_block`).
 *
 * @class       FirewallBlockRepository class
 * @version     1.0.0
 * @author      VuloLabs
 */
class FirewallBlockRepository extends RepositoryUtil {

	/**
	 * This repository's `event_type` in the shared `vulopilot_security_events` table.
	 */
	private const EVENT_TYPE = 'firewall_block';

	/**
	 * @var string[]
	 */
	protected array $filterable_columns = array( 'ip_address', 'action' );

	/**
	 * @inheritDoc
	 */
	/**
	 * @inheritDoc
	 */
	public function insert( array $data ): int {
		$data['event_type'] = self::EVENT_TYPE;

		return parent::insert( $data );
	}

	protected function get_table_key(): string {
		return 'security_event';
	}

	/**
	 * Real block/log-row count in the last N days -
	 * FirewallScanner's own summary count.
	 *
	 * @param int $days Real lookback window.
	 * @return int
	 */
	public function count_recent( int $days ): int {
		global $wpdb;

		return (int) $wpdb->get_var(  // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching  -- {$this->get_table()}/$table-style variables here are always this plugin's own hardcoded table name(s), never user input; dynamic placeholder counts (IN (...) lists, optional WHERE fragments) are sized correctly at runtime, just not statically visible to this sniff.
			$wpdb->prepare(
				'SELECT COUNT(*) FROM %i WHERE event_type = %s AND created_at >= %s',
				$this->get_table(), // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
				self::EVENT_TYPE,
				gmdate( 'Y-m-d H:i:s', time() - ( $days * DAY_IN_SECONDS ) )
			)
		);
	}

	/**
	 * The single IP with the most matched-rule rows in the last N days.
	 *
	 * @param int $days Real lookback window.
	 * @return array{ip_address: string, hit_count: int}|null
	 */
	public function get_most_active_ip( int $days ): ?array {
		global $wpdb;

		$row = $wpdb->get_row(  // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching  -- {$this->get_table()}/$table-style variables here are always this plugin's own hardcoded table name(s), never user input; dynamic placeholder counts (IN (...) lists, optional WHERE fragments) are sized correctly at runtime, just not statically visible to this sniff.
			$wpdb->prepare(
				'SELECT ip_address, COUNT(*) AS hit_count FROM %i WHERE event_type = %s AND created_at >= %s GROUP BY ip_address ORDER BY hit_count DESC LIMIT 1',
				$this->get_table(), // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
				self::EVENT_TYPE,
				gmdate( 'Y-m-d H:i:s', time() - ( $days * DAY_IN_SECONDS ) )
			),
			ARRAY_A
		);

		if ( ! $row ) {
			return null;
		}

		return array(
			'ip_address' => (string) $row['ip_address'],
			'hit_count'  => (int) $row['hit_count'],
		);
	}
}
