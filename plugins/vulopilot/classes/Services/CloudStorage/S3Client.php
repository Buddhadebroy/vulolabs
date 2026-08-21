<?php
/**
 * S3Client class file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\Services\CloudStorage;

defined( 'ABSPATH' ) || exit;

/**
 * Real Amazon S3 `PutObject`/`HeadBucket` calls, signed with a hand-rolled
 * AWS Signature Version 4 (SigV4) implementation rather than the official
 * `aws/aws-sdk-php` package — that package (and its dependencies) isn't in
 * this plugin's `composer.json` and is a genuinely large addition (tens of
 * MB) for the one call shape Backups actually needs (upload one archive,
 * confirm bucket access). SigV4 for a single-request `PutObject`/
 * `HeadBucket` is a fully deterministic, documented algorithm (AWS's own
 * "Signing AWS API requests" docs) — implemented directly against that spec
 * below, not guessed at.
 *
 * Every request uses virtual-hosted-style addressing
 * (`{bucket}.s3.{region}.amazonaws.com`) — AWS's own recommended style,
 * and simpler to sign correctly than path-style (which AWS is also
 * deprecating for new buckets).
 *
 * @class       S3Client class
 * @version     1.0.0
 * @author      VuloLabs
 */
class S3Client {

    private string $access_key;

    private string $secret_key;

    private string $region;

    private string $bucket;

    /**
     * @param string $access_key Real AWS Access Key ID.
     * @param string $secret_key Real AWS Secret Access Key.
     * @param string $region     Real AWS region, e.g. 'us-east-1'.
     * @param string $bucket     Real S3 bucket name.
     */
    public function __construct( string $access_key, string $secret_key, string $region, string $bucket ) {
        $this->access_key = $access_key;
        $this->secret_key = $secret_key;
        $this->region      = $region ?: 'us-east-1';
        $this->bucket      = $bucket;
    }

    /**
     * @return string
     */
    private function host(): string {
        return sprintf( '%s.s3.%s.amazonaws.com', $this->bucket, $this->region );
    }

    /**
     * Real SigV4 signing-key derivation chain (AWS's own "DateKey →
     * DateRegionKey → DateRegionServiceKey → SigningKey").
     *
     * @param string $date_stamp `Ymd` UTC.
     * @return string Raw (binary) signing key.
     */
    private function signing_key( string $date_stamp ): string {
        $k_date    = hash_hmac( 'sha256', $date_stamp, 'AWS4' . $this->secret_key, true );
        $k_region  = hash_hmac( 'sha256', $this->region, $k_date, true );
        $k_service = hash_hmac( 'sha256', 's3', $k_region, true );

        return hash_hmac( 'sha256', 'aws4_request', $k_service, true );
    }

    /**
     * Real SigV4 canonical-request → string-to-sign → signature chain for
     * one request, returning the full header set (including a real
     * `Authorization` header) to send.
     *
     * @param string $method       'PUT'|'HEAD'|'GET'.
     * @param string $uri_path     Already-encoded path, e.g. '/backup-2024.zip' or '/'.
     * @param string $payload_hash Lowercase hex sha256 of the request body ('' body → sha256('') constant).
     * @param array<string, string> $extra_headers Additional headers to sign/send (e.g. 'content-type'), lowercase keys.
     * @return array<string, string> Real headers to send with this request, including 'Authorization'.
     */
    private function build_signed_headers( string $method, string $uri_path, string $payload_hash, array $extra_headers = array() ): array {
        $amz_date   = gmdate( 'Ymd\THis\Z' );
        $date_stamp = gmdate( 'Ymd' );
        $host       = $this->host();

        $headers = array_merge(
            $extra_headers,
            array(
                'host'                 => $host,
                'x-amz-content-sha256' => $payload_hash,
                'x-amz-date'           => $amz_date,
            )
        );

        ksort( $headers );

        $canonical_headers = '';
        foreach ( $headers as $name => $value ) {
            $canonical_headers .= $name . ':' . trim( $value ) . "\n";
        }

        $signed_headers = implode( ';', array_keys( $headers ) );

        $canonical_request = implode(
            "\n",
            array(
                $method,
                $uri_path,
                '', // No query string on any request this client makes.
                $canonical_headers,
                $signed_headers,
                $payload_hash,
            )
        );

        $credential_scope = "{$date_stamp}/{$this->region}/s3/aws4_request";

        $string_to_sign = implode(
            "\n",
            array(
                'AWS4-HMAC-SHA256',
                $amz_date,
                $credential_scope,
                hash( 'sha256', $canonical_request ),
            )
        );

        $signature = hash_hmac( 'sha256', $string_to_sign, $this->signing_key( $date_stamp ) );

        $authorization = sprintf(
            'AWS4-HMAC-SHA256 Credential=%s/%s, SignedHeaders=%s, Signature=%s',
            $this->access_key,
            $credential_scope,
            $signed_headers,
            $signature
        );

        // Sent headers use their real casing (Host/Authorization/etc.) —
        // only the *canonical* form above needed to be lowercase for
        // signing purposes.
        $send_headers                  = $extra_headers;
        $send_headers['Host']          = $host;
        $send_headers['X-Amz-Content-Sha256'] = $payload_hash;
        $send_headers['X-Amz-Date']    = $amz_date;
        $send_headers['Authorization'] = $authorization;

        return $send_headers;
    }

