<?php
/**
 * Settings REST controller file.
 *
 * @package VuloBackup
 */

namespace VuloBackup\Rest;

use VuloBackup\Backup\Retention;
use VuloBackup\Schedule\Scheduler;
use VuloBackup\Security\Crypto;
use VuloBackup\Settings\Settings as Store;
use VuloBackup\Storage\Vault;
use VuloBackup\Utill;

defined( 'ABSPATH' ) || exit;

/**
 * vulobackup/v1/settings - read and update the settings, set the encryption password, and preview
 * what the retention rule would remove.
 */
class Settings extends Controller {

	/**
	 * Registers this controller's routes.
	 *
	 * @return void
	 */
	public function register_routes() {
		$this->route( '/settings', \WP_REST_Server::READABLE, 'get_items' );
		$this->route( '/settings', \WP_REST_Server::CREATABLE, 'update_item' );
		$this->route( '/settings/encryption', \WP_REST_Server::CREATABLE, 'encryption' );
		$this->route( '/settings/retention', \WP_REST_Server::READABLE, 'retention' );
	}

	/**
	 * Gets every setting, plus what the screen needs to explain them.
	 *
	 * @param \WP_REST_Request|null $request Request.
	 * @return \WP_REST_Response
	 */
	public function get_items( $request = null ) {
		return rest_ensure_response( $this->payload() );
	}

	/**
	 * Merges the posted keys into the stored settings. Accepts a flat `{ key: value }` body, and
	 * the `{ setting }` body of zyra's auto-saving form, whose toggle groups are unpacked here.
	 *
	 * @param \WP_REST_Request $request Request.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function update_item( $request ) {
		$input   = (array) $request->get_json_params();
		$is_form = isset( $input['setting'] ) && is_array( $input['setting'] );
		$input   = $is_form ? $this->from_form_values( $input['setting'] ) : $input;
		$error   = $this->validate( $input );

		if ( $error ) {
			// The settings form shows the message from a normal response; it has no error path.
			return $is_form
				? rest_ensure_response(
					array(
						'success' => false,
						'type'    => 'error',
						'message' => $error->get_error_message(),
					)
				)
				: $error;
		}

		// Encryption is switched on through its own route, which requires a password.
		unset( $input['encrypt'] );

		$before = VuloBackup()->settings->all();
		$after  = VuloBackup()->settings->update( $input );

		Scheduler::settings_changed( $before, $after );

		if ( $before['backup_dir'] !== $after['backup_dir'] ) {
			VuloBackup()->logger->log( 'info', 'settings', __( 'The backup folder was changed. Backups in the previous folder stay there and are no longer listed.', 'vulobackup' ) );
		}

		if ( ! $is_form ) {
			return rest_ensure_response( $this->payload() );
		}

		return rest_ensure_response(
			array(
				'success' => true,
				'message' => $after !== $before ? __( 'Settings saved.', 'vulobackup' ) : '',
			)
		);
	}

	/**
	 * Switches archive encryption on (with a password) or off.
	 *
	 * @param \WP_REST_Request $request Request.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function encryption( $request ) {
		$input    = (array) $request->get_json_params();
		$enable   = ! empty( $input['enabled'] );
		$password = (string) ( $input['password'] ?? '' );

		if ( $enable ) {
			if ( ! Crypto::is_available() ) {
				return new \WP_Error( 'vulobackup_encryption', __( 'This server\'s PHP has no sodium extension, so archives cannot be encrypted here.', 'vulobackup' ), array( 'status' => 400 ) );
			}

			if ( '' === $password && '' === Crypto::stored_password() ) {
				return new \WP_Error( 'vulobackup_encryption', __( 'Enter a password.', 'vulobackup' ), array( 'status' => 400 ) );
			}

			if ( '' !== $password && strlen( $password ) < 12 ) {
				return new \WP_Error( 'vulobackup_encryption', __( 'Use a password of at least 12 characters. It is the only thing protecting the backups.', 'vulobackup' ), array( 'status' => 400 ) );
			}

			if ( '' !== $password ) {
				Crypto::store_password( $password );
			}
		}

		// The stored password is kept when encryption is switched off: backups made with it still
		// need it to be restored.
		VuloBackup()->settings->update( array( 'encrypt' => $enable ) );

		VuloBackup()->logger->log(
			'info',
			'settings',
			$enable ? __( 'Archive encryption was switched on.', 'vulobackup' ) : __( 'Archive encryption was switched off.', 'vulobackup' )
		);

		return rest_ensure_response( $this->payload() );
	}

	/**
	 * Lists what the retention rule would remove right now, without removing it.
	 *
	 * @return \WP_REST_Response
	 */
	public function retention() {
		$plan  = ( new Retention() )->plan();
		$lines = array();

		foreach ( $plan['local'] as $job ) {
			$lines[] = array(
				'name'  => $job['name'],
				'date'  => Utill::format_datetime( $job['created_at'] ),
				'where' => __( 'This server', 'vulobackup' ),
			);
		}

		foreach ( $plan['remote'] as $job ) {
			$lines[] = array(
				'name'  => $job['name'],
				'date'  => Utill::format_datetime( $job['created_at'] ),
				'where' => (string) ( $job['copies'][ $job['destination'] ]['name'] ?? '' ),
			);
		}

		return rest_ensure_response( $lines );
	}

