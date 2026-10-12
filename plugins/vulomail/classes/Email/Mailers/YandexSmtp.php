<?php
/**
 * YandexSmtp mailer class file.
 *
 * @package VuloMail
 */

namespace VuloMail\Email\Mailers;

defined( 'ABSPATH' ) || exit;

/**
 * Yandex Mail over SMTP, host and encryption fixed to Yandex's own.
 */
class YandexSmtp extends Smtp {

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
					'host'       => 'smtp.yandex.com',
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
			'label'  => __( 'Yandex Mail', 'vulomail' ),
			'desc'   => __( 'Sends through Yandex Mail\'s SMTP server.', 'vulomail' ),
			'fields' => array(
				array(
					'key'      => 'username',
					'label'    => __( 'Yandex address', 'vulomail' ),
					'type'     => 'text',
					'required' => true,
				),
				array(
					'key'      => 'password',
					'label'    => __( 'App password', 'vulomail' ),
					'type'     => 'password',
					'secret'   => true,
					'required' => true,
					'help'     => __( 'Yandex requires an app password for third-party mail clients. <a href="https://id.yandex.com/security" target="_blank" rel="noopener noreferrer">Create one</a>, under App passwords. New passwords take 2-3 hours to become active.', 'vulomail' ),
				),
			),
		);
	}
}
