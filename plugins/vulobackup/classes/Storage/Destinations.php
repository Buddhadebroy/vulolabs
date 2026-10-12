<?php
/**
 * Destinations class file.
 *
 * @package VuloBackup
 */

namespace VuloBackup\Storage;

use VuloBackup\Security\Secrets;
use VuloBackup\Utill;

defined( 'ABSPATH' ) || exit;

/**
 * The remote places copies of backups are sent to, and the providers that can reach them.
 *
 * Secret fields (passwords, secret keys, private keys) are encrypted before they are saved and are
 * never sent back to the browser: the admin screen only learns whether one is set.
 */
class Destinations {

	const MAX = 5;

	/**
	 * Encryption for stored credentials.
	 *
	 * @var Secrets
	 */
	private $secrets;

	/**
	 * Providers by id, once built.
	 *
	 * @var Provider[]|null
	 */
	private $providers = null;

	/**
	 * Constructor.
	 *
	 * @param Secrets $secrets Encryption for stored credentials.
	 */
	public function __construct( Secrets $secrets ) {
		$this->secrets = $secrets;
	}

	/**
	 * Returns the registered providers, keyed by id.
	 *
	 * @return Provider[] Providers by id.
	 */
	public function providers() {
		if ( null === $this->providers ) {
			$this->providers = array();

			/**
			 * Filters the remote storage providers.
			 *
			 * @param Provider[] $providers Objects implementing VuloBackup\Storage\Provider.
			 */
			$list = (array) apply_filters( 'vulobackup_storage_providers', array( new Providers\S3(), new Providers\Sftp() ) );

			foreach ( $list as $provider ) {
				if ( $provider instanceof Provider ) {
					$this->providers[ $provider->id() ] = $provider;
				}
			}
		}

		return $this->providers;
	}

	/**
	 * Returns a provider by id.
	 *
	 * @param string $id Provider id.
	 * @return Provider|null
	 */
	public function provider( $id ) {
		$providers = $this->providers();

		return $providers[ $id ] ?? null;
	}

	/**
	 * Provider definitions for the admin screen.
	 *
	 * @return array[]
	 */
	public function definitions() {
		$definitions = array();

		foreach ( $this->providers() as $provider ) {
			$definitions[] = array(
				'id'     => $provider->id(),
				'label'  => $provider->label(),
				'fields' => $provider->fields(),
			);
		}

		return $definitions;
	}

	/**
	 * Every stored destination with its configuration decrypted. For server-side use only.
	 *
	 * @return array[] By id.
	 */
	public function all() {
		$stored = get_option( Utill::DESTINATIONS_KEY, array() );
		$result = array();

		foreach ( is_array( $stored ) ? $stored : array() as $destination ) {
			$provider = is_array( $destination ) ? $this->provider( (string) ( $destination['provider'] ?? '' ) ) : null;

			if ( ! $provider || empty( $destination['id'] ) ) {
				continue;
			}

			$config = is_array( $destination['config'] ?? null ) ? $destination['config'] : array();

			foreach ( $provider->fields() as $field ) {
				if ( ! empty( $field['secret'] ) && isset( $config[ $field['key'] ] ) ) {
					$config[ $field['key'] ] = $this->secrets->decrypt( (string) $config[ $field['key'] ] );
				}
			}

			$destination['config']        = $config;
			$result[ $destination['id'] ] = $destination;
		}

		return $result;
	}

	/**
	 * Returns a stored destination by id.
	 *
	 * @param string $id Destination id.
	 * @return array|null
	 */
	public function get( $id ) {
		$all = $this->all();

		return $all[ $id ] ?? null;
	}

	/**
	 * Destinations that new backups are copied to.
	 *
	 * @return array[] By id.
	 */
	public function enabled() {
		return array_filter(
			$this->all(),
			static function ( $destination ) {
				return ! empty( $destination['enabled'] );
			}
		);
	}

