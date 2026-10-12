<?php
/**
 * ZohoSmtp mailer class file.
 *
 * @package VuloMail
 */

namespace VuloMail\Email\Mailers;

defined( 'ABSPATH' ) || exit;

/**
 * Zoho Mail over SMTP, host and encryption fixed to Zoho's own.
 */
class ZohoSmtp extends Smtp {

	/**
	 * Constructor.
	 *
	 * @param array         $config  Connection settings, secrets decrypted.
	 * @param mixed         $http    Unused (SMTP makes no HTTP requests); kept for the adapter signature.
	 * @param callable|null $factory Returns a PHPMailer instance.
	 */
	public function __construct( array $config, $http = null, $factory = null ) {
		parent::__construct(
			array_merge(
				$config,
				array(
					'host'       => 'smtp.zoho.com',
					'port'       => 465,
					'encryption' => 'ssl',
					'auth'       => true,
				)
			),
			$http,
			$factory
		);
	}

	/**
	 * Describes the provider and its connection fields.
	 *
	 * @return array
	 */
	public static function definition() {
		return array(
			'label'  => __( 'Zoho Mail', 'vulomail' ),
			'desc'   => __( 'Sends through Zoho Mail\'s SMTP server.', 'vulomail' ),
			'fields' => array(
				array(
					'key'      => 'username',
					'label'    => __( 'Zoho Mail address', 'vulomail' ),
					'type'     => 'text',
					'required' => true,
				),
				array(
					'key'      => 'password',
					'label'    => __( 'Password', 'vulomail' ),
					'type'     => 'password',
					'secret'   => true,
					'required' => true,
					'help'     => __( 'An app-specific password if two-factor authentication is on. <a href="https://accounts.zoho.com/home" target="_blank" rel="noopener noreferrer">Open your Zoho account</a>, under Security → App Passwords.', 'vulomail' ),
				),
			),
		);
	}
}
