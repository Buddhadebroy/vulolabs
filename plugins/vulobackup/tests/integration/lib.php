<?php
function vb_run( $max = 400 ) {
	$last = null; for ( $i = 0; $i < $max; $i++ ) {
		$r = VuloBackup()->runner->tick( true );
		if ( ! $r['job'] ) {
			break;
		} $last = $r['job'];
		if ( in_array( $r['job']['status'], array( 'completed', 'failed', 'cancelled' ), true ) ) {
			break;
		}
	} return $last; }
function vb_ok( $cond, $label ) {
	echo ( $cond ? 'PASS ' : 'FAIL ' ) . $label . "\n"; }
function vb_checksum() {
	global $wpdb;
	$out = array();
	foreach ( $wpdb->get_col( "SHOW FULL TABLES WHERE Table_type = 'BASE TABLE'" ) as $t ) {
		if ( 0 !== strpos( $t, $wpdb->prefix ) ) {
			continue;
		} $row     = $wpdb->get_row( "CHECKSUM TABLE `$t`", ARRAY_N );
		$out[ $t ] = $row[1];
	} return $out; }
function vb_restore( $backup_id, $database, $areas, $safety = true, $password = '' ) {
	$jobs = VuloBackup()->jobs;
	$b    = $jobs->get( 'backups', $backup_id );
	$job  = $jobs->create(
        'restores',
        array(
			'backup_id'   => $b['id'],
			'backup_name' => $b['name'],
			'token'       => bin2hex( random_bytes( 4 ) ),
			'changed'     => 'nothing',
			'components'  => array(
				'database' => $database,
				'areas'    => $areas,
			),
			'options'     => array(
				'safety'   => $safety,
				'password' => '' !== $password ? VuloBackup()->secrets->encrypt( $password ) : '',
			),
        )
    );
	return vb_run();
}
function vb_files_hash( $dir ) {
	$h  = array();
	$it = new RecursiveIteratorIterator( new RecursiveDirectoryIterator( $dir, FilesystemIterator::SKIP_DOTS ) );
	foreach ( $it as $f ) {
		if ( $f->isFile() && ! $f->isLink() ) {
			$h[ substr( $f->getPathname(), strlen( $dir ) ) ] = md5_file( $f->getPathname() );
		}
	} ksort( $h );
	return $h; }
