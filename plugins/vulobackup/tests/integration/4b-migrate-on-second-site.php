<?php
require __DIR__ . '/lib.php';
global $wpdb;
wp_set_current_user( 1 );
copy( sys_get_temp_dir() . '/vulobackup-test-bundle64.zip', sys_get_temp_dir() . '/vulobackup-test-in.zip' );
$job = VuloBackup\Backup\Bundle::import( sys_get_temp_dir() . '/vulobackup-test-in.zip' );
if ( is_wp_error( $job ) ) {
	echo 'IMPORT ERR ' . $job->get_error_message() . "\n";
	return; }
vb_ok( 'import' === $job['trigger'] && ! $job['verified'] && 'http://localhost:8899' === $job['site']['home'], 'imported, marked unverified, source site recorded' );
$r = vb_restore( $job['id'], true, array( 'themes', 'uploads' ), true );
wp_cache_flush();
echo 'restore: ' . $r['status'] . ' ' . $r['error'] . ' ' . wp_json_encode( $r['migrated'] ?? null ) . wp_json_encode( $r['result']['notes'] ?? null ) . "\n";
vb_ok( 'https://new.example.org/shop' === get_option( 'home' ) && 'https://new.example.org/shop' === get_option( 'siteurl' ), 'site address is this site\'s' );
vb_ok( 'xyz_' === $wpdb->prefix && 40 <= (int) $wpdb->get_var( "SELECT COUNT(*) FROM xyz_posts WHERE post_status='publish'" ), 'tables restored under this site\'s prefix' );
$post = get_posts(
    array(
		'numberposts' => 1,
		'orderby'     => 'ID',
		'order'       => 'DESC',
		's'           => 'Post 39',
    )
)[0];
vb_ok( false !== strpos( $post->post_content, 'https://new.example.org/shop/page-39 and https://new.example.org/shop/x' ), 'http and https links in content replaced' );
vb_ok( 0 === strpos( $post->guid, 'http://localhost:8899' ), 'post GUID left as it was' );
$ser = get_post_meta( $post->ID, 'ser', true );
vb_ok( is_array( $ser ) && 'https://new.example.org/shop/a' === $ser['url'] && 'https://new.example.org/shop/deep?x=1' === $ser['n']['deep'] && 5 === $ser['n']['k'], 'serialized array still unserializes, addresses replaced inside it' );
vb_ok( 'https://new.example.org/shop/j' === json_decode( $ser['json'], true )['u'], 'address inside JSON inside serialized data replaced' );
$nested = get_option( 'vb_test_nested' );
vb_ok( 'https://new.example.org/shop/nested' === unserialize( $nested['inner'] )['u'], 'serialized data nested in serialized data still valid' );
vb_ok( 'http://localhost:8899.evil.com/keep' === $nested['other'], 'a longer host name that merely starts the same was not touched' );
vb_ok( 0 === (int) $wpdb->get_var( "SELECT COUNT(*) FROM xyz_postmeta WHERE meta_value LIKE '%//localhost:8899/%'" ) && 0 === (int) $wpdb->get_var( "SELECT COUNT(*) FROM xyz_posts WHERE post_content LIKE '%//localhost:8899/%'" ) && 0 === (int) $wpdb->get_var( "SELECT COUNT(*) FROM xyz_vb_nopk WHERE t LIKE '%//localhost:8899/%'" ), 'no old address left in content, meta or a table without a key' );
$admin = get_user_by( 'login', 'admin' );
vb_ok( $admin && user_can( $admin, 'manage_options' ) && (bool) get_option( 'xyz_user_roles' ), 'the backup\'s administrator has their role under the new prefix' );
vb_ok( is_plugin_active( 'vulobackup/vulobackup.php' ), 'VuloBackup still active' );
vb_ok( 30 === (int) $wpdb->get_var( 'SELECT COUNT(*) FROM xyz_vb_bin' ) && file_exists( wp_upload_dir()['basedir'] . '/2026/01/big.bin' ), 'binary table and uploads arrived' );
vb_ok( ! $wpdb->get_col( "SHOW TABLES LIKE 'vbt%'" ) && ! $wpdb->get_col( "SHOW TABLES LIKE 'vbo%'" ), 'no working tables left' );
