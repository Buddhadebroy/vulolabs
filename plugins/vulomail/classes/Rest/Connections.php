<?php
/**
 * Connections REST controller file.
 *
 * @package VuloMail
 */

namespace VuloMail\Rest;

defined( 'ABSPATH' ) || exit;

/**
 * REST controller for vulomail/v1/connections - list, create/update and delete. Responses never
 * contain a credential: secret fields come back masked.
 */
class Connections extends Controller {

	/**
	 * REST base for this controller.
	 *
	 * @var string
	 */
	protected $rest_base = 'connections';

	/**
	 * Registers this controller's routes.
	 *
	 * @return void
	 */
	public function register_routes() {
		register_rest_route(
			VuloMail()->rest_namespace,
			'/' . $this->rest_base,
			array(
				array(
					'methods'             => \WP_REST_Server::READABLE,
					'callback'            => array( $this, 'get_items' ),
					'permission_callback' => array( $this, 'check_permission' ),
				),
				array(
					'methods'             => \WP_REST_Server::CREATABLE,
					'callback'            => array( $this, 'save_item' ),
					'permission_callback' => array( $this, 'check_permission' ),
				),
			)
		);

		register_rest_route(
			VuloMail()->rest_namespace,
			'/' . $this->rest_base . '/(?P<id>[a-z0-9]+)',
			array(
				array(
					'methods'             => \WP_REST_Server::DELETABLE,
					'callback'            => array( $this, 'delete_item' ),
					'permission_callback' => array( $this, 'check_permission' ),
				),
			)
		);
	}

	/**
	 * Lists every connection plus the routing slots.
	 *
	 * @param \WP_REST_Request $request Request.
	 * @return \WP_REST_Response
	 */
	public function get_items( $request ) {
		return rest_ensure_response( $this->payload() );
	}

	/**
	 * Creates or updates a connection.
	 *
	 * @param \WP_REST_Request $request Request.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function save_item( $request ) {
		$input = $request->get_json_params();
		$saved = VuloMail()->connections->save( is_array( $input ) ? $input : array() );

		if ( is_wp_error( $saved ) ) {
			return $saved;
		}

		// Email keeps WordPress's own mailer as the default until the site owner picks a primary. SMS
		// has no default to fall back on, so its first gateway becomes the primary.
		if ( \VuloMail\Utill::CHANNEL_SMS === $saved['channel'] && '' === (string) VuloMail()->settings->get( 'sms_primary' ) ) {
			VuloMail()->settings->update( array( 'sms_primary' => $saved['id'] ) );
		}

		return rest_ensure_response( $this->payload() );
	}

	/**
	 * Deletes a connection and clears any routing slot pointing at it.
	 *
	 * @param \WP_REST_Request $request Request.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function delete_item( $request ) {
		$id = sanitize_key( (string) $request['id'] );

		if ( ! VuloMail()->connections->delete( $id ) ) {
			return new \WP_Error( 'vulomail_connection_not_found', __( 'That connection no longer exists.', 'vulomail' ), array( 'status' => 404 ) );
		}

		// Clear any routing slot that pointed at it.
		$cleared = array();

		foreach ( array( 'email_primary', 'email_backup', 'sms_primary', 'sms_backup' ) as $slot ) {
			if ( VuloMail()->settings->get( $slot ) === $id ) {
				$cleared[ $slot ] = '';
			}
		}

		// Losing the primary promotes the backup, so the channel keeps a clear first choice.
		foreach ( array( 'email', 'sms' ) as $channel ) {
			$backup = (string) VuloMail()->settings->get( $channel . '_backup' );

			if ( isset( $cleared[ $channel . '_primary' ] ) && ! isset( $cleared[ $channel . '_backup' ] ) && '' !== $backup ) {
				$cleared[ $channel . '_primary' ] = $backup;
				$cleared[ $channel . '_backup' ]  = '';
			}
		}

		if ( $cleared ) {
			VuloMail()->settings->update( $cleared );
		}

		return rest_ensure_response( $this->payload() );
	}

	/**
	 * Connections plus the routing slots, so the screen refreshes from one response.
	 *
	 * @return array
	 */
	private function payload() {
		$connections = array();

		foreach ( VuloMail()->connections->all() as $connection ) {
			$connections[] = VuloMail()->connections->for_display( $connection );
		}

		$settings = VuloMail()->settings->all();

		return array(
			'connections' => $connections,
			'routing'     => array(
				'email_primary' => $settings['email_primary'],
				'email_backup'  => $settings['email_backup'],
				'sms_primary'   => $settings['sms_primary'],
				'sms_backup'    => $settings['sms_backup'],
			),
		);
	}
}