	/**
	 * A destination as the browser may see it: no secret values.
	 *
	 * @param array $destination Destination from all().
	 * @return array
	 */
	public function for_browser( array $destination ) {
		$provider = $this->provider( $destination['provider'] );
		$config   = array();
		$has      = array();

		foreach ( $provider ? $provider->fields() : array() as $field ) {
			$value = $destination['config'][ $field['key'] ] ?? ( $field['default'] ?? '' );

			if ( ! empty( $field['secret'] ) ) {
				$has[ $field['key'] ] = '' !== (string) $value;
				continue;
			}

			$config[ $field['key'] ] = $value;
		}

		return array(
			'id'          => $destination['id'],
			'provider'    => $destination['provider'],
			'label'       => $provider ? $provider->label() : $destination['provider'],
			'name'        => (string) ( $destination['name'] ?? '' ),
			'enabled'     => ! empty( $destination['enabled'] ),
			'config'      => $config,
			'has_secret'  => $has,
			'where'       => $provider ? $provider->describe( $destination['config'] ) : '',
			'fingerprint' => (string) ( $destination['config']['fingerprint'] ?? '' ),
			'checked_at'  => Utill::format_datetime( (string) ( $destination['checked_at'] ?? '' ) ),
			'ok'          => ! empty( $destination['ok'] ),
			'message'     => (string) ( $destination['message'] ?? '' ),
		);
	}

	/**
	 * Tests a destination and, only if the test passes, saves it.
	 *
	 * @param array $input `id` (to update one), `provider`, `name`, `enabled` and `config`. A secret
	 *                     field left empty keeps the stored value.
	 * @return array|\WP_Error The saved destination, as for_browser().
	 */
	public function save( array $input ) {
		$all      = $this->all();
		$id       = sanitize_key( (string) ( $input['id'] ?? '' ) );
		$existing = '' !== $id && isset( $all[ $id ] ) ? $all[ $id ] : null;
		$provider = $this->provider( $existing ? $existing['provider'] : sanitize_key( (string) ( $input['provider'] ?? '' ) ) );

		if ( ! $provider ) {
			return new \WP_Error( 'vulobackup_storage_config', __( 'Choose where the backups should be sent.', 'vulobackup' ), array( 'status' => 400 ) );
		}

		if ( ! $existing && count( $all ) >= self::MAX ) {
			return new \WP_Error( 'vulobackup_storage_config', __( 'There is room for five destinations. Remove one to add another.', 'vulobackup' ), array( 'status' => 400 ) );
		}

		$raw    = is_array( $input['config'] ?? null ) ? $input['config'] : array();
		$config = array();

		foreach ( $provider->fields() as $field ) {
			$key   = $field['key'];
			$value = $raw[ $key ] ?? null;

			if ( 'toggle' === $field['type'] ) {
				$config[ $key ] = null === $value ? ! empty( $field['default'] ) : ! empty( $value );
			} elseif ( 'number' === $field['type'] ) {
				$config[ $key ] = null === $value || '' === $value ? (int) ( $field['default'] ?? 0 ) : (int) $value;
			} elseif ( ! empty( $field['secret'] ) ) {
				// Keys and passwords are kept exactly as typed, apart from the line endings of a pasted key.
				$value          = is_string( $value ) ? str_replace( "\r", '', $value ) : '';
				$config[ $key ] = '' !== $value ? $value : (string) ( $existing['config'][ $key ] ?? '' );
			} else {
				$config[ $key ] = null === $value ? (string) ( $field['default'] ?? '' ) : trim( sanitize_text_field( (string) $value ) );
			}
		}

		VuloBackup()->logger->hide( $this->secret_values( $provider, $config ) );

		$tested = $provider->test( $config );

		if ( is_wp_error( $tested ) ) {
			return new \WP_Error( $tested->get_error_code(), $tested->get_error_message(), array( 'status' => 400 ) );
		}

		$destination = array(
			'id'         => $existing ? $existing['id'] : 'd' . bin2hex( random_bytes( 5 ) ),
			'provider'   => $provider->id(),
			'name'       => substr( sanitize_text_field( (string) ( $input['name'] ?? ( $existing['name'] ?? '' ) ) ), 0, 80 ),
			'enabled'    => isset( $input['enabled'] ) ? ! empty( $input['enabled'] ) : ( $existing ? ! empty( $existing['enabled'] ) : true ),
			'config'     => array_merge( $config, $tested ),
			'checked_at' => Utill::now(),
			'ok'         => true,
			'message'    => '',
		);

		$all[ $destination['id'] ] = $destination;

		$this->write( $all );

		return $this->for_browser( $destination );
	}

