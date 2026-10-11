<?php
/**
 * SqlGuard tests.
 *
 * @package VuloBackup
 */

namespace VuloBackup\Tests;

use VuloBackup\Database\SqlGuard;

/**
 * The restore only runs lines of a dump that have one of the few shapes the exporter writes.
 */
class SqlGuardTest extends TestCase {

	public function test_literals_round_trip_through_the_guard() {
		$values = array( "it's", 'back\\slash', "line\nbreak\r", "nul\0byte", "ctrl\x1aZ", '', '多字节 😀', "'); DROP TABLE wp_users; --", '\\', "\\'" );
		$tuple  = implode( ',', array_map( array( SqlGuard::class, 'literal' ), $values ) );
		$line   = 'INSERT INTO `wp_posts` VALUES (' . $tuple . ',NULL,' . SqlGuard::literal( "\x00\xFF'", true ) . ",''),(1,2.5,-3,1e5);";

		$this->assertStringNotContainsString( "\n", $line, 'A statement is always exactly one line.' );
		$this->assertSame(
			array(
				'type'  => 'insert',
				'table' => 'wp_posts',
			),
			SqlGuard::classify( $line )
		);
		$this->assertSame( 'NULL', SqlGuard::literal( null ) );
		$this->assertSame( '0x00FF27', SqlGuard::literal( "\x00\xFF'", true ) );
	}

	public function test_the_statements_the_exporter_writes_are_accepted() {
		$this->assertSame( 'comment', SqlGuard::classify( '-- VuloBackup SQL dump' )['type'] );
		$this->assertSame( 'blank', SqlGuard::classify( '' )['type'] );
		$this->assertSame( 'set', SqlGuard::classify( 'SET NAMES utf8mb4;' )['type'] );
		$this->assertSame( 'set', SqlGuard::classify( 'SET FOREIGN_KEY_CHECKS = 0;' )['type'] );
		$this->assertSame( 'set', SqlGuard::classify( "SET SQL_MODE = 'NO_AUTO_VALUE_ON_ZERO';" )['type'] );
		$this->assertSame( 'wp_users', SqlGuard::classify( 'DROP TABLE IF EXISTS `wp_users`;' )['table'] );

		$create = "CREATE TABLE `wp_x` ( `id` bigint(20) NOT NULL AUTO_INCREMENT, `t` varchar(20) DEFAULT 'a;b -- c /* d' COMMENT 'it''s; fine', PRIMARY KEY (`id`) ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;";

		$this->assertSame( 'create', SqlGuard::classify( $create )['type'], 'Separators and comment marks inside quoted text are only text.' );
	}

	/**
	 * @dataProvider refused_lines
	 *
	 * @param string $line A line an attacker might add to a dump.
	 */
	public function test_anything_else_is_refused( $line ) {
		$this->expectException( \RuntimeException::class );

		SqlGuard::classify( $line );
	}

	/**
	 * @return array[]
	 */
	public function refused_lines() {
		return array(
			'drop without IF EXISTS'        => array( 'DROP TABLE `wp_users`;' ),
			'drop database'                 => array( 'DROP DATABASE wp;' ),
			'update'                        => array( "UPDATE `wp_users` SET user_pass = 'x';" ),
			'delete'                        => array( 'DELETE FROM `wp_users`;' ),
			'second statement after insert' => array( 'INSERT INTO `wp_x` VALUES (1); DELETE FROM `wp_users`;' ),
			'statement hidden in a value'   => array( "INSERT INTO `wp_x` VALUES ('a'); DROP TABLE `wp_users`; -- ');" ),
			'function call'                 => array( "INSERT INTO `wp_x` VALUES (LOAD_FILE('/etc/passwd'));" ),
			'subquery'                      => array( 'INSERT INTO `wp_x` VALUES ((SELECT user_pass FROM wp_users LIMIT 1));' ),
			'variable'                      => array( 'INSERT INTO `wp_x` VALUES (@@version);' ),
			'unquoted word'                 => array( 'INSERT INTO `wp_x` VALUES (CURRENT_USER);' ),
			'unterminated string'           => array( "INSERT INTO `wp_x` VALUES ('abc);" ),
			'escaped closing quote'         => array( "INSERT INTO `wp_x` VALUES ('abc\\');" ),
			'insert with column list'       => array( 'INSERT INTO `wp_x` (`id`) VALUES (1);' ),
			'insert select'                 => array( 'INSERT INTO `wp_x` SELECT * FROM wp_users;' ),
			'on duplicate key'              => array( 'INSERT INTO `wp_x` VALUES (1) ON DUPLICATE KEY UPDATE id = 2;' ),
			'table name with a backtick'    => array( 'INSERT INTO `wp_x``; DROP TABLE y; --` VALUES (1);' ),
			'create then another statement' => array( 'CREATE TABLE `wp_x` ( `id` int ); DROP TABLE `wp_users`;' ),
			'create with a comment'         => array( 'CREATE TABLE `wp_x` ( `id` int ) /* hidden */;' ),
			'create with a dash comment'    => array( 'CREATE TABLE `wp_x` ( `id` int ) -- ;' ),
			'create with a hash comment'    => array( 'CREATE TABLE `wp_x` ( `id` int ) # ;' ),
			'create ... select'             => array( 'CREATE TABLE wp_x AS SELECT * FROM wp_users;' ),
			'create without terminator'     => array( 'CREATE TABLE `wp_x` ( `id` int )' ),
			'set of something else'         => array( "SET GLOBAL general_log = 'ON';" ),
			'set sql_mode to another value' => array( "SET SQL_MODE = '';" ),
			'grant'                         => array( "GRANT ALL ON *.* TO 'x'@'%';" ),
			'into outfile'                  => array( "SELECT '<?php' INTO OUTFILE '/var/www/x.php';" ),
			'executable comment'            => array( '/*!50000 DROP TABLE wp_users */;' ),
			'delimiter'                     => array( 'DELIMITER ;;' ),
		);
	}

	public function test_table_names() {
		$this->assertTrue( SqlGuard::is_table_name( 'wp_2_posts' ) );
		$this->assertFalse( SqlGuard::is_table_name( 'wp posts' ) );
		$this->assertFalse( SqlGuard::is_table_name( 'wp`x' ) );
		$this->assertFalse( SqlGuard::is_table_name( str_repeat( 'a', 65 ) ) );
		$this->assertSame( '`a``b`', SqlGuard::ident( 'a`b' ) );
	}
}
