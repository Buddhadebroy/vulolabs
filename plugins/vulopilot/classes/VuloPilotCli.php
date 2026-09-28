<?php
/**
 * VuloPilotCli class file.
 *
 * @package VuloPilot
 */

namespace VuloPilot;

use VuloPilot\Reports\ReportRepository;
use VuloPilot\Utill\ScanRepository;
use VuloPilot\Utill;

defined( 'ABSPATH' ) || exit;

/**
 * Real WP-CLI commands - `wp vulopilot scan run|list`, `wp vulopilot report generate`, `wp
 * vulopilot extensions list`, `wp vulopilot settings get|set|reset`.
 *
 * @class       VuloPilotCli class
 * @version     1.0.0
 * @author      VuloLabs
 */
class VuloPilotCli {

	/**
	 * Registers every subcommand - one `WP_CLI::add_command()` call per command path, so
	 * `wp vulopilot scan run` and `wp vulopilot scan list` are distinct.
	 *
	 * @return void
	 */
	public static function register(): void {
		$command = new self();

		\WP_CLI::add_command( 'vulopilot scan run', array( $command, 'scan_run' ) );
		\WP_CLI::add_command( 'vulopilot scan list', array( $command, 'scan_list' ) );
		\WP_CLI::add_command( 'vulopilot report generate', array( $command, 'report_generate' ) );
		\WP_CLI::add_command( 'vulopilot extensions list', array( $command, 'extensions_list' ) );
		\WP_CLI::add_command( 'vulopilot settings get', array( $command, 'settings_get' ) );
		\WP_CLI::add_command( 'vulopilot settings set', array( $command, 'settings_set' ) );
		\WP_CLI::add_command( 'vulopilot settings reset', array( $command, 'settings_reset' ) );
	}

	/**
	 * Runs one scanner, every scanner in a category, or every scanner. ## OPTIONS
	 * [<scanner-id>] : A specific scanner's id.
	 *
	 * @param string[]             $args       Positional arguments.
	 * @param array<string, mixed> $assoc_args Associative (--flag) arguments.
	 * @return void
	 */
	public function scan_run( array $args, array $assoc_args ): void {
		$runner   = VuloPilot()->scan_runner;
		$category = $assoc_args['category'] ?? null;
		$force    = isset( $assoc_args['force'] );

		if ( $category ) {
			$results = $runner->run_category( sanitize_key( $category ), $force );
		} elseif ( ! empty( $args[0] ) ) {
			$result = $runner->run( sanitize_key( $args[0] ), $force );

			if ( null === $result ) {
				\WP_CLI::error( sprintf( 'No scanner registered with id "%s".', $args[0] ) );
				return;
			}

			$results = array( $args[0] => $result );
		} else {
			$results = $runner->run_all( $force );
		}

		foreach ( $results as $scanner_id => $result ) {
			if ( null === $result ) {
				\WP_CLI::warning( sprintf( '%s: no scanner registered under that id.', $scanner_id ) );
				continue;
			}

			\WP_CLI::log(
				sprintf(
					'%s: %s (%d finding(s), %dms)',
					$scanner_id,
					$result->get_status(),
					count( $result->get_findings() ),
					(int) $result->get_duration_ms()
				)
			);
		}

		\WP_CLI::success( sprintf( 'Ran %d scanner(s).', count( $results ) ) );
	}

	/**
	 * Lists recent scans. ## OPTIONS [--status=<status>] : Filter by status (queued,
	 * running, completed, failed, cancelled). [--per-page=<per-page>] : Max rows to show.
	 *
	 * @param string[]             $args       Positional arguments.
	 * @param array<string, mixed> $assoc_args Associative (--flag) arguments.
	 * @return void
	 */
	public function scan_list( array $args, array $assoc_args ): void {
		$repository = new ScanRepository();

		$result = $repository->find_all(
			array(
				'status'   => sanitize_key( (string) ( $assoc_args['status'] ?? '' ) ),
				'per_page' => absint( $assoc_args['per-page'] ?? 20 ) ? absint( $assoc_args['per-page'] ?? 20 ) : 20,
			)
		);

		\WP_CLI\Utils\format_items(
			'table',
			$result['data'],
			array( 'id', 'scanner_id', 'status', 'trigger_type', 'created_at' )
		);

		\WP_CLI::log( sprintf( '%d total.', $result['total'] ) );
	}

