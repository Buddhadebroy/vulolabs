<?php
/**
 * CoreFileIntegrityScanner class file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\Scanners\Basic;

use VuloPilot\ValueObjects\Finding;
use VuloPilot\ValueObjects\Severity;
use VuloPilot\Utill;

defined( 'ABSPATH' ) || exit;

/**
 * "File Changes" (readme's Free feature list) for WordPress core files —
 * uses core's own `get_core_checksums()` (the same official,
 * api.wordpress.org-published md5 list `wp core verify-checksums`/Site
 * Health's own core-file check use), so this never invents its own
 * checksum source or bundles a stale one. Deliberately core-only, not
 * plugins/themes: core ships an authoritative published baseline to diff
 * against; there's no equivalent public baseline for third-party
 * plugin/theme files, which is exactly the gap vulopilot-pro's own
 * "Integrity Monitoring" (IntegrityMonitoringScanner, a locally-maintained
 * baseline/diff instead of an external published one) closes.
 *
 * Only flags modified/missing files — the same two states core's own
 * checksum verification reports; it does not detect unexpected *added*
 * files, since the checksums list only enumerates files that are supposed
 * to exist, not every file that shouldn't.
 *
 * @class       CoreFileIntegrityScanner class
 * @version     1.0.0
 * @author      VuloLabs
 */
class CoreFileIntegrityScanner extends AbstractBasicScanner {

    /**
     * @inheritDoc
     */
    public function get_id(): string {
        return 'core-file-integrity';
    }

    /**
     * @inheritDoc
     */
    public function get_label(): string {
        return __( 'File Changes', 'vulopilot' );
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

        if ( empty( $settings['enable_core_file_integrity_scanner'] ) ) {
            return $findings;
        }

        if ( ! function_exists( 'get_core_checksums' ) ) {
            require_once ABSPATH . 'wp-admin/includes/update.php';
        }

        global $wp_version;

        $checksums = get_core_checksums( $wp_version, get_locale() );

        // api.wordpress.org unreachable, or this version/locale combination
        // isn't published (e.g. a nightly/custom build) — nothing reliable
        // to diff against, so report no findings rather than false positives.
        if ( ! is_array( $checksums ) ) {
            return $findings;
        }

        foreach ( $checksums as $relative_path => $expected_md5 ) {
            $absolute_path = ABSPATH . $relative_path;

            if ( ! file_exists( $absolute_path ) ) {
                $findings[] = new Finding(
                    sprintf(
                        /* translators: %s is the missing core file's path. */
                        __( 'Core file is missing: %s', 'vulopilot' ),
                        $relative_path
                    ),
                    Severity::HIGH,
                    $this->get_category(),
                    __( 'This file ships with WordPress core and normally exists on every install. A missing core file can break functionality or indicate tampering — reinstall core from the official source.', 'vulopilot' ),
                    'core',
                    $relative_path
                );

                continue;
            }

            if ( md5_file( $absolute_path ) !== $expected_md5 ) {
                $findings[] = new Finding(
                    sprintf(
                        /* translators: %s is the modified core file's path. */
                        __( 'Core file has been modified: %s', 'vulopilot' ),
                        $relative_path
                    ),
                    Severity::HIGH,
                    $this->get_category(),
                    __( 'This file\'s contents no longer match the official WordPress release for this version — either a manual edit or a sign of compromise. Compare it against a fresh core download.', 'vulopilot' ),
                    'core',
                    $relative_path
                );
            }
        }

        return $findings;
    }
}
