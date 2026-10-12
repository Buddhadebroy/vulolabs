<?php
/**
 * Frontend class file.
 *
 * @package VuloForm
 */

namespace VuloForm\Frontend;

defined( 'ABSPATH' ) || exit;

/**
 * Puts forms on the public site: the shortcode, the block, the assets, and the fallback that
 * handles a form posted without JavaScript.
 */
class Frontend {

	/**
	 * How long the result of a no-JavaScript submission is kept for the redirect back.
	 */
	const RESULT_LIFETIME = 5 * MINUTE_IN_SECONDS;

	/**
	 * Frontend constructor.
	 */
	public function __construct() {
		add_shortcode( 'vuloform', array( $this, 'shortcode' ) );
		add_action( 'init', array( $this, 'register_block' ) );
		add_action( 'wp_enqueue_scripts', array( $this, 'register_assets' ), 5 );
		add_action( 'enqueue_block_editor_assets', array( $this, 'localize_block' ) );
		add_action( 'admin_post_vuloform_submit', array( $this, 'handle_post' ) );
		add_action( 'admin_post_nopriv_vuloform_submit', array( $this, 'handle_post' ) );
	}

	/**
	 * Registers the form's script and stylesheet. They are only enqueued when a form is rendered, so
	 * pages without a form load nothing.
	 *
	 * @return void
	 */
	public function register_assets() {
		$url = VuloForm()->plugin_url . 'assets/';

		wp_register_style( 'vuloform-form', $url . 'styles/public/vuloform-form.min.css', array(), VULOFORM_PLUGIN_VERSION );
		wp_register_script( 'vuloform-form', $url . 'js/public/vuloform-form.min.js', array(), VULOFORM_PLUGIN_VERSION, true );
	}

	/**
	 * `[vuloform id="12"]`.
	 *
	 * @param array|string $atts Shortcode attributes.
	 * @return string
	 */
	public function shortcode( $atts ) {
		$atts = shortcode_atts( array( 'id' => 0 ), is_array( $atts ) ? $atts : array(), 'vuloform' );

		return $this->render( (int) $atts['id'] );
	}

	/**
	 * Renders a form by id and loads its assets.
	 *
	 * @param int $form_id Form id.
	 * @return string HTML, or '' when the form doesn't exist.
	 */
	public function render( $form_id ) {
		$form = VuloForm()->forms->get( $form_id );

		if ( ! $form ) {
			return current_user_can( 'edit_posts' ) ? '<p class="vuloform-notice">' . esc_html__( 'This form no longer exists.', 'vuloform' ) . '</p>' : '';
		}

		if ( ! wp_style_is( 'vuloform-form', 'registered' ) ) {
			$this->register_assets();
		}

		wp_enqueue_style( 'vuloform-form' );
		wp_enqueue_script( 'vuloform-form' );

		return Renderer::render( $form, $this->pending_result( $form['id'] ) );
	}

	/**
	 * Registers the Gutenberg block. It is rendered on the server, by the same code as the shortcode.
	 *
	 * @return void
	 */
	public function register_block() {
		$path = VuloForm()->plugin_path . 'assets/js/block/form';

		if ( file_exists( $path . '/block.json' ) ) {
			register_block_type(
				$path,
				array(
					'render_callback' => function ( $attributes ) {
						return $this->render( (int) ( $attributes['formId'] ?? 0 ) );
					},
				)
			);
		}
	}

	/**
	 * Gives the block editor the list of forms to choose from.
	 *
	 * @return void
	 */
	public function localize_block() {
		wp_add_inline_script(
			'vuloform-form-editor-script',
			'window.vuloformBlock = ' . wp_json_encode(
				array(
					'forms'    => current_user_can( 'edit_posts' ) ? VuloForm()->forms->published() : array(),
					'adminUrl' => admin_url( 'admin.php?page=vuloform' ),
				)
			) . ';',
			'before'
		);
	}