	/**
	 * Generates a report synchronously. ## OPTIONS --type=<type> : Report type id
	 * (REPORTS' own `GET /reports/types`, or 'custom'). [--format=<format>] : csv, json,
	 * or pdf.
	 *
	 * @param string[]             $args       Positional arguments.
	 * @param array<string, mixed> $assoc_args Associative (--flag) arguments.
	 * @return void
	 */
	public function report_generate( array $args, array $assoc_args ): void {
		if ( empty( $assoc_args['type'] ) ) {
			\WP_CLI::error( '--type is required.' );
			return;
		}

		if ( ! VuloPilot()->report_generator ) {
			\WP_CLI::error( 'Report generation requires VuloPilot Pro.' );
			return;
		}

		$settings     = wp_parse_args( get_option( Utill::VULOPILOT_SETTINGS_KEY, array() ), Utill::VULOPILOT_SETTINGS_DEFAULTS );
		$report_type  = sanitize_key( (string) $assoc_args['type'] );
		$format       = sanitize_key( (string) ( $assoc_args['format'] ?? $settings['default_report_format'] ) );
		$period_days  = max( 1, absint( $assoc_args['period-days'] ?? $settings['default_report_period_days'] ) ? absint( $assoc_args['period-days'] ?? $settings['default_report_period_days'] ) : 30 );
		$period_end   = current_time( 'Y-m-d' );
		$period_start = gmdate( 'Y-m-d', strtotime( '-' . ( $period_days - 1 ) . ' days', strtotime( $period_end ) ) );

		$report_id = VuloPilot()->report_generator->generate( $report_type, $format, $period_start, $period_end );
		$report    = ( new ReportRepository() )->find( $report_id );

		if ( ! $report || 'ready' !== $report['status'] ) {
			\WP_CLI::error( sprintf( 'Report generation failed (status: %s). Check the Reports page or the error log if debug logging is enabled.', $report['status'] ?? 'unknown' ) );
			return;
		}

		\WP_CLI::success( sprintf( 'Report #%d generated: %s', $report_id, $report['file_path'] ) );
	}

	/**
	 * Lists registered extensions and any skipped for a version mismatch.
	 *
	 * @return void
	 */
	public function extensions_list(): void {
		$manager = VuloPilot()->extension_manager;

		foreach ( $manager->get_all_extensions() as $extension ) {
			\WP_CLI::log( sprintf( '%s (v%s) - active', $extension->get_name(), $extension->get_version() ) );
		}

		foreach ( $manager->get_incompatible_extensions() as $extension ) {
			\WP_CLI::log(
				sprintf(
					'%s (v%s) - SKIPPED, requires VuloPilot %s or newer',
					$extension['name'],
					$extension['version'],
					$extension['required']
				)
			);
		}

		if ( empty( $manager->get_all_extensions() ) && empty( $manager->get_incompatible_extensions() ) ) {
			\WP_CLI::log( 'No extensions registered.' );
		}
	}

	/**
	 * Prints one setting, or every setting as JSON when no key is given. ## OPTIONS
	 * [<key>] : A settings key (see the Settings screen).
	 *
	 * @param string[] $args Positional arguments.
	 * @return void
	 */
	public function settings_get( array $args ): void {
		$settings = wp_parse_args( get_option( Utill::VULOPILOT_SETTINGS_KEY, array() ), Utill::VULOPILOT_SETTINGS_DEFAULTS );

		if ( empty( $args[0] ) ) {
			\WP_CLI::log( (string) wp_json_encode( $settings, JSON_PRETTY_PRINT ) );
			return;
		}

		if ( ! array_key_exists( $args[0], $settings ) ) {
			\WP_CLI::error( sprintf( 'Unknown setting "%s".', $args[0] ) );
			return;
		}

		\WP_CLI::log( (string) wp_json_encode( $settings[ $args[0] ] ) );
	}

	/**
	 * Sets one setting. ## OPTIONS <key> : A settings key (see the Settings screen).
	 * <value> : The new value.
	 *
	 * @param string[] $args Positional arguments.
	 * @return void
	 */
	public function settings_set( array $args ): void {
		[ $key, $value ] = array_pad( $args, 2, null );

		if ( ! array_key_exists( (string) $key, Utill::VULOPILOT_SETTINGS_DEFAULTS ) ) {
			\WP_CLI::error( sprintf( 'Unknown setting "%s".', $key ) );
			return;
		}

		$settings = wp_parse_args( get_option( Utill::VULOPILOT_SETTINGS_KEY, array() ), Utill::VULOPILOT_SETTINGS_DEFAULTS );

		$default          = Utill::VULOPILOT_SETTINGS_DEFAULTS[ $key ];
		$settings[ $key ] = is_bool( $default ) ? in_array( strtolower( (string) $value ), array( 'true', '1' ), true ) : $value;

		update_option( Utill::VULOPILOT_SETTINGS_KEY, $settings );

		\WP_CLI::success( sprintf( '%s set to %s.', $key, wp_json_encode( $settings[ $key ] ) ) );
	}

	/**
	 * Resets every setting back to its default value.
	 *
	 * @return void
	 */
	public function settings_reset(): void {
		delete_option( Utill::VULOPILOT_SETTINGS_KEY );
		\WP_CLI::success( 'Settings reset to defaults.' );
	}
}
