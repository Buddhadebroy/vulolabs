<?php
/**
 * AmazonWorkmailSmtp mailer class file.
 *
 * @package VuloMail
 */

namespace VuloMail\Email\Mailers;

defined( 'ABSPATH' ) || exit;

/**
 * Amazon WorkMail over SMTP.
 */
class AmazonWorkmailSmtp extends Smtp {

	/**
	 * Constructor.
	 *
	 * @param array         $config  Connection settings, secrets decrypted.
	 * @param mixed         $http    Unused (SMTP makes no HTTP requests); kept for the adapter signature.
	 * @param callable|null $factory Returns a PHPMailer instance.
	 */
	public function __construct( array $config, $http = null, $factory = null ) {
		$region = preg_match( '/^[a-z0-9-]+$/', (string) ( $config['region'] ?? '' ) ) ? $config['region'] : 'us-east-1';

		parent::__construct(
			array_merge(
				$config,
				array(
					'host'       => "smtp.mail.{$region}.awsapps.com",
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
			'label'  => __( 'Amazon WorkMail', 'vulomail' ),
			'desc'   => __( 'Sends through Amazon WorkMail\'s SMTP server.', 'vulomail' ),
			'fields' => array(
				array(
					'key'      => 'region',
					'label'    => __( 'AWS region', 'vulomail' ),
					'type'     => 'text',
					'default'  => 'us-east-1',
					'required' => true,
					'help'     => __( 'Must match the region your WorkMail organization is in. <a href="https://console.aws.amazon.com/workmail/home" target="_blank" rel="noopener noreferrer">Open the WorkMail console</a>.', 'vulomail' ),
				),
				array(
					'key'      => 'username',
					'label'    => __( 'WorkMail address', 'vulomail' ),
					'type'     => 'text',
					'required' => true,
				),
				array(
					'key'      => 'password',
					'label'    => __( 'Password', 'vulomail' ),
					'type'     => 'password',
					'secret'   => true,
					'required' => true,
				),
			),
		);
	}
}
