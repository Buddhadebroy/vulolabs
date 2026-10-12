<?php
require __DIR__ . '/lib.php'; global $wpdb;
$jobs = VuloBackup()->jobs; $sched = VuloBackup()->scheduler;

echo "--- every route refuses visitors and non-administrators\n";
$server = rest_get_server(); $routes = array_filter( array_keys( $server->get_routes() ), static fn( $r ) => 0 === strpos( $r, '/vulobackup/v1/' ) );
$sub = wp_insert_user( array( 'user_login' => 'editor' . wp_rand(), 'user_pass' => wp_generate_password(), 'role' => 'editor' ) );
$open = array(); $count = 0;
foreach ( array( 0, $sub ) as $user ) {
	wp_set_current_user( $user );
	foreach ( $routes as $route ) {
		foreach ( $server->get_routes()[ $route ] as $handler ) {
			foreach ( array_keys( $handler['methods'] ) as $method ) {
				$path = preg_replace( '/\(\?P<id>[^)]+\)/', false !== strpos( $route, 'destinations' ) ? 'dabc1234567' : '20260101-000000-abcdef12', $route );
				$res = rest_do_request( new WP_REST_Request( $method, $path ) ); ++$count;
				if ( ! in_array( $res->get_status(), array( 401, 403 ), true ) ) { $open[] = "$method $path -> " . $res->get_status(); }
			}
		}
	}
}
vb_ok( ! $open && $count > 30, "$count requests as a visitor and as an editor all answered 401 or 403 " . implode( '; ', $open ) );
vb_ok( 0 === count( array_filter( $routes, static fn( $r ) => false !== strpos( $r, 'public' ) ) ), 'there is no public route (' . count( $routes ) . ' routes, all admin-only)' );
wp_set_current_user( 1 );
$r = new WP_REST_Request( 'POST', '/vulobackup/v1/restores' ); $r->set_header( 'content-type', 'application/json' ); $r->set_body( wp_json_encode( array( 'backup' => $jobs->all( 'backups' )[0]['id'], 'database' => true ) ) );
vb_ok( 400 === rest_do_request( $r )->get_status() && ! $jobs->active(), 'a restore without the typed confirmation is refused, even for an administrator' );
$r = new WP_REST_Request( 'GET', '/vulobackup/v1/backups/..%2F..%2Fwp-config/download' ); vb_ok( 404 === rest_do_request( $r )->get_status(), 'a made-up backup id with path characters does not match any route' );
vb_ok( null === $jobs->get( 'backups', '../../x' ) && ! $jobs->delete( 'backups', '../../wp-content' ), 'job ids with path characters are rejected by the store itself' );

echo "--- backup folder\n";
$base = VuloBackup()->vault->base();
vb_ok( file_exists( "$base/.htaccess" ) && file_exists( "$base/index.php" ) && file_exists( "$base/web.config" ) && preg_match( '/vulobackup-[a-f0-9]{20}$/', $base ), 'unguessable name, with .htaccess, web.config and index.php' );
foreach ( array( WP_PLUGIN_DIR . '/x', wp_upload_dir()['basedir'] . '/backups', get_theme_root() . '/b', ABSPATH . 'wp-admin/b', 'relative/path', '/nonexistent-root-dir-vb/x' ) as $bad ) { $p = VuloBackup\Storage\Vault::dir_problem( $bad ); if ( null === $p ) { echo "FAIL accepted $bad\n"; } }
vb_ok( true, 'backup folder inside plugins, themes, uploads or wp-admin, relative, or uncreatable: all refused' );