	/**
	 * Handles a form posted the ordinary way (no JavaScript): process it, remember the outcome
	 * briefly, and send the visitor back to the page the form is on.
	 *
	 * @return void
	 */
	public function handle_post() {
		// phpcs:disable WordPress.Security.NonceVerification.Missing -- public form: authenticity is checked with the signed form token in Submissions\Processor, as a nonce can't be used on cached pages.
		$form_id = isset( $_POST['vf_form_id'] ) ? absint( wp_unslash( $_POST['vf_form_id'] ) ) : 0;
		$form    = VuloForm()->forms->get( $form_id );
		$back    = wp_get_referer() ? wp_get_referer() : home_url( '/' );

		if ( ! $form ) {
			wp_safe_redirect( $back );
			exit;
		}

		// WordPress slashes $_POST; the REST route hands the processor unslashed values, so this path
		// must too. Each value is then sanitized for its field type in Processor::clean().
		// phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized
		$post   = wp_unslash( $_POST );
		$result = VuloForm()->processor->handle( $form, $post, $_FILES );
		// phpcs:enable

		if ( $result['success'] && '' !== $result['redirect'] ) {
			// phpcs:ignore WordPress.Security.SafeRedirect.wp_redirect_wp_redirect -- the destination is the URL the site owner configured for this form.
			wp_redirect( $result['redirect'] );
			exit;
		}

		// Typed values are handed back so a mistake doesn't cost the visitor the whole form.
		wp_safe_redirect( self::result_url( $back, $form['id'], $result['success'], $result['message'], $result['errors'], $result['success'] ? array() : self::prefill( $form, $post ) ) );
		exit;
	}

	/**
	 * Remembers an outcome for a few minutes and returns the address that shows it: the given page,
	 * with the form replaced by the message (or showing the errors). Used after a no-JavaScript
	 * submission, and by extensions that send the visitor away and back, such as a payment.
	 *
	 * @param string $page_url Page the form is on.
	 * @param int    $form_id  Form id.
	 * @param bool   $success  Whether to show the message as a success.
	 * @param string $message  Message (HTML allowed in posts).
	 * @param array  $errors   Field id => error.
	 * @param array  $values   Field key => value to put back into the form.
	 * @return string
	 */
	public static function result_url( $page_url, $form_id, $success, $message, array $errors = array(), array $values = array() ) {
		$key = wp_generate_password( 20, false );

		set_transient(
			'vuloform_result_' . $key,
			array(
				'form_id' => (int) $form_id,
				'success' => (bool) $success,
				'message' => (string) $message,
				'errors'  => $errors,
				'values'  => $values,
			),
			self::RESULT_LIFETIME
		);

		return add_query_arg( 'vuloform_result', $key, remove_query_arg( 'vuloform_result', $page_url ) ) . '#vuloform-' . (int) $form_id . '-1';
	}

	/**
	 * The outcome of a no-JavaScript submission, if this request is the redirect back from one.
	 *
	 * @param int $form_id Form being rendered.
	 * @return array Renderer arguments.
	 */
	private function pending_result( $form_id ) {
		// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- an opaque, single-use key that only selects which stored message to show.
		$key = isset( $_GET['vuloform_result'] ) ? preg_replace( '/[^A-Za-z0-9]/', '', sanitize_text_field( wp_unslash( $_GET['vuloform_result'] ) ) ) : '';

		if ( '' === $key ) {
			return array();
		}

		$result = get_transient( 'vuloform_result_' . $key );

		if ( ! is_array( $result ) || (int) $result['form_id'] !== (int) $form_id ) {
			return array();
		}

		delete_transient( 'vuloform_result_' . $key );

		return array(
			'success' => (bool) $result['success'],
			'message' => (string) $result['message'],
			'errors'  => (array) $result['errors'],
			'values'  => (array) $result['values'],
		);
	}

	/**
	 * @param array $form Form.
	 * @param array $post Request fields.
	 * @return array Field key => cleaned value.
	 */
	private static function prefill( array $form, array $post ) {
		$raw    = isset( $post['vf'] ) && is_array( $post['vf'] ) ? $post['vf'] : array();
		$values = array();

		foreach ( $form['schema']['fields'] as $field ) {
			if ( isset( $raw[ $field['key'] ] ) && ! in_array( $field['type'], array( 'file', 'calculation', 'hidden' ), true ) ) {
				$values[ $field['key'] ] = \VuloForm\Submissions\Processor::clean( $field, $raw[ $field['key'] ] );
			}
		}

		return $values;
	}
}
