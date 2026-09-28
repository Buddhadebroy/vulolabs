<?php
namespace VuloPilot\Security;

use VuloPilot\Security\FirewallBlockRepository;
use VuloPilot\Utill;
use VuloPilot\Utill\ServerRequest;

defined( 'ABSPATH' ) || exit;

/**
 * Real, always-on request-time pattern blocking - Protect My Site's "Firewall" tile.
 *
 * @class       FirewallGuard class
 * @version     1.0.0
 * @author      VuloLabs
 */
class FirewallGuard {

	/**
	 * Pattern => human-readable rule name, checked against the decoded request URI + raw
	 * query string.
	 *
	 * @var array<string, string>
	 */
	private const RULES = array(
		'/union\s+select/i'                       => 'sql-injection',
		'/information_schema/i'                   => 'sql-injection',
		"/'\\s*or\\s*'?1'?\\s*=\\s*'?1/i"         => 'sql-injection',
		'/\.\.\/\.\.\//'                          => 'path-traversal',
		'/wp-content\/uploads\/.*\.(php|phtml)/i' => 'uploads-php-execution',
		'/%00/i'                                  => 'null-byte-injection',
	);

	/**
	 * FirewallGuard constructor.
	 */
	public function __construct() {
		add_action( 'init', array( $this, 'inspect_request' ), 1 );
	}

	/**
	 * `init` callback (priority 1) - checked on every real front-end/admin
	 * request.
	 *
	 * @return void
	 */
	public function inspect_request(): void {
		$settings = wp_parse_args( get_option( Utill::VULOPILOT_SETTINGS_KEY, array() ), Utill::VULOPILOT_SETTINGS_DEFAULTS );

		if ( empty( $settings['enable_firewall'] ) ) {
			return;
		}

		$request_uri = ServerRequest::get( 'REQUEST_URI' );

		if ( '' === $request_uri ) {
			return;
		}

		$decoded_uri = rawurldecode( $request_uri );

		foreach ( self::RULES as $pattern => $rule_name ) {
			if ( ! preg_match( $pattern, $decoded_uri ) ) {
				continue;
			}

			$blocking_on = ! empty( $settings['enable_firewall_blocking'] );

			( new FirewallBlockRepository() )->insert(
				array(
					'ip_address'   => ServerRequest::client_ip(),
					'request_uri'  => $request_uri,
					'rule_matched' => $rule_name,
					'action'       => $blocking_on ? 'blocked' : 'logged',
					'created_at'   => current_time( 'mysql' ),
				)
			);

			if ( $blocking_on ) {
				nocache_headers();
				status_header( 403 );
				wp_die(
					esc_html__( 'Request blocked.', 'vulopilot' ),
					esc_html__( 'Forbidden', 'vulopilot' ),
					array( 'response' => 403 )
				);
			}

			// One matched rule is enough to act on - no need to keep
			// checking the remaining rules against this same request.
			return;
		}
	}
}
