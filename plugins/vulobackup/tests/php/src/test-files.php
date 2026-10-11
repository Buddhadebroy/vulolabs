<?php
/**
 * File inventory, archiving and extraction tests.
 *
 * @package VuloBackup
 */

namespace VuloBackup\Tests;

use Brain\Monkey\Functions;
use VuloBackup\Files\Archiver;
use VuloBackup\Files\Inventory;
use VuloBackup\Files\Matcher;
use VuloBackup\Restore\FilesRestorer;

/**
 * Files are listed, packed and unpacked on a real temporary folder.
 */
class FilesTest extends TestCase {

	/**
	 * Sets up the functions these classes call.
	 *
	 * @return void
	 */
	protected function setUp(): void {
		parent::setUp();

		Functions\when( 'wp_mkdir_p' )->alias(
			static function ( $path ) {
				return is_dir( $path ) || mkdir( $path, 0700, true );
			}
		);
		Functions\when( 'wp_is_writable' )->alias( 'is_writable' );
	}

	/**
	 * Builds a small site.
	 *
	 * @return array<string, string> Area roots.
	 */
	private function site() {
		$content = $this->tmp . '/site/wp-content';

		foreach ( array( 'uploads/2026', 'uploads/cache/deep', 'uploads/.git/objects', 'plugins/a', 'vulobackup-store', 'uploads.vbold-ab12cd34' ) as $dir ) {
			mkdir( $content . '/' . $dir, 0700, true );
		}

		file_put_contents( $content . '/uploads/2026/photo.jpg', str_repeat( 'J', 3000 ) );
		file_put_contents( $content . '/uploads/2026/notes.txt', str_repeat( 'text ', 500 ) );
		file_put_contents( $content . '/uploads/2026/huge.bin', str_repeat( 'x', 9000 ) );
		file_put_contents( $content . '/uploads/2026/archive.zip', 'zip' );
		file_put_contents( $content . '/uploads/cache/deep/c.txt', 'cache' );
		file_put_contents( $content . '/uploads/.git/objects/o', 'git' );
		file_put_contents( $content . '/plugins/a/a.php', '<?php' );
		file_put_contents( $content . '/vulobackup-store/.vulobackup-private', 'x' );
		file_put_contents( $content . '/vulobackup-store/backup.zip', 'do not back up backups' );
		file_put_contents( $content . '/uploads.vbold-ab12cd34/old.txt', 'left by a restore' );
		file_put_contents( $content . '/top.txt', 'other' );
		file_put_contents( $this->tmp . '/outside.txt', 'outside the site' );
		symlink( $this->tmp . '/outside.txt', $content . '/uploads/2026/link-to-file' );
		symlink( $this->tmp, $content . '/uploads/link-to-folder' );
		symlink( $content . '/uploads', $content . '/uploads/2026/loop' );

		return array(
			'uploads' => $content . '/uploads',
			'plugins' => $content . '/plugins',
			'others'  => $content,
		);
	}

	/**
	 * @param array    $roots Area roots.
	 * @param string[] $areas Areas to list.
	 * @param string[] $patterns Exclusions.
	 * @param int      $max_bytes Size limit.
	 * @return array{0: array, 1: string[]} Cursor and listed names.
	 */
	private function inventory( array $roots, array $areas, array $patterns = array(), $max_bytes = 0 ) {
		$cursor    = Inventory::cursor( $areas );
		$inventory = new Inventory( $roots, new Matcher( $patterns ), array_values( $roots ), $max_bytes, false );
		$list      = $this->tmp . '/files.list';
		$slices    = 0;

		// A deadline already in the past: the walk must still finish, one checkpoint at a time.
		while ( ! $inventory->run( $cursor, $list, microtime( true ) - 1, static fn() => null ) && ++$slices < 500 ) {
			continue;
		}

		$names = array();

		foreach ( file( $list, FILE_IGNORE_NEW_LINES ) as $line ) {
			$names[] = explode( "\t", $line, 2 )[1];
		}

		sort( $names );

		return array( $cursor, $names );
	}

