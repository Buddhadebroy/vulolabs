<?php
/**
 * Path, manifest, crypto and redaction tests.
 *
 * @package VuloBackup
 */

namespace VuloBackup\Tests;

use VuloBackup\Backup\Manifest;
use VuloBackup\Security\Crypto;
use VuloBackup\Security\PathGuard;
use VuloBackup\Security\Redactor;
use VuloBackup\Settings\Settings;

/**
 * The checks that stand between untrusted input (archives, manifests, requests) and the disk.
 */
class SecurityTest extends TestCase {

	public function test_relative_paths() {
		foreach ( array( 'uploads/2026/a.jpg', 'plugins/x/y.php', 'a', 'core/.htaccess', 'uploads/ü ñ.txt', 'uploads/..hidden', 'uploads/a..b' ) as $path ) {
			$this->assertTrue( PathGuard::is_safe_relative( $path ), $path );
		}

		foreach ( array( '', '/etc/passwd', '../x', 'a/../b', 'a/..', '..', 'a//b', './a', 'a/./b', 'a\\b', 'C:/x', "a\0b", "a\nb", 'a:b', str_repeat( 'a/', 600 ), null, array( 'a' ), 5 ) as $path ) {
			$this->assertFalse( PathGuard::is_safe_relative( $path ), var_export( $path, true ) ); // phpcs:ignore
		}
	}

	public function test_ids() {
		$this->assertTrue( PathGuard::is_id( '20261010-203347-0bf95491' ) );

		foreach ( array( '', 'short', '../../etc', 'a/b-c-d-e', 'UPPERCASE-ID', '-leading-dash', 'has space', 'x.y-z-123', str_repeat( 'a', 60 ), null ) as $id ) {
			$this->assertFalse( PathGuard::is_id( $id ), var_export( $id, true ) ); // phpcs:ignore
		}
	}

	public function test_containment_resolves_symbolic_links() {
		mkdir( $this->tmp . '/base/inner', 0700, true );
		mkdir( $this->tmp . '/outside' );
		file_put_contents( $this->tmp . '/outside/secret', 'x' );
		symlink( $this->tmp . '/outside', $this->tmp . '/base/link' );

		$base = $this->tmp . '/base';

		$this->assertTrue( PathGuard::is_within( $base . '/inner', $base ) );
		$this->assertTrue( PathGuard::is_within( $base, $base ) );
		$this->assertFalse( PathGuard::is_within( $base . '/link/secret', $base ), 'A link out of the folder does not count as inside it.' );
		$this->assertFalse( PathGuard::is_within( $this->tmp . '/outside', $base ) );
		$this->assertFalse( PathGuard::is_within( $this->tmp . '/base-sibling', $base ) );
		$this->assertTrue( PathGuard::would_be_within( $base . '/new/deeper/file.txt', $base ) );
		$this->assertFalse( PathGuard::would_be_within( $base . '/link/new.txt', $base ) );
		$this->assertFalse( PathGuard::would_be_within( $base . '/new/../../outside/x', $base ) );
	}

	/**
	 * @return array A manifest as the engine writes it.
	 */
	private function manifest() {
		return array(
			'format'   => 1,
			'id'       => '20261010-203347-0bf95491',
			'name'     => 'Full backup',
			'type'     => 'full',
			'site'     => array(
				'home'      => 'https://shop.example.com',
				'siteurl'   => 'https://shop.example.com',
				'prefix'    => 'wp_',
				'charset'   => 'utf8mb4',
				'multisite' => false,
			),
			'database' => array(
				'tables' => 2,
				'rows'   => 10,
				'bytes'  => 100,
				'names'  => array( 'wp_posts', 'wp_users', 'bad`name' ),
			),
			'files'    => array(
				'count'   => 3,
				'bytes'   => 300,
				'by_area' => array(
					'uploads' => array(
						'files' => 3,
						'bytes' => 300,
					),
					'../etc'  => array(
						'files' => 1,
						'bytes' => 1,
					),
				),
			),
			'parts'    => array(
				array(
					'name'   => 'database.sql.gz',
					'bytes'  => 50,
					'sha256' => str_repeat( 'a', 64 ),
				),
				array(
					'name'    => 'files-001.zip',
					'bytes'   => 200,
					'sha256'  => str_repeat( 'b', 64 ),
					'entries' => 3,
				),
			),
		);
	}

