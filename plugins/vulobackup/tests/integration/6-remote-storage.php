<?php
require __DIR__ . '/lib.php'; global $wpdb; wp_set_current_user( 1 );
$jobs = VuloBackup()->jobs; $dest = VuloBackup()->destinations; $up = wp_upload_dir()['basedir'];
foreach ( array_keys( $dest->all() ) as $old ) { $dest->delete( $old ); }
VuloBackup()->settings->update( array( 'encrypt' => false, 'keep_local_copy' => true, 'retention_count' => 0, 'retention_remote_count' => 0 ) );
$s3 = array( 'endpoint' => 'http://127.0.0.1:9077', 'region' => 'us-east-1', 'bucket' => 'vb-test', 'access_key' => 'vbtestkey', 'secret_key' => 'vbtestsecret123', 'prefix' => 'site-a/backups', 'path_style' => true );
$sftp = array( 'host' => '127.0.0.1', 'port' => 2277, 'username' => 'vbuser', 'password' => 'vbpass123', 'private_key' => '', 'path' => 'upload/site-a' );

echo "--- credentials and configuration errors\n";
$e = $dest->save( array( 'provider' => 's3', 'config' => array_merge( $s3, array( 'secret_key' => 'wrong-secret-xyz' ) ) ) );
vb_ok( is_wp_error( $e ) && ! $dest->all() && false === strpos( $e->get_error_message(), 'wrong-secret' ), 'S3 wrong secret refused, nothing saved: ' . ( is_wp_error( $e ) ? $e->get_error_message() : '' ) );
$e = $dest->save( array( 'provider' => 's3', 'config' => array_merge( $s3, array( 'bucket' => 'no-such-bucket-vb' ) ) ) );
vb_ok( is_wp_error( $e ), 'S3 missing bucket refused: ' . ( is_wp_error( $e ) ? $e->get_error_message() : '' ) );
$e = $dest->save( array( 'provider' => 's3', 'config' => array_merge( $s3, array( 'endpoint' => 'https://user:pw@host/path?x=1' ) ) ) );
vb_ok( is_wp_error( $e ), 'S3 malformed endpoint refused: ' . ( is_wp_error( $e ) ? $e->get_error_message() : '' ) );
remove_all_filters( 'vulobackup_allow_insecure_storage' );
$e = $dest->save( array( 'provider' => 's3', 'config' => $s3 ) );
vb_ok( is_wp_error( $e ), 'plain http endpoint refused unless allowed for testing: ' . ( is_wp_error( $e ) ? $e->get_error_message() : '' ) );
add_filter( 'vulobackup_allow_insecure_storage', '__return_true' );
$e = $dest->save( array( 'provider' => 'sftp', 'config' => array_merge( $sftp, array( 'password' => 'nope-nope' ) ) ) );
vb_ok( is_wp_error( $e ), 'SFTP wrong password refused: ' . ( is_wp_error( $e ) ? $e->get_error_message() : '' ) );
$e = $dest->save( array( 'provider' => 'sftp', 'config' => array_merge( $sftp, array( 'port' => 2299 ) ) ) );
vb_ok( is_wp_error( $e ), 'SFTP unreachable refused: ' . ( is_wp_error( $e ) ? $e->get_error_message() : '' ) );

echo "--- saving\n";
$a = $dest->save( array( 'provider' => 's3', 'name' => 'Test bucket', 'config' => $s3 ) );
$b = $dest->save( array( 'provider' => 'sftp', 'name' => 'Test SFTP', 'config' => $sftp ) );
vb_ok( ! is_wp_error( $a ) && ! is_wp_error( $b ), 'S3 and SFTP destinations pass their write/read/delete test ' . ( is_wp_error( $a ) ? $a->get_error_message() : '' ) . ( is_wp_error( $b ) ? $b->get_error_message() : '' ) );
if ( is_wp_error( $a ) || is_wp_error( $b ) ) { return; }
$stored = wp_json_encode( get_option( 'vulobackup_destinations' ) ); $shown = wp_json_encode( array( $a, $b ) );
vb_ok( false === strpos( $stored, 'vbtestsecret123' ) && false === strpos( $stored, 'vbpass123' ), 'secrets are encrypted in the database' );
vb_ok( false === strpos( $shown, 'vbtestsecret123' ) && false === strpos( $shown, 'vbpass123' ) && true === $a['has_secret']['secret_key'], 'secrets are never returned to the browser' );
vb_ok( 0 === strpos( $b['fingerprint'], 'SHA256:' ), 'SFTP server fingerprint remembered: ' . $b['fingerprint'] );

