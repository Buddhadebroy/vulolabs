<?php
/**
 * ForminatorMigrator class file.
 *
 * @package VuloForm
 */

namespace VuloForm\Migration;

defined( 'ABSPATH' ) || exit;

/**
 * Imports forms from Forminator. A form is a `forminator_forms` post; its definition (a PHP array
 * with `fields`, `settings`, `notifications`, `behaviors`) lives in the `forminator_form_meta`
 * postmeta. Notification shape wasn't confirmed, so notifications are reported, not guessed at.
 * Safe to re-run, like the other migrators.
 */
class ForminatorMigrator extends AbstractMigrator {

	const POST_TYPE = 'forminator_forms';
	const META_KEY  = 'forminator_form_meta';

	/**
	 * Forminator field slug => VuloForm field type. Unmapped types are reported, not guessed at -
	 * see migrate_field().
	 *
	 * @var array<string, string>
	 */
	private const FIELD_TYPE_MAP = array(
		'text'         => 'text',
		'textarea'     => 'textarea',
		'email'        => 'email',
		'number'       => 'number',
		'phone'        => 'phone',
		'website'      => 'url',
		'select'       => 'select',
		'radio'        => 'radio',
		// Forminator's own slug for its checkbox-group field is 'checkbox' (implemented in
		// library/fields/multivalue.php - confirmed via that class's $slug property).
		'checkbox'     => 'checkboxes',
		'consent'      => 'consent',
		'gdprcheckbox' => 'consent',
		'date'         => 'date',
		'time'         => 'time',
		'upload'       => 'file',
		'html'         => 'html',
		'hidden'       => 'hidden',
		'page-break'   => 'page_break',
		'name'         => 'name',
		'address'      => 'address',
	);

	/**
	 * @inheritDoc
	 */
	public function get_id(): string {
		return 'forminator';
	}

	/**
	 * @inheritDoc
	 */
	public function plugin_files(): array {
		return array( 'forminator/forminator.php' );
	}

	/**
	 * @inheritDoc
	 */
	public function get_label(): string {
		return __( 'Forminator', 'vuloform' );
	}

	/**
	 * @inheritDoc
	 */
	protected function is_active() {
		return post_type_exists( self::POST_TYPE );
	}

	/**
	 * @inheritDoc
	 */
	protected function shortcode_tags() {
		// Forminator's embed shortcode is `[forminator_form id="123"]`.
		return array( 'forminator_form' );
	}

	/**
	 * @inheritDoc
	 */
	public function list_available(): array {
		if ( ! $this->is_active() ) {
			return array();
		}

		$posts = get_posts(
			array(
				'post_type'      => self::POST_TYPE,
				'post_status'    => array( 'publish', 'draft', 'pending', 'private', 'future' ),
				'posts_per_page' => -1,
				'orderby'        => 'ID',
				'order'          => 'ASC',
			)
		);

		$available = array();

		foreach ( $posts as $post ) {
			$data = $this->read_meta( $post->ID );

			$available[] = array(
				'source_id'        => $post->ID,
				'title'            => $post->post_title ? $post->post_title : __( '(untitled form)', 'vuloform' ),
				'status'           => $post->post_status,
				'field_count'      => count( (array) ( $data['fields'] ?? array() ) ),
				'already_migrated' => null !== self::map_get( $this->get_id(), $post->ID ),
			);
		}

		return $available;
	}

	/**
	 * @param int|string $post_id          Forminator form post id.
	 * @param int|null   $existing_form_id A VuloForm form already created for this source form, if any.
	 * @param string[]   $errors           Compatibility notes, by reference.
	 * @return int VuloForm form id, or 0 on failure.
	 */
	protected function migrate_one( $post_id, ?int $existing_form_id, array &$errors ) {
		$post_id = (int) $post_id;
		$post    = get_post( $post_id );
		$data    = $post ? $this->read_meta( $post_id ) : array();

		if ( ! $post || ! $data ) {
			$errors[] = sprintf(
				/* translators: %d: Forminator form id. */
				__( 'Forminator form #%d could not be read.', 'vuloform' ),
				$post_id
			);

			return 0;
		}

		$title  = $post->post_title ? $post->post_title : __( 'Untitled form', 'vuloform' );
		$fields = array();

		foreach ( (array) ( $data['fields'] ?? array() ) as $raw_field ) {
			if ( ! is_array( $raw_field ) ) {
				continue;
			}

			$field = $this->migrate_field( $raw_field, $errors, (string) $title );

			if ( $field ) {
				$fields[] = $field;
			}
		}

		$schema = array(
			'fields'   => $fields,
			'settings' => $this->migrate_settings( (array) $data, $title, $errors ),
		);

		$status = 'publish' === $post->post_status ? 'published' : 'draft';

		if ( $existing_form_id ) {
			$updated = VuloForm()->forms->update(
				$existing_form_id,
				array(
					'title'  => $title,
					'schema' => $schema,
					'status' => $status,
				)
			);

			return $updated ? $existing_form_id : 0;
		}

		return (int) VuloForm()->forms->create( $title, $schema, $status );
	}

