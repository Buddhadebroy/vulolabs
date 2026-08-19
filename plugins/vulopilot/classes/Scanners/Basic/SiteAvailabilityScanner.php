<?php
/**
 * SiteAvailabilityScanner class file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\Scanners\Basic;

use VuloPilot\ValueObjects\Finding;
use VuloPilot\ValueObjects\Severity;

defined( 'ABSPATH' ) || exit;

/**
 * Checks whether the site's own front end is actually reachable — a real
 * `wp_remote_get( home_url() )` from the server's own perspective, not a
 * third-party/external uptime probe (this plugin runs ON the site being
 * checked, so it can only ever observe "can THIS server reach its own
 * front door right now," the same self-check shape RobotsTxtScanner/
 * SitemapScanner already use for their own HTTP requests — see
 * SslMonitoringScanner's docblock for the same category of caveat about
 * what a WordPress-plugin-run scanner can and can't observe).
 *
 * No existing scanner covers "is the homepage reachable at all" —
 * NotFoundScanner tracks individual 404s, SslMonitoringScanner checks
 * certificate validity, neither checks whether a request to the site
 * itself completes and returns successfully. Genuinely new ground,
 * closing that specific gap. Deliberately has no self-throttle
 * (SupportsForceRunInterface) — unlike BrokenLinksScanner's own bounded
 * multi-URL crawl, this is a single lightweight request, cheap enough to
 * run every time scan() is called, same as the vast majority of scanners
 * in this namespace.
 *
 * @class       SiteAvailabilityScanner class
 * @version     1.0.0
 * @author      VuloLabs
 */
class SiteAvailabilityScanner extends AbstractBasicScanner {

    /**
     * How long to wait for the homepage to respond before treating it as
     * unreachable — long enough to tolerate a normal slow page load, short
     * enough that this scanner's own run doesn't hang indefinitely on a
     * genuinely down server.
     */
    private const REQUEST_TIMEOUT_SECONDS = 15;

    /**
     * @inheritDoc
     */
    public function get_id(): string {
        return 'site-availability';
    }

    /**
     * @inheritDoc
     */
    public function get_label(): string {
        return __( 'Website Availability', 'vulopilot' );
    }

    /**
     * @inheritDoc
     */
    public function get_category(): string {
        return 'availability';
    }

    /**
     * @inheritDoc
     */
    public function scan(): array {
        $url = home_url( '/' );

        $response = wp_remote_get(
            $url,
            array(
                'timeout'     => self::REQUEST_TIMEOUT_SECONDS,
                'redirection' => 5,
                'sslverify'   => false, // A cert problem is SslMonitoringScanner's own finding, not "site unreachable" — don't fail this check on that basis.
            )
        );

        if ( is_wp_error( $response ) ) {
            return array(
                new Finding(
                    __( 'Website is unreachable', 'vulopilot' ),
                    Severity::CRITICAL,
                    $this->get_category(),
                    sprintf(
                        /* translators: %s is the underlying connection error message. */
                        __( 'A request to the homepage failed: %s', 'vulopilot' ),
                        $response->get_error_message()
                    ),
                    'url',
                    $url,
                    array( 'reason' => 'unreachable' )
                ),
            );
        }

        $status_code = (int) wp_remote_retrieve_response_code( $response );

        if ( $status_code >= 500 ) {
            return array(
                new Finding(
                    sprintf(
                        /* translators: %d is the HTTP status code the homepage returned. */
                        __( 'Website is returning server errors (HTTP %d)', 'vulopilot' ),
                        $status_code
                    ),
                    Severity::CRITICAL,
                    $this->get_category(),
                    __( 'The homepage responded with a server error instead of loading successfully — visitors are likely seeing this too.', 'vulopilot' ),
                    'url',
                    $url,
                    array(
                        'reason'      => 'server-error',
                        'status_code' => $status_code,
                    )
                ),
            );
        }

        if ( $status_code < 200 || $status_code >= 400 ) {
            return array(
                new Finding(
                    sprintf(
                        /* translators: %d is the HTTP status code the homepage returned. */
                        __( 'Website homepage returned an unexpected status (HTTP %d)', 'vulopilot' ),
                        $status_code
                    ),
                    Severity::HIGH,
                    $this->get_category(),
                    __( 'The homepage did not return a normal success response — worth checking manually.', 'vulopilot' ),
                    'url',
                    $url,
                    array(
                        'reason'      => 'unexpected-status',
                        'status_code' => $status_code,
                    )
                ),
            );
        }

        return array();
    }
}
