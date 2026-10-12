<?php
/**
 * Microsoft365Smtp mailer class file.
 *
 * @package VuloMail
 */

namespace VuloMail\Email\Mailers;

defined( 'ABSPATH' ) || exit;

/**
 * Microsoft 365 / Office 365 business mail over SMTP, host and encryption fixed to Microsoft's own.
 */
class Microsoft365Smtp extends Smtp {

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
					'host'       => 'smtp.office365.com',
					'port'       => 587,
					'encryption' => 'tls',
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
			'label'  => __( 'Microsoft 365', 'vulomail' ),
			'desc'   => __( 'Sends through Microsoft 365\'s business SMTP server.', 'vulomail' ),
			'fields' => array(
				array(
					'key'      => 'username',
					'label'    => __( 'Microsoft 365 address', 'vulomail' ),
					'type'     => 'text',
					'required' => true,
				),
				array(
					'key'      => 'password',
					'label'    => __( 'Password', 'vulomail' ),
					'type'     => 'password',
					'secret'   => true,
					'required' => true,
					'help'     => __( 'An app password if multi-factor authentication is on; your admin must also allow it and allow SMTP AUTH. <a href="https://mysignins.microsoft.com/security-info" target="_blank" rel="noopener noreferrer">Manage sign-in security</a>, under Add method → App password.', 'vulomail' ),
				),
			),
		);
	}
}
