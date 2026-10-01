<?php
namespace VuloPilot\Security;

use VuloPilot\Security\LoginAttemptRepository;
use VuloPilot\Utill;
use VuloPilot\Utill\Finding;
use VuloPilot\Utill\Severity;
use VuloPilot\Utill\ScannerUtil;

defined( 'ABSPATH' ) || exit;

/**
 * Turns LoginProtectionGuard's own real login-attempt log (`vulopilot_security_events`
 * (type `login_attempt`)) into real Finding rows.
 *
 * @class       LoginProtectionScanner class
 * @version     1.0.0
 * @author      VuloLabs
 */
class LoginProtectionScanner extends ScannerUtil {

	/**
	 * Real lookback window for "recent" lockouts.
	 *
	 * @var int
	 */
	private const LOOKBACK_DAYS = 7;

	/**
	 * @inheritDoc
	 */
	public function get_id(): string {
		return 'login-protection';
	}

	/**
	 * @inheritDoc
	 */
	public function get_label(): string {
		return __( 'Login Protection', 'vulopilot' );
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

		if ( empty( $settings['enable_login_protection'] ) ) {
			return $findings;
		}

		$threshold  = max( 1, absint( $settings['login_max_attempts'] ) ? absint( $settings['login_max_attempts'] ) : 5 );
		$repository = new LoginAttemptRepository();
		$lockouts   = $repository->get_recent_lockouts( self::LOOKBACK_DAYS, $threshold );

		foreach ( $lockouts as $lockout ) {
			$findings[] = new Finding(
				sprintf(
					/* translators: 1: IP address, 2: number of failed attempts. */
					__( 'IP %1$s was blocked after %2$d failed login attempts', 'vulopilot' ),
					$lockout['ip_address'],
					$lockout['failure_count']
				),
				Severity::MEDIUM,
				$this->get_category(),
				sprintf(
					/* translators: %d is how many days this report covers. */
					__( 'Real login attempts logged by Login Protection in the last %d days. If this wasn\'t you, no action is needed - the attempts were already blocked.', 'vulopilot' ),
					self::LOOKBACK_DAYS
				),
				'ip_address',
				$lockout['ip_address'],
				array(),
				'login-lockout'
			);
		}

		return $findings;
	}
}
