<?php
require __DIR__ . '/lib.php'; global $wpdb; wp_set_current_user( 1 );
$jobs = VuloBackup()->jobs; $up = wp_upload_dir()['basedir'];
VuloBackup()->settings->update( array( 'encrypt' => false ) );
$base = VuloBackup()->runner->start_backup( array( 'type' => 'full', 'areas' => array( 'uploads' ), 'name' => 'Clean' ) ); $base = vb_run();
$src = $jobs->dir( $base );
// Makes a copy of the clean backup whose manifest truthfully describes tampered contents.
$forge = static function ( callable $tamper ) use ( $jobs, $src, $base ) {
	$copy = $base; unset( $copy['id'] ); $job = $jobs->create( 'backups', array_merge( $copy, array( 'name' => 'Forged', 'trigger' => 'import' ) ) ); $dir = $jobs->dir( $job );
	foreach ( array( 'manifest.json', 'database.sql.gz', 'files-001.zip' ) as $f ) { copy( "$src/$f", "$dir/$f" ); }
	$tamper( $dir );
	$m = json_decode( file_get_contents( "$dir/manifest.json" ), true );
	foreach ( $m['parts'] as &$p ) { $p['bytes'] = filesize( "$dir/{$p['name']}" ); $p['sha256'] = hash_file( 'sha256', "$dir/{$p['name']}" ); }
	file_put_contents( "$dir/manifest.json", wp_json_encode( $m ) ); $job['status'] = 'completed'; $jobs->save( $job );
	return $job['id'];
};
$snapshot = static function () use ( $wpdb, $up ) { return md5( wp_json_encode( array( vb_checksum(), vb_files_hash( $up ) ) ) ); };
$try = static function ( $label, callable $tamper, $db, $areas ) use ( $forge, $snapshot, $wpdb ) {
	$id = $forge( $tamper ); $before = $snapshot(); $r = vb_restore( $id, $db, $areas, false ); wp_cache_flush();
	$clean = ! $wpdb->get_col( "SHOW TABLES LIKE 'vbt%'" ) && ! glob( WP_CONTENT_DIR . '/*.vb*' );
	vb_ok( 'failed' === $r['status'] && 'nothing' === $r['changed'] && $snapshot() === $before && $clean, $label . ' -> ' . $r['error'] );
	VuloBackup()->jobs->delete( 'backups', $id );
};
$rezip = static function ( $dir, callable $edit ) { $z = new ZipArchive(); $z->open( "$dir/files-001.zip" ); $edit( $z ); $z->close(); };
$resql = static function ( $dir, callable $edit ) { $sql = ''; $g = gzopen( "$dir/database.sql.gz", 'rb' ); while ( ! gzeof( $g ) ) { $sql .= gzread( $g, 1048576 ); } gzclose( $g ); if ( false === strpos( $sql, 'vulobackup-complete' ) ) { echo "HARNESS: dump not read fully
"; } $new = $edit( $sql ); if ( $new === $sql ) { echo "HARNESS: tamper changed nothing
"; } file_put_contents( "$dir/database.sql.gz", gzencode( $new ) ); };

echo "--- archives\n";
$try( 'path traversal entry', static fn( $d ) => $rezip( $d, static fn( $z ) => $z->addFromString( 'uploads/../../../evil.php', '<?php echo 1;' ) ), false, array( 'uploads' ) );
$try( 'absolute path entry', static fn( $d ) => $rezip( $d, static fn( $z ) => $z->addFromString( '/tmp/evil.php', 'x' ) ), false, array( 'uploads' ) );
$try( 'backslash path entry', static fn( $d ) => $rezip( $d, static fn( $z ) => $z->addFromString( 'uploads\\..\\evil.php', 'x' ) ), false, array( 'uploads' ) );
$try( 'entry outside any area', static fn( $d ) => $rezip( $d, static fn( $z ) => $z->addFromString( 'elsewhere/evil.php', 'x' ) ), false, array( 'uploads' ) );
$try( 'symbolic link entry', static fn( $d ) => $rezip( $d, static function ( $z ) { $z->addFromString( 'uploads/link', '/etc/passwd' ); $z->setExternalAttributesName( 'uploads/link', ZipArchive::OPSYS_UNIX, 0120777 << 16 ); } ), false, array( 'uploads' ) );
$try( 'more files than the manifest declares', static fn( $d ) => $rezip( $d, static function ( $z ) { for ( $i = 0; $i < 5; $i++ ) { $z->addFromString( "uploads/extra-$i.txt", 'x' ); } } ), false, array( 'uploads' ) );
$try( 'zip bomb (far more data than declared)', static fn( $d ) => $rezip( $d, static function ( $z ) { $z->deleteName( 'uploads/2026/01/img-1.jpg' ); $z->addFromString( 'uploads/2026/01/img-1.jpg', str_repeat( "\0", 60 * 1024 * 1024 ) ); } ), false, array( 'uploads' ) );
vb_ok( ! file_exists( dirname( ABSPATH ) . '/evil.php' ) && ! file_exists( ABSPATH . 'evil.php' ) && ! file_exists( WP_CONTENT_DIR . '/evil.php' ) && ! file_exists( '/tmp/evil.php' ), 'no file was written outside the staging folders' );

echo "--- database dumps\n";
$p = $wpdb->prefix;
$try( 'extra DROP of a live table', static fn( $d ) => $resql( $d, static fn( $s ) => str_replace( "\n-- vulobackup-complete", "\nDROP TABLE `{$p}users`;\n-- vulobackup-complete", $s ) ), true, array() );
$try( 'second statement after an INSERT', static fn( $d ) => $resql( $d, static fn( $s ) => preg_replace( '/^(INSERT INTO `' . $p . 'vb_parent` VALUES .*);$/m', "$1; DELETE FROM `{$p}users`;", $s, 1 ) ), true, array() );
$try( 'function call as a value', static fn( $d ) => $resql( $d, static fn( $s ) => str_replace( "\n-- vulobackup-complete", "\nINSERT INTO `{$p}vb_parent` VALUES (LOAD_FILE('/etc/passwd'));\n-- vulobackup-complete", $s ) ), true, array() );
$try( 'subquery as a value', static fn( $d ) => $resql( $d, static fn( $s ) => str_replace( "\n-- vulobackup-complete", "\nINSERT INTO `{$p}vb_parent` VALUES ((SELECT 1));\n-- vulobackup-complete", $s ) ), true, array() );
$try( 'UPDATE statement', static fn( $d ) => $resql( $d, static fn( $s ) => str_replace( "\n-- vulobackup-complete", "\nUPDATE `{$p}users` SET user_pass = 'x';\n-- vulobackup-complete", $s ) ), true, array() );
$try( 'comment hiding a statement in CREATE TABLE', static fn( $d ) => $resql( $d, static fn( $s ) => preg_replace( '/^(CREATE TABLE `' . $p . 'vb_parent` .*);$/m', '$1 /* x */; DROP TABLE x;', $s, 1 ) ), true, array() );
$try( 'second statement after CREATE TABLE', static fn( $d ) => $resql( $d, static fn( $s ) => preg_replace( '/^(CREATE TABLE `' . $p . 'vb_parent` .*);$/m', '$1; DROP TABLE `' . $p . 'users`;', $s, 1 ) ), true, array() );
$try( 'rows for a table that was never defined', static fn( $d ) => $resql( $d, static fn( $s ) => str_replace( "\n-- vulobackup-complete", "\nINSERT INTO `{$p}users_admin` VALUES (1);\n-- vulobackup-complete", $s ) ), true, array() );
$try( 'dump cut short (no closing line)', static fn( $d ) => $resql( $d, static fn( $s ) => substr( $s, 0, (int) ( strlen( $s ) * 0.6 ) ) ), true, array() );
$try( 'rows removed (count no longer matches)', static fn( $d ) => $resql( $d, static fn( $s ) => preg_replace( '/^INSERT INTO `' . $p . 'vb_nopk` VALUES .*$/m', '', $s ) ), true, array() );
$try( 'unsafe character set declared', static fn( $d ) => $resql( $d, static fn( $s ) => str_replace( 'vulobackup-charset: utf8mb4', 'vulobackup-charset: gbk', $s ) ), true, array() );
$try( 'format from a newer version', static fn( $d ) => $resql( $d, static fn( $s ) => str_replace( 'vulobackup-format: 1', 'vulobackup-format: 9', $s ) ), true, array() );
vb_ok( (int) $wpdb->get_var( "SELECT COUNT(*) FROM {$wpdb->users}" ) >= 1 && '' !== $wpdb->get_var( "SELECT user_pass FROM {$wpdb->users} LIMIT 1" ) && 'x' !== $wpdb->get_var( "SELECT user_pass FROM {$wpdb->users} LIMIT 1" ), 'users table untouched throughout' );

echo "--- bundles and manifests\n";
$bad = static function ( $label, array $files ) { $f = sys_get_temp_dir() . '/vulobackup-test-bad.zip'; @unlink( $f ); $z = new ZipArchive(); $z->open( $f, ZipArchive::CREATE ); foreach ( $files as $n => $c ) { $z->addFromString( $n, $c ); } $z->close(); $count = count( VuloBackup()->jobs->all( 'backups' ) ); $r = VuloBackup\Backup\Bundle::import( $f ); vb_ok( is_wp_error( $r ) && count( VuloBackup()->jobs->all( 'backups' ) ) === $count, $label . ' -> ' . ( is_wp_error( $r ) ? $r->get_error_message() : 'ACCEPTED' ) ); };
$good = json_decode( file_get_contents( "$src/manifest.json" ), true );
$bad( 'not a backup at all', array( 'readme.txt' => 'hello', 'x.php' => '<?php' ) );
$bad( 'manifest only, parts missing', array( 'manifest.json' => wp_json_encode( $good ) ) );
$m = $good; $m['parts'][] = array( 'name' => '../../evil.php', 'bytes' => 1, 'sha256' => str_repeat( 'a', 64 ) );
$bad( 'manifest naming a file outside the backup', array( 'manifest.json' => wp_json_encode( $m ), '../../evil.php' => 'x' ) );
$m = $good; $m['parts'][0]['name'] = 'shell.php';
$bad( 'manifest naming a PHP file', array( 'manifest.json' => wp_json_encode( $m ), 'shell.php' => '<?php' ) );
$files = array( 'manifest.json' => wp_json_encode( $good ), 'extra.php' => '<?php' ); foreach ( $good['parts'] as $p2 ) { $files[ $p2['name'] ] = file_get_contents( "$src/{$p2['name']}" ); }
$bad( 'valid backup with one extra file', $files );
$m = $good; $m['format'] = 99; $bad( 'manifest from a newer format', array( 'manifest.json' => wp_json_encode( $m ), 'database.sql.gz' => 'x' ) );
$bad( 'manifest that is not JSON', array( 'manifest.json' => '<?php phpinfo();', 'database.sql.gz' => 'x' ) );
