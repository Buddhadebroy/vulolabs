<?php
/**
 * Forms REST controller file.
 *
 * @package VuloForm
 */

namespace VuloForm\Rest;

use VuloForm\Forms\Schema;
use VuloForm\Forms\Templates;
use VuloForm\Frontend\Renderer;
use VuloForm\Utill;

defined( 'ABSPATH' ) || exit;

/**
 * vuloform/v1/forms - list, create, read, save, duplicate, delete, preview and export forms.
 */
class Forms extends Controller {

	/**
	 * Registers this controller's routes.
	 *
	 * @return void
	 */
	public function register_routes() {
		$this->route( '/forms', \WP_REST_Server::READABLE, 'get_items' );
		$this->route( '/forms', \WP_REST_Server::CREATABLE, 'create_item' );
		$this->route( '/forms/(?P<id>\d+)', \WP_REST_Server::READABLE, 'get_item' );
		$this->route( '/forms/(?P<id>\d+)', \WP_REST_Server::CREATABLE, 'update_item' );
		$this->route( '/forms/(?P<id>\d+)', \WP_REST_Server::DELETABLE, 'delete_item' );
		$this->route( '/forms/(?P<id>\d+)/duplicate', \WP_REST_Server::CREATABLE, 'duplicate_item' );
		$this->route( '/forms/preview', \WP_REST_Server::CREATABLE, 'preview' );
	}

	/**
	 * @param \WP_REST_Request $request Request.
	 * @return \WP_REST_Response
	 */
	public function get_items( $request ) {
		$result = VuloForm()->forms->query(
			array(
				'search'   => sanitize_text_field( (string) $request->get_param( 'search' ) ),
				'status'   => sanitize_key( (string) $request->get_param( 'status' ) ),
				'page'     => absint( $request->get_param( 'page' ) ),
				'per_page' => absint( $request->get_param( 'per_page' ) ),
			)
		);
		$counts = VuloForm()->submissions->counts_by_form();

		foreach ( $result['data'] as $index => $row ) {
			$form_counts = $counts[ (int) $row['id'] ] ?? array(
				'total'  => 0,
				'unread' => 0,
			);

			$result['data'][ $index ]['id']                 = (int) $row['id'];
			$result['data'][ $index ]['submissions']        = $form_counts['total'];
			$result['data'][ $index ]['unread']             = $form_counts['unread'];
			$result['data'][ $index ]['updated_at_display'] = Utill::format_datetime( $row['updated_at'] );
		}

		return rest_ensure_response( $result );
	}