	public function test_a_good_manifest_is_accepted_and_cleaned() {
		$clean = Manifest::validate( $this->manifest() );

		$this->assertIsArray( $clean );
		$this->assertSame( 250, $clean['total_bytes'] );
		$this->assertSame( array( 'wp_posts', 'wp_users' ), $clean['database']['names'], 'A table name that could not be in a dump is dropped.' );
		$this->assertSame( array( 'uploads' ), array_keys( $clean['files']['by_area'] ), 'An area that does not exist is dropped.' );
		$this->assertSame( 'files', $clean['parts'][1]['role'] );
		$this->assertFalse( $clean['encrypted'] );
	}

	/**
	 * @dataProvider bad_manifests
	 *
	 * @param callable $break Changes a good manifest into a bad one.
	 */
	public function test_a_bad_manifest_is_refused( callable $break ) {
		$this->assertInstanceOf( \WP_Error::class, Manifest::validate( $break( $this->manifest() ) ) );
	}

	/**
	 * @return array[]
	 */
	public function bad_manifests() {
		$part = static function ( $name ) {
			return static function ( $m ) use ( $name ) {
				$m['parts'][1]['name'] = $name;

				return $m;
			};
		};

		return array(
			'not an array'                   => array( static fn() => 'manifest' ),
			'no parts'                       => array( static fn( $m ) => array_merge( $m, array( 'parts' => array() ) ) ),
			'newer format'                   => array( static fn( $m ) => array_merge( $m, array( 'format' => 99 ) ) ),
			'unknown type'                   => array( static fn( $m ) => array_merge( $m, array( 'type' => 'everything' ) ) ),
			'part outside the folder'        => array( $part( '../../wp-config.php' ) ),
			'part with a folder'             => array( $part( 'sub/files-001.zip' ) ),
			'php part'                       => array( $part( 'shell.php' ) ),
			'double extension'               => array( $part( 'files-001.zip.php' ) ),
			'duplicate part'                 => array( $part( 'database.sql.gz' ) ),
			'encrypted name, plain manifest' => array( $part( 'files-001.zip.enc' ) ),
			'bad checksum'                   => array(
				static function ( $m ) {
					$m['parts'][0]['sha256'] = 'zz';

					return $m;
				},
			),
			'negative size'                  => array(
				static function ( $m ) {
					$m['parts'][0]['bytes'] = -5;

					return $m;
				},
			),
			'encrypted without salt'         => array(
				static function ( $m ) {
					$m['encrypted']        = true;
					$m['parts'][0]['name'] = 'database.sql.gz.enc';
					$m['parts'][1]['name'] = 'files-001.zip.enc';

					return $m;
				},
			),
		);
	}

