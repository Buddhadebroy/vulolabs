<?php
/**
 * Uploads class file.
 *
 * @package VuloForm
 */

namespace VuloForm\Submissions;

use VuloForm\Forms\Schema;

defined( 'ABSPATH' ) || exit;

/**
 * Validates and stores files sent through a file field.
 *
 * Files are kept out of the media library, under random folder and file names, in a directory that
 * refuses direct requests. They are only ever served through an administrator-only route
 * (Rest\Submissions::download_file()).
 */
class Uploads {

	/**
	 * Folder under wp-content/uploads.
	 */
	const FOLDER = 'vuloform';

	/**
	 * @return string Absolute path of the private upload folder, without a trailing slash.
	 */
	public static function base_dir() {
		$uploads = wp_upload_dir( null, false );

		return untrailingslashit( $uploads['basedir'] ) . '/' . self::FOLDER;
	}

	/**
	 * Checks the files sent for one field, without storing anything.
	 *
	 * @param array $field Field definition (allowed_types, max_size_mb, max_files).
	 * @param array $files Normalised list from normalise().
	 * @return string Error message, or '' when every file is acceptable.
	 */
	public static function validate( array $field, array $files ) {
		if ( count( $files ) > (int) $field['max_files'] ) {
			/* translators: %d: number of files. */
			return sprintf( _n( 'You can upload %d file here.', 'You can upload up to %d files here.', (int) $field['max_files'], 'vuloform' ), (int) $field['max_files'] );
		}

		foreach ( $files as $file ) {
			if ( UPLOAD_ERR_OK !== (int) $file['error'] || ! is_uploaded_file( $file['tmp_name'] ) ) {
				return __( 'The file could not be uploaded. Please try again.', 'vuloform' );
			}

			if ( (int) $file['size'] > (int) $field['max_size_mb'] * MB_IN_BYTES ) {
				/* translators: %d: size in megabytes. */
				return sprintf( __( 'Each file must be %d MB or smaller.', 'vuloform' ), (int) $field['max_size_mb'] );
			}

			if ( '' === self::safe_extension( $file, $field['allowed_types'] ) ) {
				/* translators: %s: comma-separated file extensions. */
				return sprintf( __( 'That file type is not allowed. Allowed types: %s.', 'vuloform' ), implode( ', ', $field['allowed_types'] ) );
			}
		}

		return '';
	}

	/**
	 * Moves validated files into the private folder.
	 *
	 * @param array $field Field definition.
	 * @param array $files Normalised list that passed validate().
	 * @return array<int, array{name: string, path: string, size: int, type: string}> Stored file records.
	 */
	public static function store( array $field, array $files ) {
		$base = self::base_dir();

		if ( ! self::protect( $base ) ) {
			return array();
		}

		// One unguessable folder per upload batch.
		$folder = strtolower( wp_generate_password( 32, false ) );

		if ( ! wp_mkdir_p( $base . '/' . $folder ) ) {
			return array();
		}

		$stored = array();

		foreach ( $files as $file ) {
			$extension = self::safe_extension( $file, $field['allowed_types'] );
			$relative  = $folder . '/' . strtolower( wp_generate_password( 20, false ) ) . '.' . $extension;

			// phpcs:ignore Generic.PHP.ForbiddenFunctions.Found -- the file was checked with is_uploaded_file() in validate().
			if ( '' !== $extension && move_uploaded_file( $file['tmp_name'], $base . '/' . $relative ) ) {
				$stored[] = array(
					'name' => sanitize_file_name( $file['name'] ),
					'path' => $relative,
					'size' => (int) $file['size'],
					'type' => Schema::FILE_TYPES[ $extension ][0],
				);
			}
		}

		return $stored;
	}

	/**
	 * Resolves a stored file record to a real path inside the private folder.
	 *
	 * @param array $record Stored file record.
	 * @return string Absolute path, or '' when the record doesn't point inside the folder.
	 */
	public static function path( array $record ) {
		$relative = (string) ( $record['path'] ?? '' );

		// Records are written by store(), but a path is never trusted on the way back out.
		if ( ! preg_match( '#^[a-z0-9]{32}/[a-z0-9]{20}\.[a-z0-9]{2,5}$#', $relative ) ) {
			return '';
		}

		$path = self::base_dir() . '/' . $relative;

		return is_file( $path ) ? $path : '';
	}

	/**
	 * Removes the files attached to a submission.
	 *
	 * @param array $submission Submission (data).
	 * @return void
	 */
	public static function delete_for_submission( array $submission ) {
		foreach ( $submission['data'] as $value ) {
			if ( ! is_array( $value ) ) {
				continue;
			}

			foreach ( $value as $record ) {
				$path = is_array( $record ) && isset( $record['path'] ) ? self::path( $record ) : '';

				if ( '' !== $path ) {
					wp_delete_file( $path );
					// The folder goes too once it is empty.
					// phpcs:ignore WordPress.PHP.NoSilencedErrors.Discouraged, WordPress.WP.AlternativeFunctions.file_system_operations_rmdir -- rmdir fails harmlessly while other files remain.
					@rmdir( dirname( $path ) );
				}
			}
		}
	}

