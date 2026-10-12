<?php
/**
 * TestCase class file.
 *
 * @package VuloBackup
 */

namespace VuloBackup\Tests;

use Brain\Monkey;
use Brain\Monkey\Functions;
use Mockery\Adapter\Phpunit\MockeryPHPUnitIntegration;
use PHPUnit\Framework\TestCase as PHPUnitTestCase;

/**
 * Shared base: Brain\Monkey set-up plus working stand-ins for the WordPress functions the classes
 * under test call. These tests need no WordPress and no database; the ones that do live in
 * tests/integration and run against a real site.
 */
abstract class TestCase extends PHPUnitTestCase {

	use MockeryPHPUnitIntegration;

	/**
	 * In-memory wp_options.
	 *
	 * @var array
	 */
	protected $options = array();

	/**
	 * A scratch folder, removed after each test.
	 *
	 * @var string
	 */
	protected $tmp = '';

	/**
	 * Sets up Brain Monkey and a fresh test container before each test.
	 *
	 * @return void
	 */
	protected function setUp(): void {
		parent::setUp();
		Monkey\setUp();

		$this->options                        = array();
		$this->tmp                            = sys_get_temp_dir() . '/vulobackup-unit-' . bin2hex( random_bytes( 6 ) );
		$GLOBALS['vulobackup_test_container'] = new \stdClass();

		mkdir( $this->tmp, 0700, true );

		Functions\when( 'get_option' )->alias(
			function ( $key, $fallback = false ) {
				return array_key_exists( $key, $this->options ) ? $this->options[ $key ] : $fallback;
			}
		);
		Functions\when( 'update_option' )->alias(
			function ( $key, $value ) {
				$this->options[ $key ] = $value;

				return true;
			}
		);
		Functions\when( 'add_option' )->alias(
			function ( $key, $value ) {
				if ( ! array_key_exists( $key, $this->options ) ) {
					$this->options[ $key ] = $value;
				}

				return true;
			}
		);
		Functions\when( 'delete_option' )->alias(
			function ( $key ) {
				unset( $this->options[ $key ] );

				return true;
			}
		);

		Functions\when( '__' )->returnArg();
		Functions\when( 'esc_html__' )->returnArg();
		Functions\when( 'esc_html' )->returnArg();
		Functions\when( 'esc_xml' )->returnArg();
		Functions\when( 'apply_filters' )->alias(
			static function ( $hook, $value ) {
				return $value;
			}
		);
		Functions\when( 'wp_salt' )->justReturn( 'unit-test-salt' );
		Functions\when( 'home_url' )->justReturn( 'https://shop.example.com' );
		Functions\when( 'wp_parse_url' )->alias( 'parse_url' );
		Functions\when( 'wp_json_encode' )->alias( 'json_encode' );
		Functions\when( 'wp_normalize_path' )->alias(
			static function ( $path ) {
				return str_replace( '\\', '/', (string) $path );
			}
		);
		Functions\when( 'untrailingslashit' )->alias(
			static function ( $path ) {
				return rtrim( (string) $path, '/\\' );
			}
		);
		Functions\when( 'wp_delete_file' )->alias(
			static function ( $file ) {
				return @unlink( $file ); // phpcs:ignore
			}
		);
		Functions\when( 'wp_strip_all_tags' )->alias(
			static function ( $text ) {
				return trim( strip_tags( (string) $text ) ); // phpcs:ignore WordPress.WP.AlternativeFunctions.strip_tags_strip_tags
			}
		);
		Functions\when( 'sanitize_text_field' )->alias(
			static function ( $text ) {
				return trim( preg_replace( '/[\r\n\t ]+/', ' ', strip_tags( (string) $text ) ) ); // phpcs:ignore WordPress.WP.AlternativeFunctions.strip_tags_strip_tags
			}
		);
		Functions\when( 'sanitize_key' )->alias(
			static function ( $key ) {
				return preg_replace( '/[^a-z0-9_\-]/', '', strtolower( (string) $key ) );
			}
		);
		Functions\when( 'sanitize_email' )->alias(
			static function ( $email ) {
				return trim( (string) $email );
			}
		);
		Functions\when( 'is_email' )->alias(
			static function ( $email ) {
				return false !== filter_var( $email, FILTER_VALIDATE_EMAIL ) ? $email : false;
			}
		);
		Functions\when( 'esc_url_raw' )->alias(
			static function ( $url ) {
				return preg_match( '#^https?://#', (string) $url ) ? (string) $url : '';
			}
		);
		Functions\when( 'is_wp_error' )->alias(
			static function ( $thing ) {
				return $thing instanceof \WP_Error;
			}
		);
	}

	/**
	 * Tears down Brain Monkey and removes the scratch folder.
	 *
	 * @return void
	 */
	protected function tearDown(): void {
		$this->remove( $this->tmp );

		Monkey\tearDown();
		parent::tearDown();
	}

	/**
	 * Deletes a folder and its contents.
	 *
	 * @param string $path Folder or file.
	 * @return void
	 */
	private function remove( $path ) {
		if ( is_dir( $path ) && ! is_link( $path ) ) {
			foreach ( array_diff( scandir( $path ), array( '.', '..' ) ) as $entry ) {
				$this->remove( $path . '/' . $entry );
			}

			rmdir( $path );
		} elseif ( file_exists( $path ) || is_link( $path ) ) {
			unlink( $path );
		}
	}
}