echo "--- backup with two remote copies\n";
VuloBackup()->settings->update( array( 'part_size_mb' => 10 ) );
file_put_contents( "$up/2026/01/big2.bin", random_bytes( 21 * 1024 * 1024 ) ); // forces a multipart S3 upload
$job = VuloBackup()->runner->start_backup( array( 'type' => 'full', 'areas' => array( 'uploads' ), 'name' => 'Remote test' ) );
// Tiny slices, so uploads are interrupted and resumed many times.
$engine = new VuloBackup\Backup\Engine(); $ticks = 0;
while ( ! in_array( $job['status'], array( 'completed', 'failed' ), true ) && $ticks < 3000 ) { $job = $engine->tick( $jobs->get( 'backups', $job['id'] ), microtime( true ) - 1 ); ++$ticks; }
$statuses = array_column( $job['copies'] ?? array(), 'status' );
vb_ok( 'completed' === $job['status'] && array( 'uploaded', 'uploaded' ) === $statuses, "uploaded to both in $ticks slices " . $job['error'] . wp_json_encode( $job['copies'] ?? null ) );
$vs = array(); ( new VuloBackup\Backup\Verifier() )->run( $job, $vs, microtime( true ) + 60 );
vb_ok( ! $vs['problems'] && 3 === count( $vs['checked'] ), 'integrity check confirms the local copy and both remote copies: ' . implode( ', ', $vs['checked'] ) . ' ' . implode( ' ', $vs['problems'] ) );
$log = file_get_contents( $jobs->dir( $job ) . '/log.jsonl' ) . file_get_contents( VuloBackup()->logger->file() ) . file_get_contents( $jobs->dir( $job ) . '/job.json' );
vb_ok( false === strpos( $log, 'vbtestsecret123' ) && false === strpos( $log, 'vbpass123' ) && false === strpos( $log, 'vbtestkey' ), 'no credential in any log or job record' );
update_option( 'vb_remote_backup', $job['id'] );

echo "--- restore from remote only\n";
$manifest = VuloBackup\Backup\Manifest::read( $jobs->dir( $job ) ); $before = md5( wp_json_encode( vb_files_hash( $up ) ) );
foreach ( $manifest['parts'] as $p ) { unlink( $jobs->dir( $job ) . '/' . $p['name'] ); } $job['local'] = false; $jobs->save( $job );
unlink( "$up/2026/01/big2.bin" ); unlink( "$up/2026/01/img-3.jpg" );
$r = vb_restore( $job['id'], false, array( 'uploads' ), false );
vb_ok( 'completed' === $r['status'] && md5( wp_json_encode( vb_files_hash( $up ) ) ) === $before, 'archives fetched back from remote storage and restored ' . $r['error'] );

echo "--- remote copy tampered with / missing\n";
$job = $jobs->get( 'backups', $job['id'] );
$provider = $dest->provider( 's3' ); $cfg = $dest->get( $a['id'] )['config'];
$provider->delete( $cfg, $job['id'] . '/' . $manifest['parts'][1]['name'] );
$vs = array(); ( new VuloBackup\Backup\Verifier() )->run( $job, $vs, microtime( true ) + 60 );
vb_ok( 1 === count( $vs['problems'] ), 'a file deleted at the remote end is noticed: ' . implode( ' ', $vs['problems'] ) );

echo "--- upload failure\n";
$all = get_option( 'vulobackup_destinations' ); foreach ( $all as &$d ) { if ( 's3' === $d['provider'] ) { $d['config']['bucket'] = 'bucket-that-vanished'; } } unset( $d ); update_option( 'vulobackup_destinations', $all );
$mail = array(); add_filter( 'pre_wp_mail', static function ( $x, $atts ) use ( &$mail ) { $mail[] = $atts; return true; }, 10, 2 );
$job2 = VuloBackup()->runner->start_backup( array( 'type' => 'database', 'name' => 'Upload fails' ) ); $job2 = vb_run();
vb_ok( 'completed' === $job2['status'] && 'failed' === $job2['copies'][ $a['id'] ]['status'] && 'uploaded' === $job2['copies'][ $b['id'] ]['status'] && ! empty( $job2['local'] ) && $job2['warnings'], 'backup kept locally, the failed copy is recorded as failed, the other destination still got it: ' . $job2['copies'][ $a['id'] ]['error'] );
vb_ok( 1 === count( $mail ) && false !== strpos( $mail[0]['subject'], 'could not be copied' ), 'one failure email handed to WordPress: ' . ( $mail[0]['subject'] ?? '' ) );
vb_ok( false === $dest->for_browser( $dest->get( $a['id'] ) )['ok'], 'destination shown as failing' );
foreach ( $all as &$d ) { if ( 's3' === $d['provider'] ) { $d['config']['bucket'] = 'vb-test'; } } unset( $d ); update_option( 'vulobackup_destinations', $all );

