<?php
require __DIR__ . '/lib.php';
global $wpdb;
wp_set_current_user( 1 );
$up    = wp_upload_dir()['basedir'];
$jobs  = VuloBackup()->jobs;
$state = static function () use ( $wpdb, $up ) {
	return array( vb_checksum()[ $wpdb->posts ], vb_checksum()[ $wpdb->prefix . 'vb_bin' ], md5( wp_json_encode( vb_files_hash( $up ) ) ), (string) $wpdb->get_var( "SELECT COUNT(*) FROM {$wpdb->options}" ) );
};

echo "--- 1. a backup made in the smallest possible slices\n";
VuloBackup()->settings->update(
    array(
		'part_size_mb' => 10,
		'encrypt'      => false,
    )
);
$whole  = VuloBackup()->runner->start_backup(
    array(
		'type'  => 'full',
		'areas' => array( 'themes', 'uploads' ),
    )
);
$whole  = vb_run();
$w      = VuloBackup\Backup\Manifest::read( $jobs->dir( $whole ) );
$job    = VuloBackup()->runner->start_backup(
    array(
		'type'  => 'full',
		'areas' => array( 'themes', 'uploads' ),
    )
);
$engine = new VuloBackup\Backup\Engine();
$ticks  = 0;
while ( ! in_array( $job['status'], array( 'completed', 'failed' ), true ) && $ticks < 5000 ) {
	$job = $engine->tick( $jobs->get( 'backups', $job['id'] ), microtime( true ) - 1 );
	++$ticks; }
vb_ok( 'completed' === $job['status'] && $ticks > 30, "completed after $ticks slices (" . $job['error'] . ')' );
$m = VuloBackup\Backup\Manifest::read( $jobs->dir( $job ) );
vb_ok( $w['files']['count'] === $m['files']['count'] && $w['files']['bytes'] === $m['files']['bytes'] && $w['database']['tables'] === $m['database']['tables'], 'same contents as a backup made in one go: ' . $m['files']['count'] . ' files, ' . $m['database']['tables'] . ' tables' );
$sliced = $job['id'];

echo "--- 2. a restore made in the smallest possible slices\n";
$before = $state();
$wpdb->query( "DELETE FROM {$wpdb->posts} WHERE ID > 3" );
unlink( "$up/2026/01/img-5.jpg" );
$r       = $jobs->create(
    'restores',
    array(
		'backup_id'   => $sliced,
		'backup_name' => 'x',
		'token'       => bin2hex( random_bytes( 4 ) ),
		'changed'     => 'nothing',
		'components'  => array(
			'database' => true,
			'areas'    => array( 'uploads' ),
		),
		'options'     => array(
			'safety'   => false,
			'password' => '',
		),
    )
);
$rengine = new VuloBackup\Restore\Engine();
$ticks   = 0;
while ( ! in_array( $r['status'], array( 'completed', 'failed' ), true ) && $ticks < 5000 ) {
	$r = $rengine->tick( $jobs->get( 'restores', $r['id'] ), microtime( true ) - 1 );
	++$ticks; }
wp_cache_flush();
$now = $state();
vb_ok( 'completed' === $r['status'] && $ticks > 20, "restore completed after $ticks slices (" . $r['error'] . ')' );
vb_ok( $now[0] === $before[0] && $now[1] === $before[1] && $now[2] === $before[2], 'posts, binary table and uploads identical afterwards' );

echo "--- 3. a damaged archive is refused and nothing changes\n";
$dir  = $jobs->dir( $jobs->get( 'backups', $sliced ) );
$part = $dir . '/files-001.zip';
$h    = fopen( $part, 'r+b' );
fseek( $h, 5000 );
$c = fread( $h, 1 );
fseek( $h, 5000 );
fwrite( $h, chr( ord( $c ) ^ 0xFF ) );
fclose( $h );
$before = $state();
$r      = vb_restore( $sliced, true, array( 'uploads' ), false );
vb_ok( 'failed' === $r['status'] && 'nothing' === $r['changed'] && $state() === $before, 'restore refused: ' . $r['error'] );
$vs = array();
( new VuloBackup\Backup\Verifier() )->run( $jobs->get( 'backups', $sliced ), $vs, microtime( true ) + 30 );
vb_ok( 1 === count( $vs['problems'] ), 'integrity check names it: ' . implode( ' ', $vs['problems'] ) );
vb_ok( ! $wpdb->get_col( "SHOW TABLES LIKE 'vb\\_\\_%'" ) && ! $wpdb->get_col( "SHOW TABLES LIKE 'vbt%'" ) && ! glob( WP_CONTENT_DIR . '/*.vb*' ), 'nothing left behind' );

echo "--- 4. encrypted backup\n";
VuloBackup\Security\Crypto::store_password( 'correct horse battery' );
VuloBackup()->settings->update( array( 'encrypt' => true ) );
$job   = VuloBackup()->runner->start_backup(
    array(
		'type'  => 'full',
		'areas' => array( 'uploads' ),
    )
);
$job   = vb_run();
$files = array_values( array_diff( scandir( $jobs->dir( $job ) ), array( '.', '..', 'job.json', 'log.jsonl', 'manifest.json' ) ) );
vb_ok( 'completed' === $job['status'] && ! array_filter( $files, static fn( $f ) => '.enc' !== substr( $f, -4 ) ), 'every archive is encrypted: ' . implode( ' ', $files ) . ' ' . $job['error'] );
$raw = file_get_contents( $jobs->dir( $job ) . '/' . $files[0], false, null, 0, 4000 ) . file_get_contents( $jobs->dir( $job ) . '/manifest.json' ) . file_get_contents( $jobs->dir( $job ) . '/job.json' ) . file_get_contents( $jobs->dir( $job ) . '/log.jsonl' );
vb_ok( false === strpos( $raw, 'correct horse' ) && false === strpos( $raw, 'INSERT INTO' ), 'no password and no plain SQL in the backup, its manifest, record or log' );
$enc    = $job['id'];
$before = $state();
$wpdb->query( "DELETE FROM {$wpdb->posts} WHERE ID > 3" );
$r = vb_restore( $enc, true, array( 'uploads' ), false, 'wrong password' );
vb_ok( 'failed' === $r['status'] && 'nothing' === $r['changed'], 'wrong password: ' . $r['error'] );
$r = vb_restore( $enc, true, array( 'uploads' ), false );
wp_cache_flush();
$now = $state();
vb_ok( 'completed' === $r['status'] && $now[0] === $before[0] && $now[2] === $before[2], 'restored with the stored password ' . $r['error'] );
vb_ok( ! is_dir( $jobs->dir( $r ) . '/work' ), 'decrypted working copies removed' );
VuloBackup()->settings->update( array( 'encrypt' => false ) );
update_option( 'vb_enc_backup', $enc );
