<?php
require __DIR__ . '/lib.php'; wp_set_current_user( 1 );
VuloBackup()->settings->update( array( 'encrypt' => false ) );
$job = VuloBackup()->runner->start_backup( array( 'type' => 'full', 'areas' => array( 'themes', 'uploads' ), 'name' => 'For migration' ) ); $job = vb_run();
$entries = VuloBackup\Backup\Bundle::entries( $job ); $out = fopen( sys_get_temp_dir() . '/vulobackup-test-bundle.zip', 'wb' ); $n = VuloBackup\Backup\Bundle::write( $entries, $out ); fclose( $out );
vb_ok( $n === VuloBackup\Backup\Bundle::size( $entries ) && $n === filesize( sys_get_temp_dir() . '/vulobackup-test-bundle.zip' ), "bundle written, size matches the announced length ($n bytes)" );
$z = new ZipArchive(); vb_ok( true === $z->open( sys_get_temp_dir() . '/vulobackup-test-bundle.zip', ZipArchive::CHECKCONS ) && $z->numFiles === count( $entries ), 'bundle opens as an ordinary zip' );
VuloBackup\Backup\Bundle::$force_zip64 = true; $out = fopen( sys_get_temp_dir() . '/vulobackup-test-bundle64.zip', 'wb' ); $n = VuloBackup\Backup\Bundle::write( $entries, $out ); fclose( $out );
$z = new ZipArchive(); vb_ok( $n === VuloBackup\Backup\Bundle::size( $entries ) && true === $z->open( sys_get_temp_dir() . '/vulobackup-test-bundle64.zip' ) && $z->numFiles === count( $entries ) && false !== $z->getFromName( 'manifest.json' ), 'large-file (zip64) form of the bundle opens too' );