	/**
	 * @param array  $raw    One Forminator field.
	 * @param array  $errors Compatibility notes, by reference.
	 * @param string $title  Source form title, for error messages.
	 * @return array|null A VuloForm field, or null when the type has no equivalent.
	 */
	private function migrate_field( array $raw, array &$errors, string $title ): ?array {
		$forminator_type = (string) ( $raw['type'] ?? '' );
		$type            = self::FIELD_TYPE_MAP[ $forminator_type ] ?? null;

		if ( null === $type ) {
			$errors[] = sprintf(
				/* translators: 1: form title, 2: Forminator field type. */
				__( '"%1$s": the "%2$s" field type is not supported yet and was skipped.', 'vuloform' ),
				$title,
				$forminator_type
			);

			return null;
		}

		$label = (string) ( $raw['field_label'] ?? '' );

		$field = array(
			'id'          => 'f_frm' . sanitize_key( (string) ( $raw['element_id'] ?? '' ) ),
			'type'        => $type,
			'label'       => $label,
			'description' => (string) ( $raw['description'] ?? '' ),
			'placeholder' => (string) ( $raw['placeholder'] ?? '' ),
			'required'    => 'true' === ( $raw['required'] ?? '' ) || true === ( $raw['required'] ?? false ),
			'default'     => (string) ( $raw['default'] ?? '' ),
		);

		if ( in_array( $type, array( 'select', 'radio', 'checkboxes' ), true ) ) {
			$field['options'] = array();

			foreach ( (array) ( $raw['options'] ?? array() ) as $option ) {
				$option_label = (string) ( is_array( $option ) ? ( $option['label'] ?? '' ) : '' );
				$option_value = (string) ( is_array( $option ) ? ( $option['value'] ?? '' ) : '' );

				if ( '' !== $option_label ) {
					$field['options'][] = array(
						'label' => $option_label,
						'value' => '' !== $option_value ? $option_value : $option_label,
					);
				}
			}
		}

		if ( 'consent' === $type ) {
			// 'consent' fields use 'consent_description', 'gdprcheckbox' fields 'gdpr_description'
			// (confirmed against library/fields/consent.php and library/fields/gdprcheckbox.php).
			$field['consent_text'] = (string) ( $raw['consent_description'] ?? $raw['gdpr_description'] ?? $label );
		}

		if ( 'html' === $type ) {
			$field['content'] = (string) ( $raw['html'] ?? $raw['description'] ?? '' );
		}

		if ( 'name' === $type ) {
			$parts = array();

			if ( ! isset( $raw['fname'] ) || 'false' !== (string) $raw['fname'] ) {
				$parts[] = 'first';
			}

			if ( ! isset( $raw['lname'] ) || 'false' !== (string) $raw['lname'] ) {
				$parts[] = 'last';
			}

			$field['parts'] = $parts ? $parts : array( 'first', 'last' );

			if ( isset( $raw['prefix'] ) && 'false' !== (string) $raw['prefix'] ) {
				$errors[] = sprintf(
					/* translators: 1: form title, 2: field label. */
					__( '"%1$s": the prefix (Mr/Mrs/...) part of "%2$s" is not supported and was dropped.', 'vuloform' ),
					$title,
					$label
				);
			}

			if ( isset( $raw['mname'] ) && 'false' !== (string) $raw['mname'] ) {
				$errors[] = sprintf(
					/* translators: 1: form title, 2: field label. */
					__( '"%1$s": the middle-name part of "%2$s" is not supported; the field migrated with first/last name only.', 'vuloform' ),
					$title,
					$label
				);
			}
		}

		return $field;
	}

	/**
	 * @param array    $data   Decoded `forminator_form_meta`.
	 * @param string   $title  Source form title, for compatibility notes.
	 * @param string[] $errors Compatibility notes, by reference.
	 * @return array A VuloForm `settings` object (Schema::sanitize() rebuilds/validates it on save).
	 */
	private function migrate_settings( array $data, string $title, array &$errors ): array {
		$settings = (array) ( $data['settings'] ?? array() );
		$out      = array();

		$behaviors = (array) ( $data['behaviors'][0] ?? $data['behaviors'] ?? array() );
		$message   = (string) ( $behaviors['thankyou-message'] ?? $settings['thankyou-message'] ?? '' );
		$behaviour = (string) ( $behaviors['submission-behaviour'] ?? $settings['submission-behaviour'] ?? '' );
		$redirect  = (string) ( $behaviors['redirect-url'] ?? $settings['redirect-url'] ?? '' );

		if ( '' !== $message || '' !== $redirect ) {
			$out['confirmation'] = array(
				'type'         => 'behaviour-redirect' === $behaviour ? 'redirect' : 'message',
				'message'      => $message,
				'redirect_url' => $redirect,
			);
		}

		if ( ! empty( $data['notifications'] ) ) {
			$errors[] = sprintf(
				/* translators: %s: form title. */
				__( '"%s": email notifications were found but could not be migrated automatically (Forminator\'s notification format is not publicly documented); add them again under this form\'s Notifications tab.', 'vuloform' ),
				$title
			);
		}

		return $out;
	}

	/**
	 * @param int $post_id Forminator form post id.
	 * @return array
	 */
	private function read_meta( int $post_id ): array {
		$data = get_post_meta( $post_id, self::META_KEY, true );

		return is_array( $data ) ? $data : array();
	}
}
