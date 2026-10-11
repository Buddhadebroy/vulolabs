<?php
/**
 * Retention class file.
 *
 * @package VuloBackup
 */

namespace VuloBackup\Backup;

use VuloBackup\Jobs\Store;
use VuloBackup\Logging\Logger;
use VuloBackup\Storage\Destinations;
use VuloBackup\Utill;

defined( 'ABSPATH' ) || exit;

/**
 * Removes backups beyond the number the administrator chose to keep.
 *
 * It only ever runs at the end of a backup that completed and was verified, so a failing backup
 * can never cause older, good ones to be deleted. Local and remote copies are counted separately.
 * Backups that were imported are the administrator's to manage and are never pruned; the safety
 * backups taken before a restore are kept two deep.
 */
class Retention {

	const SAFETY_KEPT = 2;

	/**
	 * What would be removed now, without removing anything.
	 *
	 * @param string $current Id of a verified backup that is in its last step, if there is one.
	 * @return array{local: array[], remote: array[], records: array[]} Each entry is a backup job;
	 *         `remote` entries carry a `destination` id.
	 */
	public function plan( $current = '' ) {
		$settings = VuloBackup()->settings;
		$keep     = (int) $settings->get( 'retention_count' );
		$remote   = (int) $settings->get( 'retention_remote_count' );
		$plan     = array(
			'local'   => array(),
			'remote'  => array(),
			'records' => array(),
		);

		$regular = array();
		$safety  = array();

		foreach ( VuloBackup()->jobs->all( Store::KIND_BACKUP ) as $job ) {
			// The backup that is just finishing counts as kept: it is verified, only not yet marked done.
			if ( ( 'completed' !== $job['status'] && $job['id'] !== $current ) || 'import' === ( $job['trigger'] ?? '' ) ) {
				continue;
			}

			if ( 'safety' === ( $job['trigger'] ?? '' ) ) {
				$safety[] = $job;
			} else {
				$regular[] = $job;
			}
		}

		// Newest first. The newest verified backup is never removed, whatever the settings say.
		$local_seen = 0;
		$per_dest   = array();

		foreach ( $regular as $job ) {
			if ( ! empty( $job['local'] ) ) {
				++$local_seen;

				if ( $keep > 0 && $local_seen > $keep ) {
					$plan['local'][] = $job;
				}
			}

			foreach ( (array) ( $job['copies'] ?? array() ) as $destination => $copy ) {
				if ( 'uploaded' !== ( $copy['status'] ?? '' ) ) {
					continue;
				}

				$per_dest[ $destination ] = ( $per_dest[ $destination ] ?? 0 ) + 1;

				if ( $remote > 0 && $per_dest[ $destination ] > $remote ) {
					$plan['remote'][] = array_merge( $job, array( 'destination' => $destination ) );
				}
			}
		}

		foreach ( array_slice( $safety, self::SAFETY_KEPT ) as $job ) {
			$plan['local'][] = $job;
		}

		return $plan;
	}