	public function test_exclusion_patterns() {
		$matcher = new Matcher( array( 'uploads/cache/**', '**/.git/**', '*.zip', 'plugins/*/tmp', 'others/debug.log' ) );

		$this->assertTrue( $matcher->excludes( 'uploads/cache', true ) );
		$this->assertTrue( $matcher->excludes( 'uploads/cache/a/b.txt' ) );
		$this->assertFalse( $matcher->excludes( 'uploads/cached.txt' ) );
		$this->assertTrue( $matcher->excludes( 'plugins/x/.git', true ) );
		$this->assertTrue( $matcher->excludes( 'uploads/2026/big.ZIP' ), 'A pattern without a slash matches the name anywhere.' );
		$this->assertTrue( $matcher->excludes( 'plugins/a/tmp', true ) );
		$this->assertFalse( $matcher->excludes( 'plugins/a/b/tmp', true ), '* does not cross folders.' );
		$this->assertTrue( $matcher->excludes( 'others/debug.log' ) );
		$this->assertFalse( $matcher->excludes( 'uploads/debug.log' ) );
	}

	public function test_inventory_lists_files_and_leaves_out_what_it_must() {
		$roots = $this->site();

		list( $cursor, $names ) = $this->inventory( $roots, array( 'uploads', 'others' ), array( 'uploads/cache/**', '**/.git/**', '*.zip' ), 5000 );

		$this->assertSame( array( 'others/top.txt', 'uploads/2026/notes.txt', 'uploads/2026/photo.jpg' ), $names );
		$this->assertSame( 3, $cursor['files'] );
		$this->assertSame( 3, $cursor['skipped']['symlinks'], 'Links to a file, to a folder outside and back into the tree are all left out, not followed.' );
		$this->assertSame( 1, $cursor['skipped']['too_large'] );
		$this->assertGreaterThanOrEqual( 3, $cursor['skipped']['excluded'] );
		$this->assertSame( 2, $cursor['by_area']['uploads']['files'] );
		$this->assertContains( 'uploads/2026/huge.bin', $cursor['samples']['too_large'] );
	}

	public function test_archive_in_parts_then_restore_into_staging() {
		$roots = $this->site();

		list( , $names ) = $this->inventory( $roots, array( 'uploads', 'plugins' ) );

		$this->assertContains( 'uploads/2026/huge.bin', $names );

		// Gone between listing and archiving: the backup carries on and says so.
		unlink( $roots['uploads'] . '/2026/notes.txt' );

		mkdir( $this->tmp . '/backup' );

		$cursor   = Archiver::cursor();
		$archiver = new Archiver( $roots, 1048576 );
		$slices   = 0;

		while ( ! $archiver->run( $cursor, $this->tmp . '/files.list', $this->tmp . '/backup', microtime( true ) - 1, static fn() => null ) && ++$slices < 100 ) {
			continue;
		}

		$this->assertTrue( $cursor['done'] );
		$this->assertSame( 1, $cursor['missing'] );
		$this->assertSame( count( $names ) - 1, $cursor['files'] );
		$this->assertSame( array( 'uploads/2026/notes.txt' ), $cursor['samples'] );

		$archives = array();

		foreach ( $cursor['parts'] as $part ) {
			$archives[] = $this->tmp . '/backup/' . $part['name'];
		}

		// Restore only uploads, into a different "site".
		mkdir( $this->tmp . '/target/uploads', 0700, true );
		file_put_contents( $this->tmp . '/target/uploads/newer.txt', 'added after the backup' );

		$target   = array( 'uploads' => $this->tmp . '/target/uploads' );
		$restorer = new FilesRestorer( $target, 'ab12cd34', $this->tmp . '/overlay' );
		$extract  = FilesRestorer::cursor();

		while ( ! $restorer->extract( $extract, $archives, array( 'uploads' ), 100, 1000000, microtime( true ) - 1, static fn() => null ) ) {
			continue;
		}

		$this->assertFileExists( $restorer->staging( 'uploads' ) . '/2026/photo.jpg' );
		$this->assertFileDoesNotExist( $this->tmp . '/target/uploads/2026/photo.jpg', 'The live folder is untouched until the swap.' );
		$this->assertDirectoryDoesNotExist( $this->tmp . '/target/plugins', 'An area that was not chosen is not unpacked.' );

		$this->assertSame( array( 'uploads' ), $restorer->swap( array( 'uploads' ) ) );
		$this->assertSame( str_repeat( 'J', 3000 ), file_get_contents( $this->tmp . '/target/uploads/2026/photo.jpg' ) );
		$this->assertFileDoesNotExist( $this->tmp . '/target/uploads/newer.txt' );
		$this->assertFileExists( $restorer->retired( 'uploads' ) . '/newer.txt', 'The replaced folder is kept until the restore is over.' );

		$this->assertTrue( $restorer->rollback( array( 'uploads' ) ) );
		$this->assertFileExists( $this->tmp . '/target/uploads/newer.txt', 'Rolling back puts the previous folder in place again.' );
		$this->assertFileDoesNotExist( $this->tmp . '/target/uploads/2026/photo.jpg' );
	}

