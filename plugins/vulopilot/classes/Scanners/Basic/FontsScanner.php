<?php
/**
 * FontsScanner class file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\Scanners\Basic;

use VuloPilot\ValueObjects\Finding;
use VuloPilot\ValueObjects\Severity;

defined( 'ABSPATH' ) || exit;

/**
 * Flags externally-hosted Google Fonts on the homepage — same
 * `wp_remote_get(home_url())` homepage-inspection approach
 * CacheDetectionScanner already uses, just checking for
 * fonts.googleapis.com/fonts.gstatic.com references instead of caching
 * headers. Self-hosting web fonts (or at minimum using `font-display:
 * swap`) avoids the extra DNS/connection round trip to a third-party host
 * and the render-blocking behavior default Google Fonts embeds have.
 *
 * @class       FontsScanner class
 * @version     1.0.0
 * @author      VuloLabs
 */
class FontsScanner extends AbstractBasicScanner {

    private const REQUEST_TIMEOUT_SECONDS = 8;

    private const GOOGLE_FONTS_HOSTS = array( 'fonts.googleapis.com', 'fonts.gstatic.com' );

    /**
     * @inheritDoc
     */
    public function get_id(): string {
        return 'fonts';
    }

    /**
     * @inheritDoc
     */
    public function get_label(): string {
        return __( 'Fonts', 'vulopilot' );
    }

    /**
     * @inheritDoc
     */
    public function get_category(): string {
        return 'performance';
    }

    /**
     * @inheritDoc
     */
    public function scan(): array {
        $response = wp_remote_get(
            home_url( '/' ),
            array(
                'timeout'   => self::REQUEST_TIMEOUT_SECONDS,
                'sslverify' => false,
            )
        );

        if ( is_wp_error( $response ) ) {
            return array();
        }

        $html = wp_remote_retrieve_body( $response );

        foreach ( self::GOOGLE_FONTS_HOSTS as $host ) {
            if ( false !== strpos( $html, $host ) ) {
                return array(
                    new Finding(
                        __( 'Externally-hosted web fonts detected', 'vulopilot' ),
                        Severity::LOW,
                        $this->get_category(),
                        __( 'The homepage loads fonts from Google Fonts\' own servers. Self-hosting web fonts (or adding font-display: swap) avoids an extra third-party connection and can prevent invisible-text flashes while fonts load.', 'vulopilot' ),
                        'url',
                        home_url( '/' ),
                        array(
                            'recommended_fix' => array(
                                __( 'Host Google Fonts locally instead of loading them from fonts.googleapis.com/fonts.gstatic.com.', 'vulopilot' ),
                                __( 'Use a plugin (e.g. OMGF) to automatically download and self-host your fonts.', 'vulopilot' ),
                                __( 'Limit the number of font weights/styles you load to only what\'s actually used.', 'vulopilot' ),
                                __( 'Add font-display: swap so text stays visible while fonts load.', 'vulopilot' ),
                            ),
                        )
                    ),
                );
            }
        }

        return array();
    }
}