	public function test_encryption_round_trip_and_tamper_detection() {
		if ( ! Crypto::is_available() ) {
			$this->markTestSkipped( 'PHP has no sodium extension.' );
		}

		$plain = $this->tmp . '/plain.bin';
		$salt  = random_bytes( Crypto::SALT_BYTES );

		foreach ( array( 0, 1, Crypto::CHUNK - 1, Crypto::CHUNK, Crypto::CHUNK * 2 + 17 ) as $size ) {
			file_put_contents( $plain, $size ? random_bytes( $size ) : '' );

			Crypto::encrypt_file( $plain, $plain . '.enc', 'correct horse battery', $salt );
			Crypto::decrypt_file( $plain . '.enc', $plain . '.out', 'correct horse battery' );

			$this->assertSame( hash_file( 'sha256', $plain ), hash_file( 'sha256', $plain . '.out' ), "A file of $size bytes survives encryption." );
			$this->assertStringNotContainsString( 'correct horse', file_get_contents( $plain . '.enc' ) );
		}

		$encrypted = file_get_contents( $plain . '.enc' );

		$tampered = array(
			'wrong password'   => array( $encrypted, 'wrong password' ),
			'one byte changed' => array( substr_replace( $encrypted, chr( ord( $encrypted[5000] ) ^ 1 ), 5000, 1 ), 'correct horse battery' ),
			'cut short'        => array( substr( $encrypted, 0, Crypto::CHUNK + 500 ), 'correct horse battery' ),
			'last chunk gone'  => array( substr( $encrypted, 0, strlen( Crypto::MAGIC ) + Crypto::SALT_BYTES + 24 + 2 * ( Crypto::CHUNK + 17 ) ), 'correct horse battery' ),
			'data appended'    => array( $encrypted . 'extra', 'correct horse battery' ),
			'not encrypted'    => array( 'PK just a zip file, long enough to read a header from it........................', 'correct horse battery' ),
		);

		foreach ( $tampered as $label => $case ) {
			file_put_contents( $plain . '.bad', $case[0] );

			try {
				Crypto::decrypt_file( $plain . '.bad', $plain . '.out2', $case[1] );
				$this->fail( "Decryption should refuse: $label" );
			} catch ( \RuntimeException $error ) {
				$this->assertFileDoesNotExist( $plain . '.out2', "Nothing is left behind: $label" );
			}
		}
	}

	public function test_secrets_and_server_paths_are_kept_out_of_logs() {
		$text = Redactor::scrub(
			'Failed: Authorization: AWS4-HMAC-SHA256 Credential=AKIAEXAMPLE/20260101, Signature=abcdef0123 secret_key=wJalrXUtnFEMI password: "hunter2hunter2" at /var/www/wp-content/vulobackup-abc/backups/x.zip token s3cr3t-value-here',
			array( 's3cr3t-value-here' )
		);

		foreach ( array( 'AKIAEXAMPLE', 'abcdef0123', 'wJalrXUtnFEMI', 'hunter2hunter2', 's3cr3t-value-here', '/var/www/' ) as $secret ) {
			$this->assertStringNotContainsString( $secret, $text );
		}

		$this->assertStringContainsString( 'wp-content/vulobackup-abc', $text, 'The path is shortened, not removed.' );
		$this->assertStringNotContainsString( 'MIIEvQ', Redactor::scrub( "key -----BEGIN OPENSSH PRIVATE KEY-----\nMIIEvQIBADANBg\n-----END OPENSSH PRIVATE KEY----- end" ) );
	}

	public function test_settings_are_sanitized() {
		$this->assertSame( array( 'plugins', 'uploads' ), Settings::sanitize( 'areas', array( 'uploads', 'plugins', 'etc', '../x' ) ) );
		$this->assertSame( "uploads/videos/**\n*.zip", Settings::sanitize( 'exclude_patterns', "uploads/videos/**\r\n../../etc/passwd\n\n/*.zip/\nuploads/videos/**" ), 'Patterns that step out of the site are dropped.' );
		$this->assertSame( 'manual', Settings::sanitize( 'schedule_files', 'hourly' ) );
		$this->assertSame( 23, Settings::sanitize( 'schedule_hour', 99 ) );
		$this->assertSame( 28, Settings::sanitize( 'schedule_monthday', 31 ) );
		$this->assertSame( 0, Settings::sanitize( 'retention_count', -4 ) );
		$this->assertSame( 5, Settings::sanitize( 'step_seconds', 0 ) );
		$this->assertSame( '', Settings::sanitize( 'notify_email', 'not an email' ) );
		$this->assertSame( 'keep_data', Settings::sanitize( 'keep_data_uninstall', 'anything' ) );
	}
}