	/**
	 * The settings and their context.
	 *
	 * @return array
	 */
	private function payload() {
		$settings = VuloBackup()->settings->all();
		$vault    = VuloBackup()->vault;

		return array_merge(
			$settings,
			array(
				'encryption_available'    => Crypto::is_available(),
				'encryption_has_password' => '' !== Crypto::stored_password(),
				'backup_dir_in_use'       => $vault->base(),
				'backup_dir_default'      => Vault::default_dir(),
				'backup_dir_public'       => $vault->is_in_web_root(),
				'default_exclusions'      => Store::DEFAULT_EXCLUSIONS,
				'admin_email'             => (string) get_option( 'admin_email' ),
			)
		);
	}

	/**
	 * Checks values that can't simply be sanitized into something valid.
	 *
	 * @param array $input Flat settings.
	 * @return \WP_Error|null
	 */
	private function validate( array $input ) {
		if ( isset( $input['notify_email'] ) && '' !== trim( (string) $input['notify_email'] ) && ! is_email( trim( (string) $input['notify_email'] ) ) ) {
			return new \WP_Error( 'vulobackup_invalid', __( 'The notification address is not a valid email address, so it was not saved.', 'vulobackup' ), array( 'status' => 400 ) );
		}

		if ( isset( $input['backup_dir'] ) && '' !== trim( (string) $input['backup_dir'] ) ) {
			$path = Store::sanitize( 'backup_dir', $input['backup_dir'] );

			if ( VuloBackup()->settings->get( 'backup_dir' ) !== $path ) {
				if ( VuloBackup()->jobs->active() ) {
					return new \WP_Error( 'vulobackup_invalid', __( 'The backup folder cannot be changed while a backup or restore is running.', 'vulobackup' ), array( 'status' => 409 ) );
				}

				$problem = Vault::dir_problem( $path );

				if ( null !== $problem ) {
					return new \WP_Error( 'vulobackup_invalid', $problem . ' ' . __( 'The folder was not changed.', 'vulobackup' ), array( 'status' => 400 ) );
				}
			}
		}

		return null;
	}

	/**
	 * Unpacks settings-form field values into flat settings: a toggle group arrives as
	 * `{ setting_name: { enable: bool }, ... }` under a field key of its own, and the folders to
	 * back up as a list.
	 *
	 * @param array $form Field key => value.
	 * @return array Flat settings.
	 */
	private function from_form_values( array $form ) {
		$defaults = Store::DEFAULTS;
		$flat     = array();

		foreach ( $form as $key => $value ) {
			$key = (string) $key;

			if ( array_key_exists( $key, $defaults ) ) {
				$flat[ $key ] = $value;
			} elseif ( 'areas_group' === $key && is_array( $value ) ) {
				$flat['areas'] = array();

				foreach ( $value as $area => $row ) {
					if ( is_array( $row ) && ! empty( $row['enable'] ) ) {
						$flat['areas'][] = (string) $area;
					}
				}
			} elseif ( is_array( $value ) ) {
				foreach ( $value as $name => $row ) {
					if ( array_key_exists( $name, $defaults ) && is_bool( $defaults[ $name ] ) ) {
						$flat[ $name ] = is_array( $row ) && ! empty( $row['enable'] );
					}
				}
			}
		}

		return $flat;
	}
}