    /**
     * Real `PUT {bucket}/{key}` — uploads `$body` as-is. Backups' own
     * archives are read fully into memory for this (`file_get_contents()`
     * at the call site, `Services\BackupStorageManager::upload_to_s3()`) —
     * the same "whole file in memory" risk profile
     * `BackupManager::restore()`'s own SQL-dump read already accepts for
     * this codebase, not a new trade-off.
     *
     * @param string $object_key   Real S3 object key (no leading slash).
     * @param string $body         Real raw file bytes.
     * @param string $content_type MIME type, e.g. 'application/zip'.
     * @return true|\WP_Error
     */
    public function put_object( string $object_key, string $body, string $content_type = 'application/octet-stream' ) {
        $uri_path     = '/' . ltrim( $object_key, '/' );
        $payload_hash = hash( 'sha256', $body );

        $headers = $this->build_signed_headers(
            'PUT',
            $uri_path,
            $payload_hash,
            array( 'content-type' => $content_type )
        );

        $response = wp_remote_request(
            'https://' . $this->host() . $uri_path,
            array(
                'method'  => 'PUT',
                'timeout' => 120,
                'headers' => $headers,
                'body'    => $body,
            )
        );

        if ( is_wp_error( $response ) ) {
            return $response;
        }

        $code = (int) wp_remote_retrieve_response_code( $response );

        if ( $code < 200 || $code >= 300 ) {
            return new \WP_Error(
                'vulopilot_s3_upload_failed',
                $this->extract_s3_error( $response, $code ),
                array( 'status' => 502 )
            );
        }

        return true;
    }

    /**
     * Real `HEAD {bucket}/` — the lightest real request that proves both
     * the credentials and the bucket/region are correct (a bad bucket name
     * or wrong region 404s/redirects; bad credentials 403s), used by
     * BackupStorage's own "Test connection".
     *
     * @return true|\WP_Error
     */
    public function head_bucket() {
        $payload_hash = hash( 'sha256', '' );
        $headers      = $this->build_signed_headers( 'HEAD', '/', $payload_hash );

        $response = wp_remote_request(
            'https://' . $this->host() . '/',
            array(
                'method'  => 'HEAD',
                'timeout' => 15,
                'headers' => $headers,
            )
        );

        if ( is_wp_error( $response ) ) {
            return $response;
        }

        $code = (int) wp_remote_retrieve_response_code( $response );

        if ( 200 !== $code ) {
            return new \WP_Error(
                'vulopilot_s3_connection_failed',
                $this->extract_s3_error( $response, $code ),
                array( 'status' => 502 )
            );
        }

        return true;
    }

    /**
     * S3 error responses are XML (`<Error><Code>.../<Message>...`), not
     * JSON — a small real extraction instead of showing raw XML/a bare
     * status code to the site owner.
     *
     * @param array|\WP_Error $response wp_remote_request()'s own return value.
     * @param int              $code     Real HTTP status code.
     * @return string
     */
    private function extract_s3_error( $response, int $code ): string {
        $body = (string) wp_remote_retrieve_body( $response );

        if ( '' !== $body && false !== strpos( $body, '<Error>' ) ) {
            $xml = simplexml_load_string( $body );

            if ( false !== $xml && isset( $xml->Message ) ) {
                return (string) $xml->Message;
            }
        }

        if ( 403 === $code ) {
            return __( 'Access denied — check the Access Key ID/Secret Access Key and that this key has permission on this bucket.', 'vulopilot' );
        }

        if ( 404 === $code ) {
            return __( 'Bucket not found — check the bucket name and region.', 'vulopilot' );
        }

        /* translators: %d is the real HTTP status code S3 returned. */
        return sprintf( __( 'S3 request failed (HTTP %d).', 'vulopilot' ), $code );
    }
}
