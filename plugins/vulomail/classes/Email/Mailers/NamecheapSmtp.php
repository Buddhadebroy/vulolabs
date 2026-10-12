<?php
/**
 * NamecheapSmtp mailer class file.
 *
 * @package VuloMail
 */

namespace VuloMail\Email\Mailers;

defined( 'ABSPATH' ) || exit;

/**
 * Namecheap Private Email over SMTP, host and encryption fixed to Namecheap's own.
 */
class NamecheapSmtp extends Smtp {

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
					'host'       => 'mail.privateemail.com',
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
			'label'  => __( 'Namecheap Private Email', 'vulomail' ),
			'desc'   => __( 'Sends through Namecheap Private Email\'s SMTP server.', 'vulomail' ),
			'fields' => array(
				array(
					'key'      => 'username',
					'label'    => __( 'Private Email address', 'vulomail' ),
					'type'     => 'text',
					'required' => true,
				),
				array(
					'key'      => 'password',
					'label'    => __( 'Password', 'vulomail' ),
					'type'     => 'password',
					'secret'   => true,
					'required' => true,
					'help'     => __( 'Your Private Email mailbox password. <a href="https://privateemail.com" target="_blank" rel="noopener noreferrer">Manage your mailbox</a>.', 'vulomail' ),
				),
			),
		);
	}
}
