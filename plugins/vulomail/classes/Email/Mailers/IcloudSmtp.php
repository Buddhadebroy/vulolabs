<?php
/**
 * IcloudSmtp mailer class file.
 *
 * @package VuloMail
 */

namespace VuloMail\Email\Mailers;

defined( 'ABSPATH' ) || exit;

/**
 * Apple's iCloud Mail over SMTP, host and encryption fixed to Apple's own.
 */
class IcloudSmtp extends Smtp {

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
					'host'       => 'smtp.mail.me.com',
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
			'label'  => __( 'iCloud Mail', 'vulomail' ),
			'desc'   => __( 'Sends through Apple\'s iCloud Mail SMTP server.', 'vulomail' ),
			'fields' => array(
				array(
					'key'      => 'username',
					'label'    => __( 'iCloud address', 'vulomail' ),
					'type'     => 'text',
					'required' => true,
				),
				array(
					'key'      => 'password',
					'label'    => __( 'App-specific password', 'vulomail' ),
					'type'     => 'password',
					'secret'   => true,
					'required' => true,
					'help'     => __( 'Your normal Apple ID password will not work here. <a href="https://appleid.apple.com" target="_blank" rel="noopener noreferrer">Generate an app-specific password</a>, under Sign-In and Security.', 'vulomail' ),
				),
			),
		);
	}
}
