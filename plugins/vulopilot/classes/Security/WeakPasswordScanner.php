<?php
namespace VuloPilot\Security;

use VuloPilot\Utill;
use VuloPilot\Utill\Finding;
use VuloPilot\Utill\Severity;
use VuloPilot\Utill\ScannerUtil;

defined( 'ABSPATH' ) || exit;

/**
 * Checks every administrator's password hash against a small, fixed dictionary of the most
 * commonly used passwords.
 *
 * @class       WeakPasswordScanner class
 * @version     1.0.0
 * @author      VuloLabs
 */
class WeakPasswordScanner extends ScannerUtil {

	/**
	 * @var string[]
	 */
	private const COMMON_PASSWORDS = array(
		'password',
		'123456',
		'12345678',
		'qwerty',
		'admin',
		'password1',
		'letmein',
		'welcome',
		'monkey',
		'dragon',
	);

	/**
	 * @inheritDoc
	 */
	public function get_id(): string {
		return 'weak-passwords';
	}

	/**
	 * @inheritDoc
	 */
	public function get_label(): string {
		return __( 'Weak Password Detection', 'vulopilot' );
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

		if ( empty( $settings['enable_weak_password_scanner'] ) ) {
			return $findings;
		}

		$administrators = get_users( array( 'role' => 'administrator' ) );

		foreach ( $administrators as $user ) {
			foreach ( self::COMMON_PASSWORDS as $candidate ) {
				if ( ! wp_check_password( $candidate, $user->user_pass, $user->ID ) ) {
					continue;
				}

				$findings[] = new Finding(
					sprintf(
						/* translators: %s is the WordPress username. */
						__( 'Administrator "%s" is using a common, easily guessed password', 'vulopilot' ),
						$user->user_login
					),
					Severity::CRITICAL,
					$this->get_category(),
					__( 'This account\'s password matched an entry in a small dictionary of the most commonly used passwords. Change it immediately and enable two-factor authentication if available.', 'vulopilot' ),
					'user',
					(string) $user->ID
				);

				break;
			}
		}

		return $findings;
	}
}
