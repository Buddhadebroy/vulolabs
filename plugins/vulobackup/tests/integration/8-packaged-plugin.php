<?php
require __DIR__ . '/lib.php'; global $wpdb; wp_set_current_user( 1 );
VuloBackup()->settings->update( array( 'encrypt' => false ) );
$job = VuloBackup()->runner->start_backup( array( 'type' => 'full', 'areas' => array( 'plugins', 'themes', 'uploads', 'others' ) ) ); $job = vb_run();
vb_ok( 'completed' === $job['status'], 'packaged plugin makes a full backup: ' . $job['error'] . ' ' . implode( ' | ', $job['warnings'] ) );
$m = VuloBackup\Backup\Manifest::read( VuloBackup()->jobs->dir( $job ) );
vb_ok( $m['files']['by_area']['plugins']['files'] > 100, 'the plugins folder, including VuloBackup itself, is in the backup: ' . $m['files']['by_area']['plugins']['files'] . ' files' );
// Change the site, including the plugins folder.
file_put_contents( WP_PLUGIN_DIR . '/dummy/dummy.php', "<?php\n/* Plugin Name: Dummy CHANGED */\n" ); mkdir( WP_PLUGIN_DIR . '/added-later' ); file_put_contents( WP_PLUGIN_DIR . '/added-later/x.php', '<?php' );
file_put_contents( WP_CONTENT_DIR . '/other-file.txt', 'changed' ); update_option( 'blogname', 'Changed after backup' );
$own = md5_file( WP_PLUGIN_DIR . '/vulobackup/vulobackup.php' );
$r = vb_restore( $job['id'], true, array( 'plugins', 'themes', 'uploads', 'others' ), true ); wp_cache_flush();
vb_ok( 'completed' === $r['status'], 'restore of database and every folder, including "other wp-content files": ' . $r['error'] );
vb_ok( false === strpos( file_get_contents( WP_PLUGIN_DIR . '/dummy/dummy.php' ), 'CHANGED' ) && ! is_dir( WP_PLUGIN_DIR . '/added-later' ), 'plugins folder is the backup\'s' );
vb_ok( is_dir( WP_PLUGIN_DIR . '/vulobackup' ) && ! is_link( WP_PLUGIN_DIR . '/vulobackup' ) && md5_file( WP_PLUGIN_DIR . '/vulobackup/vulobackup.php' ) === $own && file_exists( WP_PLUGIN_DIR . '/vulobackup/vendor/autoload.php' ) && is_plugin_active( 'vulobackup/vulobackup.php' ), 'VuloBackup itself is still installed, complete and active' );
vb_ok( 'Changed after backup' !== get_option( 'blogname' ), 'database restored' );
vb_ok( ! glob( WP_CONTENT_DIR . '/*.vb*' ) && ! $wpdb->get_col( "SHOW TABLES LIKE 'vbt%'" ) && ! $wpdb->get_col( "SHOW TABLES LIKE 'vbo%'" ), 'nothing left behind' );
vb_ok( 'changed' === file_get_contents( WP_CONTENT_DIR . '/other-file.txt' ), 'a file in wp-content that is not in the backup stays (copied-over areas do not delete)' );
$again = VuloBackup()->runner->start_backup( array( 'type' => 'database' ) ); $again = vb_run(); vb_ok( 'completed' === $again['status'], 'the restored site can back up again' );
