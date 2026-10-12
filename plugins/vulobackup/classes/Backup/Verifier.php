<?php
/**
 * Verifier class file.
 *
 * @package VuloBackup
 */

namespace VuloBackup\Backup;

use VuloBackup\Storage\Destinations;
use VuloBackup\Utill;

defined( 'ABSPATH' ) || exit;

/**
 * Checks a stored backup against its manifest: every local file is present, the right size and
 * hashes to the recorded SHA-256, and every remote copy is still there at the right size.
 *
 * Hashing large archives takes time, so it works in slices like everything else.
 */
class Verifier {

	/**
	 * Continues a check.
	 *
	 * @param array $job      Backup job.
	 * @param array $state    Progress; empty to begin. Updated in place.
	 * @param float $deadline Stop when microtime(true) passes this.
	 * @return bool Whether the check is finished; `$state['problems']` then lists what is wrong.
	 */
	public function run( array $job, array &$state, $deadline ) {
		$directory = VuloBackup()->jobs->dir( $job );
		$manifest  = Manifest::read( $directory );

		if ( ! $state ) {
			$state = array(
				'index'    => 0,
				'problems' => array(),
				'checked'  => array(),
			);
		}

		if ( is_wp_error( $manifest ) ) {
			$state['problems'][] = $manifest->get_error_message();

			return true;
		}

		$parts = $manifest['parts'];
		$count = count( $parts );

		while ( ! empty( $job['local'] ) && $state['index'] < $count ) {
			$part    = $parts[ $state['index'] ];
			$problem = self::part_problem( $directory, $part );

			if ( null !== $problem ) {
				$state['problems'][] = $problem;
			}

			++$state['index'];

			if ( microtime( true ) > $deadline && $state['index'] < $count ) {
				return false;
			}
		}

		if ( ! empty( $job['local'] ) ) {
			$state['checked'][] = __( 'This server', 'vulobackup' );
		}

		foreach ( (array) ( $job['copies'] ?? array() ) as $id => $copy ) {
			if ( 'uploaded' !== ( $copy['status'] ?? '' ) || isset( $state['remote'][ $id ] ) ) {
				continue;
			}

			$state['remote'][ $id ] = true;

			$destination = VuloBackup()->destinations->get( $id );
			$provider    = $destination ? VuloBackup()->destinations->provider( $destination['provider'] ) : null;

			if ( ! $provider ) {
				/* translators: %s: destination name. */
				$state['problems'][] = sprintf( __( '%s is no longer configured, so the copy there could not be checked.', 'vulobackup' ), $copy['name'] );
				continue;
			}

			VuloBackup()->logger->hide( VuloBackup()->destinations->secret_values( $provider, $destination['config'] ) );

			foreach ( $parts as $part ) {
				$result = $provider->verify( $destination['config'], Destinations::remote_name( $job['id'], $part['name'] ), $part['bytes'] );

				if ( is_wp_error( $result ) ) {
					/* translators: 1: destination name, 2: file name, 3: error. */
					$state['problems'][] = sprintf( __( '%1$s: %2$s. %3$s', 'vulobackup' ), $copy['name'], $part['name'], $result->get_error_message() );
					break;
				}
			}

			$state['checked'][] = $copy['name'];

			if ( microtime( true ) > $deadline ) {
				return false;
			}
		}

		if ( empty( $job['local'] ) && ! Retention::has_remote( $job ) ) {
			$state['problems'][] = __( 'No copy of this backup is left, here or at a remote destination.', 'vulobackup' );
		}

		return true;
	}

	/**
	 * What is wrong with one local file of a backup, or null when it is intact.
	 *
	 * @param string $directory The backup's folder.
	 * @param array  $part      Part from the manifest.
	 * @return string|null
	 */
	public static function part_problem( $directory, array $part ) {
		$path = $directory . '/' . $part['name'];

		if ( ! is_file( $path ) ) {
			/* translators: %s: file name. */
			return sprintf( __( '%s is missing.', 'vulobackup' ), $part['name'] );
		}

		if ( (int) filesize( $path ) !== (int) $part['bytes'] ) {
			/* translators: %s: file name. */
			return sprintf( __( '%s is not the size the manifest records; it is damaged or incomplete.', 'vulobackup' ), $part['name'] );
		}

		if ( ! hash_equals( $part['sha256'], (string) hash_file( 'sha256', $path ) ) ) {
			/* translators: %s: file name. */
			return sprintf( __( '%s does not match its recorded checksum; it has been changed or is corrupted.', 'vulobackup' ), $part['name'] );
		}

		return null;
	}

	/**
	 * Records the outcome of a finished check on the backup.
	 *
	 * @param array $job   Backup job.
	 * @param array $state Finished state from run().
	 * @return array The job, saved.
	 */
	public static function record( array $job, array $state ) {
		$job['verified']        = ! $state['problems'];
		$job['verified_at']     = Utill::now();
		$job['verify_problems'] = $state['problems'];

		unset( $job['verify_state'] );

		VuloBackup()->jobs->save( $job );
		VuloBackup()->logger->log(
			$state['problems'] ? \VuloBackup\Logging\Logger::LEVEL_ERROR : \VuloBackup\Logging\Logger::LEVEL_INFO,
			$state['problems'] ? 'verify_failed' : 'verify_passed',
			$state['problems']
				/* translators: 1: backup name, 2: what is wrong. */
				? sprintf( __( 'Backup "%1$s" failed its integrity check. %2$s', 'vulobackup' ), $job['name'], implode( ' ', $state['problems'] ) )
				/* translators: %s: backup name. */
				: sprintf( __( 'Backup "%s" passed its integrity check.', 'vulobackup' ), $job['name'] ),
			array( 'job' => $job['id'] )
		);

		return $job;
	}
}