	/**
	 * Switches a destination on or off without testing it.
	 *
	 * @param string $id      Destination id.
	 * @param bool   $enabled Whether new backups are copied to it.
	 * @return bool
	 */
	public function set_enabled( $id, $enabled ) {
		$all = $this->all();

		if ( ! isset( $all[ $id ] ) ) {
			return false;
		}

		$all[ $id ]['enabled'] = (bool) $enabled;

		$this->write( $all );

		return true;
	}

	/**
	 * Tests a stored destination again and records the result.
	 *
	 * @param string $id Destination id.
	 * @return array|\WP_Error The destination, as for_browser().
	 */
	public function retest( $id ) {
		$all = $this->all();

		if ( ! isset( $all[ $id ] ) ) {
			return new \WP_Error( 'vulobackup_not_found', __( 'That destination no longer exists.', 'vulobackup' ), array( 'status' => 404 ) );
		}

		$provider = $this->provider( $all[ $id ]['provider'] );

		VuloBackup()->logger->hide( $this->secret_values( $provider, $all[ $id ]['config'] ) );

		$tested = $provider->test( $all[ $id ]['config'] );

		$all[ $id ]['checked_at'] = Utill::now();
		$all[ $id ]['ok']         = ! is_wp_error( $tested );
		$all[ $id ]['message']    = is_wp_error( $tested ) ? $tested->get_error_message() : '';

		if ( ! is_wp_error( $tested ) ) {
			$all[ $id ]['config'] = array_merge( $all[ $id ]['config'], $tested );
		}

		$this->write( $all );

		return $this->for_browser( $all[ $id ] );
	}

	/**
	 * Records the outcome of using a destination during a backup.
	 *
	 * @param string $id      Destination id.
	 * @param bool   $ok      Whether it worked.
	 * @param string $message Error to show, when it did not.
	 * @return void
	 */
	public function mark( $id, $ok, $message = '' ) {
		$all = $this->all();

		if ( isset( $all[ $id ] ) ) {
			$all[ $id ]['checked_at'] = Utill::now();
			$all[ $id ]['ok']         = (bool) $ok;
			$all[ $id ]['message']    = (string) $message;

			$this->write( $all );
		}
	}

	/**
	 * Forgets a destination. Backups already sent there are left where they are.
	 *
	 * @param string $id Destination id.
	 * @return bool
	 */
	public function delete( $id ) {
		$all = $this->all();

		if ( ! isset( $all[ $id ] ) ) {
			return false;
		}

		unset( $all[ $id ] );

		$this->write( $all );

		return true;
	}

	/**
	 * The secret values of a configuration, for the logger to hide.
	 *
	 * @param Provider|null $provider Provider.
	 * @param array         $config   Field values.
	 * @return string[]
	 */
	public function secret_values( $provider, array $config ) {
		$values = array();

		foreach ( $provider ? $provider->fields() : array() as $field ) {
			if ( ! empty( $field['secret'] ) && '' !== (string) ( $config[ $field['key'] ] ?? '' ) ) {
				$values[] = (string) $config[ $field['key'] ];
			}
		}

		return $values;
	}

	/**
	 * Where one file of a backup lives at a destination.
	 *
	 * @param string $backup_id Backup identifier.
	 * @param string $name      File name.
	 * @return string
	 */
	public static function remote_name( $backup_id, $name ) {
		return $backup_id . '/' . $name;
	}

	/**
	 * Encrypts the secret fields and stores every destination.
	 *
	 * @param array[] $destinations Destinations with plain configurations.
	 * @return void
	 */
	private function write( array $destinations ) {
		$stored = array();

		foreach ( $destinations as $destination ) {
			$provider = $this->provider( $destination['provider'] );

			foreach ( $provider ? $provider->fields() : array() as $field ) {
				if ( ! empty( $field['secret'] ) ) {
					$destination['config'][ $field['key'] ] = $this->secrets->encrypt( (string) ( $destination['config'][ $field['key'] ] ?? '' ) );
				}
			}

			$stored[] = $destination;
		}

		update_option( Utill::DESTINATIONS_KEY, $stored, false );
	}
}
