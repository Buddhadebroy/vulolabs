<?php
global $wpdb;
for ( $i = 0; $i < 40; $i++ ) {
	$id = wp_insert_post(
        array(
			'post_title'   => "Post $i 😀 it's \"quoted\" \\ back",
			'post_content' => "Line1\nLine2\r\nLink http://localhost:8899/page-$i and https://localhost:8899/x\0nul",
			'post_status'  => 'publish',
        )
    );
	update_post_meta(
        $id,
        'ser',
        array(
			'url'  => 'http://localhost:8899/a',
			'n'    => array(
				'deep' => 'http://localhost:8899/deep?x=1',
				'k'    => 5,
			),
			'json' => wp_json_encode( array( 'u' => 'http://localhost:8899/j' ) ),
        )
    );
}
update_option(
    'vb_test_nested',
    array(
		'inner' => serialize( array( 'u' => 'http://localhost:8899/nested' ) ),
		'other' => 'http://localhost:8899.evil.com/keep',
    )
);
$wpdb->query( "DROP TABLE IF EXISTS {$wpdb->prefix}vb_bin" );
$wpdb->query( "CREATE TABLE {$wpdb->prefix}vb_bin (id int NOT NULL AUTO_INCREMENT, b blob, vb varbinary(20), d decimal(10,2), dt datetime DEFAULT NULL, n int DEFAULT NULL, PRIMARY KEY (id)) " . $wpdb->get_charset_collate() );
for ( $i = 0; $i < 30; $i++ ) {
	$wpdb->query( $wpdb->prepare( "INSERT INTO {$wpdb->prefix}vb_bin (b, vb, d, dt, n) VALUES (%s, %s, %f, %s, NULL)", random_bytes( 300 ) . "\0'\\\n", random_bytes( 10 ), $i * 1.25, '2026-01-0' . ( 1 + $i % 9 ) . ' 10:00:00' ) ); }
$wpdb->query( "DROP TABLE IF EXISTS {$wpdb->prefix}vb_nopk" );
$wpdb->query( "CREATE TABLE {$wpdb->prefix}vb_nopk (a varchar(100), t text) " . $wpdb->get_charset_collate() );
for ( $i = 0; $i < 25; $i++ ) {
	$wpdb->insert(
        "{$wpdb->prefix}vb_nopk",
        array(
			'a' => "row$i",
			't' => "see http://localhost:8899/nopk/$i",
        )
    ); }
$wpdb->query( "DROP TABLE IF EXISTS {$wpdb->prefix}vb_child, {$wpdb->prefix}vb_parent" );
$wpdb->query( "CREATE TABLE {$wpdb->prefix}vb_parent (id int NOT NULL, PRIMARY KEY (id)) ENGINE=InnoDB" );
$wpdb->query( "CREATE TABLE {$wpdb->prefix}vb_child (id int NOT NULL, pid int NOT NULL, PRIMARY KEY (id), KEY pid (pid), CONSTRAINT vb_fk FOREIGN KEY (pid) REFERENCES {$wpdb->prefix}vb_parent (id) ON DELETE CASCADE) ENGINE=InnoDB" );
$wpdb->query( "INSERT INTO {$wpdb->prefix}vb_parent VALUES (1),(2)" );
$wpdb->query( "INSERT INTO {$wpdb->prefix}vb_child VALUES (1,1),(2,2)" );
$wpdb->query( "CREATE OR REPLACE VIEW {$wpdb->prefix}vb_view AS SELECT ID FROM {$wpdb->posts}" );
$up = wp_upload_dir()['basedir'];
wp_mkdir_p( "$up/2026/01" );
wp_mkdir_p( "$up/cache/x" );
for ( $i = 0; $i < 60; $i++ ) {
	file_put_contents( "$up/2026/01/img-$i.jpg", random_bytes( 20000 + $i ) ); }
file_put_contents( "$up/2026/01/big.bin", random_bytes( 6 * 1024 * 1024 ) );
file_put_contents( "$up/cache/x/skip.txt", 'cached' );
file_put_contents( "$up/2026/01/üñí çødé.txt", 'unicode name' );
@symlink( '/etc/hosts', "$up/2026/01/link-out" );
echo "seeded\n";
