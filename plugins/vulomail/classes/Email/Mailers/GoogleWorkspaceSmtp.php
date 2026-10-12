<?php
/**
 * GoogleWorkspaceSmtp mailer class file.
 *
 * @package VuloMail
 */

namespace VuloMail\Email\Mailers;

defined( 'ABSPATH' ) || exit;

/**
 * Google Workspace over SMTP. Workspace mail runs on the same servers as Gmail, so this is GmailSmtp
 * under its own label and connection name - listed separately because Gmail and Google Workspace are
 * two distinct options for the person choosing a provider.
 */
class GoogleWorkspaceSmtp extends GmailSmtp {

	/**
	 * Describes the provider and its connection fields.
	 *
	 * @return array
	 */
	public static function definition() {
		$definition          = parent::definition();
		$definition['label'] = __( 'Google Workspace', 'vulomail' );

		return $definition;
	}
}