	/**
	 * Removes what plan() lists.
	 *
	 * @param string $current Id of the verified backup that triggered this, if there is one.
	 * @return string[] One line per thing done, for the log of the backup that triggered it.
	 */
	public function apply( $current = '' ) {
		$plan  = $this->plan( $current );
		$lines = array();
		$jobs  = VuloBackup()->jobs;

		foreach ( $plan['remote'] as $entry ) {
			$job = $jobs->get( Store::KIND_BACKUP, $entry['id'] );

			if ( ! $job ) {
				continue;
			}

			$result = self::delete_remote( $job, $entry['destination'] );
			$name   = (string) ( $job['copies'][ $entry['destination'] ]['name'] ?? '' );

			if ( is_wp_error( $result ) ) {
				/* translators: 1: backup name, 2: destination name, 3: error. */
				$lines[] = sprintf( __( 'Could not remove old backup "%1$s" from %2$s. %3$s', 'vulobackup' ), $job['name'], $name, $result->get_error_message() );

				VuloBackup()->logger->log( Logger::LEVEL_WARNING, 'retention_failed', end( $lines ), array( 'job' => $job['id'] ) );
				continue;
			}

			/* translators: 1: backup name, 2: destination name. */
			$lines[] = sprintf( __( 'Removed old backup "%1$s" from %2$s.', 'vulobackup' ), $job['name'], $name );

			VuloBackup()->logger->log( Logger::LEVEL_INFO, 'retention', end( $lines ), array( 'job' => $job['id'] ) );
		}

		foreach ( $plan['local'] as $entry ) {
			$job = $jobs->get( Store::KIND_BACKUP, $entry['id'] );

			if ( ! $job ) {
				continue;
			}

			self::delete_local( $job );

			/* translators: %s: backup name. */
			$lines[] = sprintf( __( 'Removed old backup "%s" from this server.', 'vulobackup' ), $job['name'] );

			VuloBackup()->logger->log( Logger::LEVEL_INFO, 'retention', end( $lines ), array( 'job' => $job['id'] ) );
		}

		return $lines;
	}

	/**
	 * Removes a backup's archives from this server. The record goes too once no copy is left
	 * anywhere.
	 *
	 * @param array $job Backup job.
	 * @return void
	 */
	public static function delete_local( array $job ) {
		$jobs      = VuloBackup()->jobs;
		$directory = $jobs->dir( $job );
		$manifest  = Manifest::read( $directory );

		foreach ( is_wp_error( $manifest ) ? array() : $manifest['parts'] as $part ) {
			if ( file_exists( $directory . '/' . $part['name'] ) ) {
				wp_delete_file( $directory . '/' . $part['name'] );
			}
		}

		$job['local'] = false;

		if ( self::has_remote( $job ) ) {
			$jobs->save( $job );
		} else {
			$jobs->delete( Store::KIND_BACKUP, $job['id'] );
		}
	}

	/**
	 * Removes a backup from one remote destination.
	 *
	 * @param array  $job            Backup job.
	 * @param string $destination_id Destination id.
	 * @return true|\WP_Error
	 */
	public static function delete_remote( array $job, $destination_id ) {
		$jobs        = VuloBackup()->jobs;
		$destination = VuloBackup()->destinations->get( $destination_id );
		$provider    = $destination ? VuloBackup()->destinations->provider( $destination['provider'] ) : null;
		$manifest    = Manifest::read( $jobs->dir( $job ) );

		if ( ! $provider ) {
			return new \WP_Error( 'vulobackup_storage', __( 'That destination is no longer configured, so the copy there could not be removed.', 'vulobackup' ) );
		}

		if ( is_wp_error( $manifest ) ) {
			return $manifest;
		}

		VuloBackup()->logger->hide( VuloBackup()->destinations->secret_values( $provider, $destination['config'] ) );

		foreach ( array_merge( array_column( $manifest['parts'], 'name' ), array( Manifest::FILE ) ) as $name ) {
			$deleted = $provider->delete( $destination['config'], Destinations::remote_name( $job['id'], $name ) );

			if ( is_wp_error( $deleted ) ) {
				return $deleted;
			}
		}

		$job['copies'][ $destination_id ]['status']     = 'deleted';
		$job['copies'][ $destination_id ]['deleted_at'] = Utill::now();

		if ( empty( $job['local'] ) && ! self::has_remote( $job ) ) {
			$jobs->delete( Store::KIND_BACKUP, $job['id'] );
		} else {
			$jobs->save( $job );
		}

		return true;
	}

	/**
	 * @param array $job Backup job.
	 * @return bool Whether any remote destination still holds the backup.
	 */
	public static function has_remote( array $job ) {
		foreach ( (array) ( $job['copies'] ?? array() ) as $copy ) {
			if ( 'uploaded' === ( $copy['status'] ?? '' ) ) {
				return true;
			}
		}

		return false;
	}
}