echo "--- SFTP server key changed\n";
$all = get_option( 'vulobackup_destinations' ); foreach ( $all as &$d ) { if ( 'sftp' === $d['provider'] ) { $d['config']['fingerprint'] = 'SHA256:someoneelse'; } } unset( $d ); update_option( 'vulobackup_destinations', $all );
$st = array(); $res = ( new VuloBackup\Storage\Providers\Sftp() )->upload( $dest->get( $b['id'] )['config'], __FILE__, 'x/probe.txt', $st, microtime( true ) + 20 );
vb_ok( is_wp_error( $res ) && 'vulobackup_storage_hostkey' === $res->get_error_code(), 'nothing is sent when the server key differs from the remembered one: ' . ( is_wp_error( $res ) ? $res->get_error_message() : '' ) );
$re = $dest->retest( $b['id'] ); vb_ok( ! empty( $re['ok'] ) && 0 === strpos( $re['fingerprint'], 'SHA256:' ) && 'SHA256:someoneelse' !== $re['fingerprint'], 'testing the destination again accepts the server\'s key' );

echo "--- retention, local and remote\n";
foreach ( $jobs->all( 'backups' ) as $j ) { $jobs->delete( 'backups', $j['id'] ); }
VuloBackup()->settings->update( array( 'retention_count' => 2, 'retention_remote_count' => 3 ) );
$ids = array();
for ( $i = 1; $i <= 4; $i++ ) { $j = VuloBackup()->runner->start_backup( array( 'type' => 'database', 'name' => "R$i" ) ); $j = vb_run(); $ids[] = $j['id']; sleep( 1 ); }
$left = array(); foreach ( $jobs->all( 'backups' ) as $j ) { $left[ $j['name'] ] = array( ! empty( $j['local'] ), array_column( $j['copies'], 'status' ) ); }
echo wp_json_encode( $left ) . "\n";
vb_ok( isset( $left['R4'], $left['R3'], $left['R2'] ) && ! isset( $left['R1'] ) && $left['R4'][0] && $left['R3'][0] && ! $left['R2'][0], 'two newest kept locally, third kept remotely only, fourth gone everywhere' );
$gone = $provider->verify( $cfg, $ids[0] . '/database.sql.gz', 1 ); $kept = $provider->verify( $cfg, $ids[1] . '/manifest.json', (int) filesize( $jobs->dir( $jobs->get( 'backups', $ids[1] ) ) . '/manifest.json' ) );
vb_ok( is_wp_error( $gone ) && 'NoSuchKey' === $gone->get_error_data() && true === $kept, 'the oldest backup really is gone from the bucket, the third is really there' );
echo "--- a failing backup deletes nothing\n";
$count = count( $jobs->all( 'backups' ) ); VuloBackup()->settings->update( array( 'retention_count' => 1, 'backup_dir' => '' ) );
add_filter( 'query', $breaker = static function ( $q ) { return 0 === strpos( $q, 'SELECT * FROM `' . $GLOBALS['wpdb']->posts . '`' ) ? 'SELECT * FROM table_that_is_not_there' : $q; } );
$wpdb->suppress_errors( true ); $bad = VuloBackup()->runner->start_backup( array( 'type' => 'database', 'name' => 'Breaks' ) ); $bad = vb_run(); $wpdb->suppress_errors( false ); remove_filter( 'query', $breaker );
$after = array_filter( $jobs->all( 'backups' ), static fn( $j ) => 'completed' === $j['status'] );
vb_ok( 'failed' === $bad['status'] && false !== strpos( $bad['error'], $wpdb->posts ) && count( $after ) === $count, 'unreadable table fails the backup by name and older backups are all still there: ' . $bad['error'] );
vb_ok( ! file_exists( $jobs->dir( $bad ) . '/database.sql.gz' ) && ! file_exists( $jobs->dir( $bad ) . '/manifest.json' ), 'the failed backup left no partial archive and no manifest' );
