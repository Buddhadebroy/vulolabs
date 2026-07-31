<?php
/**
 * BasicVulnerabilitiesScanner class file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\Scanners\Basic;

use VuloPilot\ValueObjects\Finding;
use VuloPilot\ValueObjects\Severity;
use VuloPilot\Utill;

defined( 'ABSPATH' ) || exit;

/**
 * Three deterministic, zero-cost-to-verify hardening checks that make a
 * site an easier target once *any* vulnerability is known — distinct from
 * UpdatesScanner (which flags "a newer version exists", not exposure) and
 * from vulopilot-pro's SecurityMonitoring scanners (admin username,
 * anonymous REST enumeration, file editor, debug mode, xmlrpc, headers,
 * exposed files) — none of those three checks below overlap with any of
 * this scanner's checks. "Basic" (readme's Free feature name) because each
 * check is a single anonymous HTTP request or a local option read, same
 * scope as this module's own AbstractBasicScanner siblings; Pro's "Advanced
 * Vulnerabilities" (AdvancedVulnerabilitiesScanner, vulopilot-pro) is what
 * matches installed plugin *versions* against known CVEs — a different,
 * deeper kind of check this one doesn't attempt.
 *
 * @class       BasicVulnerabilitiesScanner class
 * @version     1.0.0
 * @author      VuloLabs
 */
class BasicVulnerabilitiesScanner extends AbstractBasicScanner {

    private const REQUEST_TIMEOUT_SECONDS = 10;

    /**
     * @inheritDoc
     */
    public function get_id(): string {
        return 'basic-vulnerabilities';
    }

    /**
     * @inheritDoc
     */
    public function get_label(): string {
        return __( 'Basic Vulnerabilities', 'vulopilot' );
    }

    /**
     * @inheritDoc
     */
    public function get_category(): string {
        return 'security';
    }

    /**
     * @inheritDoc
     */
    public function scan(): array {
        $findings = array();

        $settings = wp_parse_args( get_option( Utill::VULOPILOT_SETTINGS_KEY, array() ), Utill::VULOPILOT_SETTINGS_DEFAULTS );

        if ( empty( $settings['enable_basic_vulnerabilities_scanner'] ) ) {
            return $findings;
        }

        $generator_finding = $this->check_generator_meta_tag();
        if ( $generator_finding ) {
            $findings[] = $generator_finding;
        }

        $readme_finding = $this->check_readme_exposed();
        if ( $readme_finding ) {
            $findings[] = $readme_finding;
        }

        $prefix_finding = $this->check_default_table_prefix();
        if ( $prefix_finding ) {
            $findings[] = $prefix_finding;
        }

        return $findings;
    }

    /**
     * The homepage's own `<meta name="generator">` tag advertises the
     * exact WordPress core version to anyone viewing the page source —
     * makes it trivial for automated tooling to target known
     * version-specific vulnerabilities without even needing readme.html.
     *
     * @return Finding|null
     */
    private function check_generator_meta_tag(): ?Finding {
        $url = home_url( '/' );

        $response = wp_remote_get(
            $url,
            array(
                'timeout'   => self::REQUEST_TIMEOUT_SECONDS,
                'sslverify' => false,
            )
        );

        if ( is_wp_error( $response ) || 200 !== wp_remote_retrieve_response_code( $response ) ) {
            return null;
        }

        $body = wp_remote_retrieve_body( $response );

        if ( ! preg_match( '/<meta\s+name=["\']generator["\']\s+content=["\']WordPress\s/i', $body ) ) {
            return null;
        }

        return new Finding(
            __( 'WordPress version is exposed in the homepage\'s generator tag', 'vulopilot' ),
            Severity::MEDIUM,
            $this->get_category(),
            __( 'The homepage\'s HTML includes a generator meta tag naming the exact WordPress version, making it easier for automated scanners to target version-specific vulnerabilities. Remove it via the `wp_head` "wp_generator" callback.', 'vulopilot' ),
            'url',
            $url
        );
    }

    /**
     * The bundled `readme.html` at the site root also reveals the exact
     * core version (its "Version X.Y" line), independent of the generator
     * meta tag — a site that removed the tag but left this file in place
     * is still exposed.
     *
     * @return Finding|null
     */
    private function check_readme_exposed(): ?Finding {
        $url = home_url( '/readme.html' );

        $response = wp_remote_get(
            $url,
            array(
                'timeout'   => self::REQUEST_TIMEOUT_SECONDS,
                'sslverify' => false,
            )
        );

        if ( is_wp_error( $response ) || 200 !== wp_remote_retrieve_response_code( $response ) ) {
            return null;
        }

        if ( false === stripos( wp_remote_retrieve_body( $response ), 'WordPress' ) ) {
            return null;
        }

        return new Finding(
            __( 'The default readme.html file is publicly accessible', 'vulopilot' ),
            Severity::LOW,
            $this->get_category(),
            __( 'This file ships with WordPress core and reveals the installed version. Delete it or block direct access to it.', 'vulopilot' ),
            'url',
            $url
        );
    }

    /**
     * A table prefix left at the WordPress default (`wp_`) makes certain
     * classes of SQL-injection attack marginally easier to write, since the
     * attacker doesn't need to first discover the prefix.
     *
     * @return Finding|null
     */
    private function check_default_table_prefix(): ?Finding {
        global $wpdb;

        if ( 'wp_' !== $wpdb->prefix ) {
            return null;
        }

        return new Finding(
            __( 'Database table prefix is the WordPress default ("wp_")', 'vulopilot' ),
            Severity::LOW,
            $this->get_category(),
            __( 'A non-default table prefix is a small extra hurdle against certain automated SQL-injection attempts. Changing it on an existing site requires a careful, backed-up migration — this is a hardening note, not something to change casually.', 'vulopilot' ),
            'table',
            $wpdb->prefix
        );
    }
}