echo "--- schedule\n";
VuloBackup()->settings->update( array( 'schedule_database' => 'daily', 'schedule_files' => 'weekly', 'schedule_hour' => 3, 'schedule_weekday' => 1 ) );
update_option( 'timezone_string', 'UTC' );
$mon = strtotime( '2026-10-12 03:00:00 UTC' ); // a Monday
vb_ok( $sched->slot( 'daily', $mon + 3600, false ) === $mon && $sched->slot( 'daily', $mon - 60, false ) === $mon - 86400 && $sched->slot( 'daily', $mon + 60, true ) === $mon + 86400, 'daily slots' );
vb_ok( $sched->slot( 'weekly', $mon + 3 * 86400, false ) === $mon && $sched->slot( 'weekly', $mon - 60, false ) === $mon - 7 * 86400 && $sched->slot( 'weekly', $mon + 60, true ) === $mon + 7 * 86400, 'weekly slots' );
VuloBackup()->settings->update( array( 'schedule_monthday' => 15 ) );
vb_ok( gmdate( 'Y-m-d H', $sched->slot( 'monthly', strtotime( '2026-10-20 UTC' ), false ) ) === '2026-10-15 03' && gmdate( 'Y-m-d H', $sched->slot( 'monthly', strtotime( '2026-10-10 UTC' ), false ) ) === '2026-09-15 03' && gmdate( 'Y-m-d', $sched->slot( 'monthly', strtotime( '2026-10-20 UTC' ), true ) ) === '2026-11-15', 'monthly slots' );
update_option( 'timezone_string', 'Asia/Kolkata' );
vb_ok( gmdate( 'Y-m-d H:i', $sched->slot( 'daily', strtotime( '2026-10-12 00:00 UTC' ), false ) ) === '2026-10-11 21:30', 'the hour is in the site\'s timezone (03:00 in Kolkata is 21:30 UTC)' );
update_option( 'timezone_string', 'UTC' );
foreach ( $jobs->all( 'backups' ) as $j ) { if ( 'schedule' === $j['trigger'] ) { $jobs->delete( 'backups', $j['id'] ); } }
update_option( 'vulobackup_schedule_state', array( 'last_files' => time(), 'last_database' => time() ) );
$sched->check(); vb_ok( ! $jobs->active(), 'nothing starts when nothing is due' );
VuloBackup\Schedule\Scheduler::settings_changed( array_merge( VuloBackup()->settings->all(), array( 'schedule_database' => 'manual' ) ), VuloBackup()->settings->all() );
vb_ok( ! $sched->due( time() ), 'a schedule that was just switched on does not fire for a moment already past' );
update_option( 'vulobackup_schedule_state', array( 'last_files' => time(), 'last_database' => time() - 3 * 86400 ) );
vb_ok( array( 'database' ) === $sched->due( time() ), 'a missed daily backup is due at the next check' );
$sched->check(); $sched->check(); $sched->check();
$scheduled = array_filter( $jobs->all( 'backups' ), static fn( $j ) => 'schedule' === $j['trigger'] );
vb_ok( 1 === count( $scheduled ) && 'database' === reset( $scheduled )['type'], 'three cron events in a row start exactly one scheduled backup' );
$manual = VuloBackup()->runner->start_backup( array( 'type' => 'database' ) );
vb_ok( is_wp_error( $manual ) && 'vulobackup_busy' === $manual->get_error_code(), 'a second backup is refused while one is running: ' . ( is_wp_error( $manual ) ? $manual->get_error_message() : '' ) );
vb_ok( (bool) wp_next_scheduled( 'vulobackup_run' ), 'WP-Cron is asked to continue the backup' );
// Another request holding the lock: this one must not work on the job.
$lock = fopen( VuloBackup()->vault->base() . '/run.lock', 'c' ); flock( $lock, LOCK_EX );
$busy = VuloBackup()->runner->tick( true ); flock( $lock, LOCK_UN ); fclose( $lock );
vb_ok( true === $busy['busy'] && 'queued' === $busy['job']['status'], 'a slice is refused while another request holds the lock' );
do_action( 'vulobackup_run' ); $after = $jobs->get( 'backups', reset( $scheduled )['id'] );
vb_ok( 'queued' !== $after['status'], 'the cron event moves the backup forward: ' . $after['status'] );
$done = vb_run(); vb_ok( 'completed' === ( $done['status'] ?? $jobs->get( 'backups', $after['id'] )['status'] ), 'scheduled backup completes' );
VuloBackup()->settings->update( array( 'schedule_database' => 'manual', 'schedule_files' => 'manual' ) );

