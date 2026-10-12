<?php
/**
 * Storage Provider interface file.
 *
 * @package VuloBackup
 */

namespace VuloBackup\Storage;

defined( 'ABSPATH' ) || exit;

/**
 * A place outside this server where copies of backups are kept.
 *
 * The backup engine only ever talks to this interface, so a provider can be added (see the
 * `vulobackup_storage_providers` filter) without touching it. Transfers are resumable: a call works
 * until the deadline, records where it got to in `$state`, and is called again.
 *
 * A provider never logs its configuration, and returns errors that are safe to show.
 */
interface Provider {

	/**
	 * Machine name of this provider.
	 *
	 * @return string Machine name, e.g. `s3`.
	 */
	public function id();

	/**
	 * Name shown to the administrator.
	 *
	 * @return string Name shown to the administrator.
	 */
	public function label();

	/**
	 * The settings a destination of this kind needs.
	 *
	 * @return array[] Each: key, label, type (text|number|password|textarea|toggle), and optionally
	 *                 secret (bool), required (bool), placeholder, help, default.
	 */
	public function fields();

	/**
	 * Checks a configuration by writing, reading back and deleting a small file.
	 *
	 * @param array $config Field values.
	 * @return array|\WP_Error On success, values to merge into the stored configuration (for
	 *                         example a server fingerprint); an empty array when there are none.
	 */
	public function test( array $config );

	/**
	 * One line saying where this destination is, without any secret.
	 *
	 * @param array $config Field values.
	 * @return string
	 */
	public function describe( array $config );

	/**
	 * Uploads a file, continuing from `$state`.
	 *
	 * @param array  $config   Field values.
	 * @param string $local    File to send.
	 * @param string $remote   Path at the destination, relative to its root.
	 * @param array  $state    Progress; empty to begin. Updated in place.
	 * @param float  $deadline Stop when microtime(true) passes this.
	 * @return bool|\WP_Error True when the whole file is sent, false when there is more to do.
	 */
	public function upload( array $config, $local, $remote, array &$state, $deadline );

	/**
	 * Confirms a file is at the destination and has the expected size.
	 *
	 * @param array  $config Field values.
	 * @param string $remote Path at the destination.
	 * @param int    $bytes  Expected size.
	 * @return true|\WP_Error
	 */
	public function verify( array $config, $remote, $bytes );

	/**
	 * Downloads a file, continuing from `$state`.
	 *
	 * @param array  $config   Field values.
	 * @param string $remote   Path at the destination.
	 * @param string $local    File to write.
	 * @param int    $bytes    Expected size.
	 * @param array  $state    Progress; empty to begin. Updated in place.
	 * @param float  $deadline Stop when microtime(true) passes this.
	 * @return bool|\WP_Error True when the whole file is fetched, false when there is more to do.
	 */
	public function download( array $config, $remote, $local, $bytes, array &$state, $deadline );

	/**
	 * Deletes a file. A file that is already gone is not an error.
	 *
	 * @param array  $config Field values.
	 * @param string $remote Path at the destination.
	 * @return true|\WP_Error
	 */
	public function delete( array $config, $remote );

	/**
	 * Abandons an unfinished upload, releasing anything the destination holds for it.
	 *
	 * @param array  $config Field values.
	 * @param string $remote Path at the destination.
	 * @param array  $state  Progress of the upload.
	 * @return void
	 */
	public function abort( array $config, $remote, array $state );
}
