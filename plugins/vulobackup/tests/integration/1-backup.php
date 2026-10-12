<?php
require __DIR__ . '/lib.php';
VuloBackup()->settings->update(
    array(
		'step_seconds' => 5,
		'part_size_mb' => 10,
    )
);
$t   = microtime( true );
$job = VuloBackup()->runner->start_backup(
    array(
		'type'  => 'full',
		'areas' => array( 'plugins', 'themes', 'uploads' ),
    )
);
if ( is_wp_error( $job ) ) {
	echo 'ERR ' . $job->get_error_message() . "\n";
	return; }
$job = vb_run();
echo 'status=' . $job['status'] . ' err=' . $job['error'] . ' size=' . ( $job['size'] ?? 0 ) . ' parts=' . ( $job['parts'] ?? 0 ) . ' t=' . round( microtime( true ) - $t, 1 ) . "s\n";
print_r( $job['warnings'] );
$dir = VuloBackup()->jobs->dir( $job );
echo implode( ' ', array_diff( scandir( $dir ), array( '.', '..' ) ) ) . "\n";
$m = VuloBackup\Backup\Manifest::read( $dir );
if ( is_wp_error( $m ) ) {
	echo $m->get_error_message();
	return; }
echo wp_json_encode(
    array(
		'db'    => array( $m['database']['tables'], $m['database']['rows'], $m['database']['skipped'] ),
		'files' => $m['files'],
    )
) . "\n";
update_option( 'vb_last_backup', $job['id'] );
