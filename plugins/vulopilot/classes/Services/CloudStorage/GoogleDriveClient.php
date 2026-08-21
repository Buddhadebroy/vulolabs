<?php
/**
 * GoogleDriveClient class file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\Services\CloudStorage;

defined( 'ABSPATH' ) || exit;

/**
 * Real Google Drive API v3 calls (`files.create` multipart upload,
 * `files.list`/`files.create` for the destination folder, `about.get` as a
 * lightweight token-validity check) — plain `wp_remote_*` HTTP calls
 * against Drive's documented REST API, no `google/apiclient` SDK (not in
 * this plugin's `composer.json`, and — like S3Client's own docblock —
 * a large dependency for the handful of endpoints Backups actually needs).
 * Every call here takes an already-valid access token; refreshing an
 * expired one is `Services\BackupGoogleDriveConnection::get_valid_access_token()`'s
 * job, not this class's.
 *
 * @class       GoogleDriveClient class
 * @version     1.0.0
 * @author      VuloLabs
 */
class GoogleDriveClient {

    private const API_BASE = 'https://www.googleapis.com/drive/v3';

    private const UPLOAD_BASE = 'https://www.googleapis.com/upload/drive/v3';

    private const FOLDER_NAME = 'VuloPilot Backups';

    /**
     * Lightweight real call proving the token actually works end-to-end
     * (not just that it's non-empty) — same "prove the connection actually
     * works, not just that a token exchange succeeded" posture
     * GoogleServicesConnection::list_search_console_sites() already
     * documents for its own equivalent check.
     *
     * @param string $access_token Real, currently-valid OAuth access token.
     * @return true|\WP_Error
     */
    public function test_connection( string $access_token ) {
        $response = wp_remote_get(
            self::API_BASE . '/about?fields=user',
            array(
                'timeout' => 15,
                'headers' => array( 'Authorization' => 'Bearer ' . $access_token ),
            )
        );

        if ( is_wp_error( $response ) ) {
            return $response;
        }

        $code = (int) wp_remote_retrieve_response_code( $response );

        if ( 200 !== $code ) {
            return new \WP_Error( 'vulopilot_gdrive_connection_failed', $this->extract_drive_error( $response, $code ), array( 'status' => 502 ) );
        }

        return true;
    }

    /**
     * Finds this connection's own "VuloPilot Backups" folder, creating it
     * on first use. Folder id is cached by the caller
     * (BackupGoogleDriveConnection's own stored `folder_id`) so this real
     * `files.list` lookup only ever runs once per connection, not once per
     * backup upload.
     *
     * @param string $access_token Real, currently-valid OAuth access token.
     * @return string|\WP_Error Real Drive folder id.
     */
    public function ensure_backup_folder( string $access_token ) {
        $query = sprintf(
            "mimeType = 'application/vnd.google-apps.folder' and name = '%s' and trashed = false and 'root' in parents",
            self::FOLDER_NAME
        );

        $response = wp_remote_get(
            self::API_BASE . '/files?' . http_build_query(
                array(
                    'q'      => $query,
                    'fields' => 'files(id, name)',
                    'spaces' => 'drive',
                )
            ),
            array(
                'timeout' => 15,
                'headers' => array( 'Authorization' => 'Bearer ' . $access_token ),
            )
        );

        if ( is_wp_error( $response ) ) {
            return $response;
        }

        $body = json_decode( (string) wp_remote_retrieve_body( $response ), true );

        if ( ! empty( $body['files'][0]['id'] ) ) {
            return (string) $body['files'][0]['id'];
        }

        $create_response = wp_remote_post(
            self::API_BASE . '/files',
            array(
                'timeout' => 15,
                'headers' => array(
                    'Authorization' => 'Bearer ' . $access_token,
                    'Content-Type'  => 'application/json',
                ),
                'body'    => wp_json_encode(
                    array(
                        'name'     => self::FOLDER_NAME,
                        'mimeType' => 'application/vnd.google-apps.folder',
                    )
                ),
            )
        );

        if ( is_wp_error( $create_response ) ) {
            return $create_response;
        }

        $create_code = (int) wp_remote_retrieve_response_code( $create_response );
        $create_body = json_decode( (string) wp_remote_retrieve_body( $create_response ), true );

        if ( 200 !== $create_code || empty( $create_body['id'] ) ) {
            return new \WP_Error( 'vulopilot_gdrive_folder_failed', $this->extract_drive_error( $create_response, $create_code ), array( 'status' => 502 ) );
        }

        return (string) $create_body['id'];
    }

    /**
     * Real `multipart/related` upload (Drive API v3's own documented
     * "Upload file data" shape) — one request carrying both the file's
     * JSON metadata (name + parent folder) and its raw bytes, boundary-
     * delimited by hand rather than a multipart form library, since this
     * is Drive's own two-part (not N-part) convention, not a regular HTML
     * form post.
     *
     * @param string $access_token Real, currently-valid OAuth access token.
     * @param string $folder_id    Real Drive folder id (ensure_backup_folder()'s own return value).
     * @param string $filename     Real filename to store, e.g. 'backup-2024-01-01-000000-abcdef.zip'.
     * @param string $file_bytes   Real raw archive bytes.
     * @return string|\WP_Error Real Drive file id.
     */
    public function upload_file( string $access_token, string $folder_id, string $filename, string $file_bytes ) {
        $boundary = wp_generate_password( 24, false );

        $metadata = wp_json_encode(
            array(
                'name'    => $filename,
                'parents' => array( $folder_id ),
            )
        );

        $body = "--{$boundary}\r\n"
            . "Content-Type: application/json; charset=UTF-8\r\n\r\n"
            . $metadata . "\r\n"
            . "--{$boundary}\r\n"
            . "Content-Type: application/zip\r\n\r\n"
            . $file_bytes . "\r\n"
            . "--{$boundary}--";

        $response = wp_remote_post(
            self::UPLOAD_BASE . '/files?uploadType=multipart&fields=id',
            array(
                'timeout' => 300,
                'headers' => array(
                    'Authorization' => 'Bearer ' . $access_token,
                    'Content-Type'  => 'multipart/related; boundary=' . $boundary,
                ),
                'body'    => $body,
            )
        );

        if ( is_wp_error( $response ) ) {
            return $response;
        }

        $code = (int) wp_remote_retrieve_response_code( $response );
        $data = json_decode( (string) wp_remote_retrieve_body( $response ), true );

        if ( 200 !== $code || empty( $data['id'] ) ) {
            return new \WP_Error( 'vulopilot_gdrive_upload_failed', $this->extract_drive_error( $response, $code ), array( 'status' => 502 ) );
        }

        return (string) $data['id'];
    }

    /**
     * Drive API errors are JSON (`{"error":{"message": "..."}}`) — a small
     * real extraction instead of a bare status code.
     *
     * @param array|\WP_Error $response wp_remote_*()'s own return value.
     * @param int              $code     Real HTTP status code.
     * @return string
     */
    private function extract_drive_error( $response, int $code ): string {
        $body = json_decode( (string) wp_remote_retrieve_body( $response ), true );

        if ( ! empty( $body['error']['message'] ) ) {
            return (string) $body['error']['message'];
        }

        /* translators: %d is the real HTTP status code Google Drive returned. */
        return sprintf( __( 'Google Drive request failed (HTTP %d).', 'vulopilot' ), $code );
    }
}
