<?php
require __DIR__ . '/lib.php';
global $wpdb;
wp_set_current_user( 1 );
$id    = get_option( 'vb_last_backup' );
$up    = wp_upload_dir()['basedir'];
$watch = array( 'posts', 'postmeta', 'vb_bin', 'vb_nopk', 'vb_child', 'vb_parent', 'users' );
$sum   = static function () use ( $watch, $wpdb ) {
	$all = vb_checksum();
	$o   = array();
	foreach ( $watch as $w ) {
		$o[ $w ] = $all[ $wpdb->prefix . $w ] ?? 'MISSING';
	} return $o;
};
// The backup was taken right after seeding; nothing in the watched tables changed since.
$before       = $sum();
$files_before = vb_files_hash( $up );
unset( $files_before['/cache/x/skip.txt'] );
$themes_before = vb_files_hash( get_theme_root() );
// Wreck the site.
$wpdb->query( "DELETE FROM {$wpdb->posts} WHERE ID > 5" );
$wpdb->query( "UPDATE {$wpdb->prefix}vb_bin SET b = 'x'" );
$wpdb->query( "DROP TABLE {$wpdb->prefix}vb_nopk" );
$wpdb->query( "CREATE TABLE {$wpdb->prefix}vb_extra (id int)" );
unlink( "$up/2026/01/big.bin" );
file_put_contents( "$up/2026/01/img-1.jpg", 'corrupted' );
file_put_contents( "$up/added-after.txt", 'new' );
update_option( 'vb_marker_after_backup', 'yes' );
$settings_before = get_option( 'vulobackup_settings' );
vb_ok( $sum() !== $before, 'site was changed before restoring' );
$job = vb_restore( $id, true, array( 'plugins', 'themes', 'uploads' ) );
echo 'restore status=' . $job['status'] . ' changed=' . $job['changed'] . ' err=' . $job['error'] . "\n";
echo wp_json_encode( $job['result'] ?? null ) . "\n";
wp_cache_flush();
$after = $sum();
vb_ok( $after === $before, 'database tables identical to the backup (CHECKSUM TABLE)' );
if ( $after !== $before ) {
	print_r( array( $before, $after ) ); }
$files_after = vb_files_hash( $up );
vb_ok( $files_after === $files_before, 'uploads identical to the backup' );
if ( $files_after !== $files_before ) {
	print_r( array_diff_assoc( $files_before, $files_after ) );
	print_r( array_diff_key( $files_after, $files_before ) ); }
vb_ok( vb_files_hash( get_theme_root() ) === $themes_before, 'themes identical' );
vb_ok( ! file_exists( "$up/added-after.txt" ), 'file added after the backup is gone' );
vb_ok( false === get_option( 'vb_marker_after_backup' ), 'option added after the backup is gone' );
vb_ok( get_option( 'vulobackup_settings' ) == $settings_before, 'VuloBackup settings carried over' );
vb_ok( is_plugin_active( 'vulobackup/vulobackup.php' ) && is_link( WP_PLUGIN_DIR . '/vulobackup' ), 'VuloBackup still active and in place' );
vb_ok( 1 === (int) $wpdb->get_var( "SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND CONSTRAINT_NAME = 'vb_fk' AND TABLE_NAME = '{$wpdb->prefix}vb_child'" ), 'foreign key restored' );
vb_ok( ! $wpdb->get_col( "SHOW TABLES LIKE 'vb_\\_%'" ), 'no temporary or old tables left' );
print_r( $wpdb->get_col( "SHOW TABLES LIKE 'vb%'" ) );
vb_ok( ! glob( WP_CONTENT_DIR . '/*.vb*' ), 'no staging or old folders left' );
print_r( glob( WP_CONTENT_DIR . '/*.vb*' ) );
vb_ok( (bool) $wpdb->get_var( "SHOW TABLES LIKE '{$wpdb->prefix}vb_extra'" ), 'table that is not in the backup was left alone' );
$safety = VuloBackup()->jobs->get( 'backups', $job['safety_id'] ?? '' );
vb_ok( $safety && 'completed' === $safety['status'] && 'safety' === $safety['trigger'], 'safety backup was made first' );
vb_ok( 'http://localhost:8899' === get_option( 'siteurl' ), 'site address kept' );
foreach ( VuloBackup\Logging\Logger::read( VuloBackup()->jobs->dir( $job ) . '/log.jsonl' ) as $l ) {
	echo '  ' . $l['level'] . ': ' . $l['message'] . "\n"; }