	/**
	 * Creates a form: blank, from a template, or from an exported schema.
	 *
	 * @param \WP_REST_Request $request Request.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function create_item( $request ) {
		$input     = (array) $request->get_json_params();
		$templates = Templates::all();
		$template  = sanitize_key( (string) ( $input['template'] ?? '' ) );
		$schema    = Schema::defaults();
		$title     = (string) ( $input['title'] ?? '' );

		if ( isset( $templates[ $template ] ) ) {
			$schema = $templates[ $template ]['schema'];
			$title  = '' !== $title ? $title : $templates[ $template ]['title'];
		} elseif ( isset( $input['schema'] ) && is_array( $input['schema'] ) ) {
			// An import. Schema::sanitize() rebuilds it, so a hand-edited file can't smuggle anything in.
			$schema = $input['schema'];
		} else {
			// A blank form still tells the site admin about each submission, like the templates do.
			$schema['settings']['notifications'][] = Templates::admin_notification();
		}

		$id = VuloForm()->forms->create( $title, $schema, 'draft' );

		if ( ! $id ) {
			return new \WP_Error( 'vuloform_create_failed', __( 'The form could not be created.', 'vuloform' ), array( 'status' => 500 ) );
		}

		return rest_ensure_response( $this->payload( $id ) );
	}

	/**
	 * @param \WP_REST_Request $request Request.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function get_item( $request ) {
		$payload = $this->payload( absint( $request['id'] ) );

		return $payload ? rest_ensure_response( $payload ) : $this->not_found();
	}

	/**
	 * Saves a form. A form with problems is still saved as a draft, so no work is lost, but it is
	 * not published.
	 *
	 * @param \WP_REST_Request $request Request.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function update_item( $request ) {
		$id    = absint( $request['id'] );
		$input = (array) $request->get_json_params();

		if ( ! VuloForm()->forms->get( $id ) ) {
			return $this->not_found();
		}

		$changes = array();

		if ( isset( $input['title'] ) ) {
			$changes['title'] = $input['title'];
		}

		if ( isset( $input['schema'] ) ) {
			$changes['schema'] = $input['schema'];
		}

		$problems = isset( $input['schema'] ) ? Schema::problems( Schema::sanitize( $input['schema'] ) ) : Schema::problems( VuloForm()->forms->get( $id )['schema'] );

		if ( isset( $input['status'] ) ) {
			$changes['status'] = 'published' === $input['status'] && ! $problems ? 'published' : 'draft';
		}

		VuloForm()->forms->update( $id, $changes );

		$payload             = $this->payload( $id );
		$payload['problems'] = $problems;
		// The same problems with where to fix each one; a problem an extension reported has no place.
		$known             = array_column( Schema::issues( $payload['schema'] ), null, 'message' );
		$payload['issues'] = array_map(
			static function ( $message ) use ( $known ) {
				return isset( $known[ $message ] ) ? $known[ $message ] : array(
					'message' => $message,
					'field'   => '',
					'group'   => '',
				);
			},
			$problems
		);

		return rest_ensure_response( $payload );
	}

	/**
	 * Deletes a form with its submissions and their files.
	 *
	 * @param \WP_REST_Request $request Request.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function delete_item( $request ) {
		$id = absint( $request['id'] );

		if ( ! VuloForm()->forms->get( $id ) ) {
			return $this->not_found();
		}

		// In batches, so a form with a large history can't run the request out of memory.
		do {
			$ids = VuloForm()->submissions->ids_where( 'form_id', $id, 200 );

			if ( $ids ) {
				VuloForm()->submissions->delete( $ids );
			}
		} while ( $ids );

		VuloForm()->forms->delete( $id );

		return rest_ensure_response( array( 'deleted' => true ) );
	}

	/**
	 * @param \WP_REST_Request $request Request.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function duplicate_item( $request ) {
		$id = VuloForm()->forms->duplicate( absint( $request['id'] ) );

		return $id ? rest_ensure_response( $this->payload( $id ) ) : $this->not_found();
	}

	/**
	 * Renders an unsaved schema for the builder's preview. The result can't be submitted.
	 *
	 * @param \WP_REST_Request $request Request.
	 * @return \WP_REST_Response
	 */
	public function preview( $request ) {
		$input = (array) $request->get_json_params();

		return rest_ensure_response(
			array(
				'html' => Renderer::render(
					array(
						'id'     => 0,
						'title'  => sanitize_text_field( (string) ( $input['title'] ?? '' ) ),
						'status' => 'draft',
						'schema' => Schema::sanitize( $input['schema'] ?? array() ),
					),
					array( 'preview' => true )
				),
			)
		);
	}

	/**
	 * @param int $id Form id.
	 * @return array|null The form as the builder needs it.
	 */
	private function payload( $id ) {
		$form = VuloForm()->forms->get( $id );

		if ( ! $form ) {
			return null;
		}

		$form['shortcode'] = '[vuloform id="' . (int) $form['id'] . '"]';
		// The snippet a site owner pastes into another site's HTML; it is shown as text, never printed here.
		$form['embed'] = sprintf(
			'<div data-vuloform="%1$d"><noscript>%2$s</noscript></div>' . "\n" . '<script src="%3$s" async></script>', // phpcs:ignore WordPress.WP.EnqueuedResources.NonEnqueuedScript
			(int) $form['id'],
			esc_html__( 'Please enable JavaScript to use this form.', 'vuloform' ),
			esc_url( add_query_arg( 'site', rawurlencode( untrailingslashit( rest_url() ) ), VuloForm()->plugin_url . 'assets/js/public/vuloform-embed.min.js' ) )
		);

		return $form;
	}
}