	/**
	 * Removes the whole private folder (uninstall with "Delete everything").
	 *
	 * @return void
	 */
	public static function delete_all() {
		$base = self::base_dir();

		if ( ! is_dir( $base ) ) {
			return;
		}

		foreach ( (array) glob( $base . '/*', GLOB_ONLYDIR ) as $folder ) {
			foreach ( (array) glob( $folder . '/*' ) as $file ) {
				wp_delete_file( $file );
			}

			// phpcs:ignore WordPress.PHP.NoSilencedErrors.Discouraged, WordPress.WP.AlternativeFunctions.file_system_operations_rmdir
			@rmdir( $folder );
		}

		foreach ( array( '.htaccess', 'index.php', 'web.config' ) as $guard ) {
			wp_delete_file( $base . '/' . $guard );
		}

		// phpcs:ignore WordPress.PHP.NoSilencedErrors.Discouraged, WordPress.WP.AlternativeFunctions.file_system_operations_rmdir
		@rmdir( $base );
	}

	/**
	 * Turns PHP's `$_FILES` entry for one field into a flat list, dropping empty slots.
	 *
	 * @param array|null $entry `$_FILES['name']`, single or multiple.
	 * @return array<int, array{name: string, tmp_name: string, size: int, error: int}>
	 */
	public static function normalise( $entry ) {
		if ( ! is_array( $entry ) || ! isset( $entry['name'] ) ) {
			return array();
		}

		$files = array();

		foreach ( (array) $entry['name'] as $index => $name ) {
			$error = is_array( $entry['error'] ) ? $entry['error'][ $index ] : $entry['error'];

			if ( UPLOAD_ERR_NO_FILE === (int) $error ) {
				continue;
			}

			$files[] = array(
				'name'     => (string) $name,
				'tmp_name' => (string) ( is_array( $entry['tmp_name'] ) ? $entry['tmp_name'][ $index ] : $entry['tmp_name'] ),
				'size'     => (int) ( is_array( $entry['size'] ) ? $entry['size'][ $index ] : $entry['size'] ),
				'error'    => (int) $error,
			);
		}

		return $files;
	}

	/**
	 * The extension a file may be stored under: its own, if the form allows it and the file's real
	 * content matches it. Checking the name alone would let `shell.php` through as `shell.jpg`.
	 *
	 * @param array    $file    Normalised file.
	 * @param string[] $allowed Extensions the field allows.
	 * @return string Extension, or '' when the file is not acceptable.
	 */
	private static function safe_extension( array $file, array $allowed ) {
		$extension = strtolower( pathinfo( $file['name'], PATHINFO_EXTENSION ) );

		if ( ! in_array( $extension, $allowed, true ) || ! isset( Schema::FILE_TYPES[ $extension ] ) ) {
			return '';
		}

		// A double extension such as report.php.pdf can be executed by some server set-ups.
		if ( preg_match( '/\.(php\d?|phtml|phar|pl|py|cgi|asp|aspx|jsp|sh|exe|js|html?|svg)(\.|$)/i', $file['name'] ) ) {
			return '';
		}

		$mimes = array();

		foreach ( Schema::FILE_TYPES as $type => $types ) {
			$mimes[ $type ] = $types[0];
		}

		// Reads the file's real content type and compares it with the extension.
		$checked = wp_check_filetype_and_ext( $file['tmp_name'], $file['name'], $mimes );

		if ( empty( $checked['ext'] ) || empty( $checked['type'] ) || ! in_array( $checked['type'], Schema::FILE_TYPES[ $extension ], true ) ) {
			return '';
		}

		return $extension;
	}

	/**
	 * Creates the private folder with files that stop a web server from serving or listing it.
	 *
	 * @param string $base Folder path.
	 * @return bool Whether the folder exists.
	 */
	private static function protect( $base ) {
		if ( ! wp_mkdir_p( $base ) ) {
			return false;
		}

		$guards = array(
			'.htaccess'  => "Require all denied\nDeny from all\n",
			'index.php'  => "<?php\n// Silence is golden.\n",
			'web.config' => '<?xml version="1.0" encoding="UTF-8"?><configuration><system.webServer><authorization><deny users="*" /></authorization></system.webServer></configuration>',
		);

		foreach ( $guards as $name => $content ) {
			if ( ! file_exists( $base . '/' . $name ) ) {
				file_put_contents( $base . '/' . $name, $content ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_file_put_contents -- writing fixed guard files into the plugin's own upload folder.
			}
		}

		return true;
	}
}