	/**
	 * @dataProvider hostile_entries
	 *
	 * @param callable $add Adds a hostile entry to a zip.
	 */
	public function test_hostile_archive_entries_stop_the_restore( callable $add ) {
		mkdir( $this->tmp . '/target/uploads', 0700, true );

		$zip = new \ZipArchive();
		$zip->open( $this->tmp . '/evil.zip', \ZipArchive::CREATE );
		$zip->addFromString( 'uploads/ok.txt', 'fine' );
		$add( $zip );
		$zip->close();

		$restorer = new FilesRestorer( array( 'uploads' => $this->tmp . '/target/uploads' ), 'ab12cd34', $this->tmp . '/overlay' );
		$cursor   = FilesRestorer::cursor();

		try {
			$restorer->extract( $cursor, array( $this->tmp . '/evil.zip' ), array( 'uploads' ), 2, 100, microtime( true ) + 10, static fn() => null );
			$this->fail( 'The archive should have been refused.' );
		} catch ( \RuntimeException $error ) {
			$this->assertFileDoesNotExist( $this->tmp . '/evil.txt' );
			$this->assertFileDoesNotExist( $this->tmp . '/target/evil.txt' );
			// Whatever was unpacked before the refusal is in the staging folder only, and the entry
			// that was refused is not there at all.
			$this->assertSame( array(), array_intersect( array( 'evil.txt', 'link', 'bomb.txt', 'c.txt' ), scandir( $restorer->staging( 'uploads' ) ) ), 'Nothing of the hostile entry was written.' );
			$this->assertSame( array(), array_values( array_diff( scandir( $this->tmp . '/target/uploads' ), array( '.', '..' ) ) ), 'The live folder is untouched.' );
		}
	}

	/**
	 * @return array[]
	 */
	public function hostile_entries() {
		return array(
			'parent folder'        => array( static fn( $zip ) => $zip->addFromString( 'uploads/../evil.txt', 'x' ) ),
			'far parent folder'    => array( static fn( $zip ) => $zip->addFromString( 'uploads/a/../../../evil.txt', 'x' ) ),
			'absolute path'        => array( static fn( $zip ) => $zip->addFromString( '/tmp/evil.txt', 'x' ) ),
			'backslashes'          => array( static fn( $zip ) => $zip->addFromString( 'uploads\\..\\evil.txt', 'x' ) ),
			'drive letter'         => array( static fn( $zip ) => $zip->addFromString( 'C:/evil.txt', 'x' ) ),
			'unknown area'         => array( static fn( $zip ) => $zip->addFromString( 'somewhere/evil.txt', 'x' ) ),
			'area with no file'    => array( static fn( $zip ) => $zip->addFromString( 'uploads', 'x' ) ),
			'symbolic link'        => array(
				static function ( $zip ) {
					$zip->addFromString( 'uploads/link', '/etc/passwd' );
					$zip->setExternalAttributesName( 'uploads/link', \ZipArchive::OPSYS_UNIX, 0120777 << 16 );
				},
			),
			'too many files'       => array(
				static function ( $zip ) {
					$zip->addFromString( 'uploads/b.txt', 'x' );
					$zip->addFromString( 'uploads/c.txt', 'x' );
				},
			),
			'more data than declared' => array( static fn( $zip ) => $zip->addFromString( 'uploads/bomb.txt', str_repeat( "\0", 1000000 ) ) ),
		);
	}
}
