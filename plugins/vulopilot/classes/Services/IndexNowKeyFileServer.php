<?php
/**
 * IndexNowKeyFileServer class file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\Services;

use VuloPilot\Utill;

defined( 'ABSPATH' ) || exit;

/**
 * Serves this site's IndexNow key file at `/{key}.txt` — the IndexNow
 * protocol's own ownership-proof mechanism (a plain-text file at the site
 * root containing exactly the key, matching `keyLocation` in every
 * IndexNowClient submission). Same virtual-route + physical-file dual
 * approach GeoAnalysis\LlmsTxtGenerator already uses for `/llms.txt`, and
 * for the identical reason documented there: the rewrite rule only takes
 * effect once WordPress's cached rewrite_rules option is flushed, so a
 * real on-disk file makes "Check key" (and any IndexNow crawler actually
 * fetching it) work even before that flush has happened.
 *
 * The rewrite pattern matches a fixed 32-lowercase-hex-character filename
 * shape (`generate_new_key()`'s own output format) rather than embedding
 * the current key's literal value in the pattern — so the rewrite rule
 * itself never needs to change (and re-flush) when an admin rotates the
 * key via the Instant Indexing tab's "Change key" button; only the
 * comparison inside maybe_serve() needs the current value.
 *
 * @class       IndexNowKeyFileServer class
 * @version     1.0.0
 * @author      VuloLabs
 */
class IndexNowKeyFileServer {

    private const QUERY_VAR = 'vulopilot_indexnow_key_file';

    /**
     * IndexNowKeyFileServer constructor.
     */
    public function __construct() {
        add_action( 'init', array( $this, 'register_rewrite_rule' ) );
        add_filter( 'query_vars', array( $this, 'add_query_var' ) );
        // Priority 1 — must run before WordPress core's own
        // redirect_canonical() (hooked on this same action at its default
        // priority 10): core's canonical-redirect logic otherwise 301s an
        // unmatched key-file guess (treating it as a page missing a
        // trailing slash) before this callback ever gets a chance to set a
        // real 404 for it.
        add_action( 'template_redirect', array( $this, 'maybe_serve' ), 1 );
    }

    /**
     * @return void
     */
    public function register_rewrite_rule(): void {
        add_rewrite_rule( '^([a-f0-9]{32})\.txt$', 'index.php?' . self::QUERY_VAR . '=$matches[1]', 'top' );
    }

    /**
     * @param string[] $vars Existing public query vars.
     * @return string[]
     */
    public function add_query_var( array $vars ): array {
        $vars[] = self::QUERY_VAR;
        return $vars;
    }

    /**
     * @return void
     */
    public function maybe_serve(): void {
        $requested_key = get_query_var( self::QUERY_VAR );

        if ( ! $requested_key ) {
            return;
        }

        $settings   = wp_parse_args( get_option( Utill::VULOPILOT_SETTINGS_KEY, array() ), Utill::VULOPILOT_SETTINGS_DEFAULTS );
        $stored_key = (string) ( $settings['indexnow_api_key'] ?? '' );

        // No stored key yet, or it doesn't match what was requested — force
        // a real 404 rather than a bare `return`. A bare return here left
        // WordPress's main query in its default "matched a rewrite rule but
        // found no content" state, which redirect_canonical() then treated
        // as a page missing a trailing slash and 301-redirected to (landing
        // on the homepage, 200) instead of ever showing a 404 — confirmed
        // via a real request to a 32-hex-char URL that isn't this site's
        // key. Explicitly setting 404 here is what a guessed/stale key file
        // URL should actually do, not confirm the existence of a key that
        // isn't this one.
        if ( '' === $stored_key || ! hash_equals( $stored_key, $requested_key ) ) {
            global $wp_query;
            $wp_query->set_404();
            status_header( 404 );
            return;
        }

        header( 'Content-Type: text/plain; charset=utf-8' );
        echo esc_html( $stored_key );
        exit;
    }

    /**
     * Writes the key straight to a real `/{key}.txt` at the site root —
     * same best-effort semantics as LlmsTxtGenerator::write_file(): a
     * locked-down host where ABSPATH isn't writable still has the setting
     * saved and the virtual route above still serves it correctly, it just
     * doesn't also get a static file.
     *
     * @param string $key The key to write a file for.
     * @return bool True if the file was written.
     */
    public function write_key_file( string $key ): bool {
        if ( '' === $key || ! wp_is_writable( ABSPATH ) ) {
            return false;
        }

        $file_path = trailingslashit( ABSPATH ) . $key . '.txt';

        // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_file_put_contents -- a plain-text key file at the site root, same precedent/reasoning as LlmsTxtGenerator::write_file()'s own ignore comment.
        return false !== file_put_contents( $file_path, $key );
    }

    /**
     * Generates a fresh 32-character lowercase hex key — real
     * cryptographically-suitable randomness (`random_bytes()`), not a
     * client-trusted value; used both by the Instant Indexing tab's
     * `random-input-key-generator` field's own client-side regeneration
     * (which just needs *a* random string, any source) and, more
     * importantly, by Controllers\Settings/the IndexNow REST controller to
     * lazily seed `indexnow_api_key` the first time it's read, the same
     * "empty means not generated yet" precedent `indexnow_api_key`'s own
     * Utill.php comment documents.
     *
     * @return string
     */
    public static function generate_new_key(): string {
        return bin2hex( random_bytes( 16 ) );
    }
}