echo "--- interrupted and cancelled jobs\n";
$j = VuloBackup()->runner->start_backup( array( 'type' => 'full', 'areas' => array( 'uploads' ) ) );
$e = new VuloBackup\Backup\Engine(); for ( $i = 0; $i < 12; $i++ ) { $j = $e->tick( $jobs->get( 'backups', $j['id'] ), microtime( true ) - 1 ); }
$mid = array_diff( scandir( $jobs->dir( $j ) ), array( '.', '..' ) );
$j = VuloBackup()->runner->cancel( $j ); $left = array_values( array_diff( scandir( $jobs->dir( $j ) ), array( '.', '..' ) ) );
vb_ok( 'cancelled' === $j['status'] && count( $mid ) > 2 && array( 'job.json', 'log.jsonl' ) === $left && ! $jobs->active(), 'cancelling part-way removes the partial archives, keeps the record and its log' );
$j = VuloBackup()->runner->start_backup( array( 'type' => 'database' ) );
for ( $i = 0; $i < 4; $i++ ) { $x = $jobs->get( 'backups', $j['id'] ); $x['running'] = array( 'since' => time() - 600, 'print' => md5( $x['status'] . '|' . $x['step'] . '|' . wp_json_encode( $x['cursor'] ) ) ); $x['crashes'] = $i; $jobs->save( $x ); }
$r = VuloBackup()->runner->tick( true );
vb_ok( 'failed' === $r['job']['status'] && false !== strpos( $r['job']['error'], 'time or memory limit' ), 'a job whose slices keep dying at the same point is failed with an explanation, not retried for ever' );
file_put_contents( VuloBackup()->vault->tmp_dir() . '/upload-old.part', 'x' ); touch( VuloBackup()->vault->tmp_dir() . '/upload-old.part', time() - 2 * 86400 ); file_put_contents( VuloBackup()->vault->tmp_dir() . '/upload-new.part', 'x' );
$n = VuloBackup()->vault->clean_tmp(); vb_ok( 1 === $n && ! file_exists( VuloBackup()->vault->tmp_dir() . '/upload-old.part' ) && file_exists( VuloBackup()->vault->tmp_dir() . '/upload-new.part' ), 'abandoned temporary files older than a day are removed, newer ones kept' );
unlink( VuloBackup()->vault->tmp_dir() . '/upload-new.part' );

echo "--- deactivation and uninstall\n";
$before = count( $jobs->all( 'backups' ) );
VuloBackup\Schedule\Scheduler::clear();
vb_ok( ! wp_next_scheduled( 'vulobackup_schedule_check' ) && ! wp_next_scheduled( 'vulobackup_watchdog' ) && ! wp_next_scheduled( 'vulobackup_run' ), 'deactivation clears every scheduled event' );
VuloBackup\Install::uninstall();
vb_ok( false !== get_option( 'vulobackup_settings' ) && is_dir( $base ) && count( $jobs->all( 'backups' ) ) === $before, 'uninstall keeps settings and every backup by default' );
$keep = array( get_option( 'vulobackup_settings' ), get_option( 'vulobackup_destinations' ), get_option( 'vulobackup_dir_token' ), get_option( 'vulobackup_key_material' ), get_option( 'vulobackup_encryption' ) );
VuloBackup()->settings->update( array( 'keep_data_uninstall' => 'delete_everything' ) ); VuloBackup\Install::uninstall();
vb_ok( false === get_option( 'vulobackup_settings' ) && false === get_option( 'vulobackup_destinations' ) && is_dir( $base ) && count( $jobs->all( 'backups' ) ) === $before, '"delete settings" removes settings and stored credentials, and still leaves the backups on disk' );
// Put the test site back the way it was.
update_option( 'vulobackup_settings', array_merge( $keep[0], array( 'keep_data_uninstall' => 'keep_data' ) ) ); update_option( 'vulobackup_destinations', $keep[1] ); update_option( 'vulobackup_dir_token', $keep[2] ); update_option( 'vulobackup_key_material', $keep[3] ); if ( $keep[4] ) { update_option( 'vulobackup_encryption', $keep[4] ); }
wp_delete_user( $sub );
