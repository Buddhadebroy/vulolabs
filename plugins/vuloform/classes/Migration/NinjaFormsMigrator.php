<?php
/**
 * NinjaFormsMigrator class file.
 *
 * @package VuloForm
 */

namespace VuloForm\Migration;

defined( 'ABSPATH' ) || exit;

/**
 * Imports forms from Ninja Forms, through its own extension API (`Ninja_Forms()->form( $id )`,
 * `->get_fields()`, `->get_actions()`) rather than querying its `nf3_*` tables directly. Safe to
 * re-run, like the other migrators.
 */
class NinjaFormsMigrator extends AbstractMigrator {

	/**
	 * Ninja Forms field type => VuloForm field type. `submit`/`recaptcha`/`hcaptcha` are skipped
	 * outright - see migrate_field(). Unmapped types are reported, not guessed at.
	 *
	 * @var array<string, string>
	 */
	private const FIELD_TYPE_MAP = array(
		'textbox'      => 'text',
		'textarea'     => 'textarea',
		'email'        => 'email',
		'phone'        => 'phone',
		'url'          => 'url',
		'number'       => 'number',
		'hidden'       => 'hidden',
		'html'         => 'html',
		'date'         => 'date',
		'file_upload'  => 'file',
		'listselect'   => 'select',
		'listcheckbox' => 'checkboxes',
		'radio'        => 'radio',
		// A plain Ninja Forms checkbox is a single on/off control with its own label - the same
		// widget shape as VuloForm's 'consent' field, so it migrates there rather than being dropped.
		'checkbox'     => 'consent',
		'firstname'    => 'text',
		'lastname'     => 'text',
	);

	/**
	 * Field types that are never a migratable field (no error reported for these).
	 *
	 * @var string[]
	 */
	private const IGNORED_TYPES = array( 'submit', 'recaptcha', 'hcaptcha' );

	/**
	 * @inheritDoc
	 */
	public function get_id(): string {
		return 'ninja-forms';
	}

	/**
	 * @inheritDoc
	 */
	public function plugin_files(): array {
		return array( 'ninja-forms/ninja-forms.php' );
	}

	/**
	 * @inheritDoc
	 */
	public function get_label(): string {
		return __( 'Ninja Forms', 'vuloform' );
	}

	/**
	 * @inheritDoc
	 */
	protected function is_active() {
		return function_exists( 'Ninja_Forms' );
	}

	/**
	 * @inheritDoc
	 */
	protected function shortcode_tags() {
		// Ninja Forms' classic embed shortcode is `[ninja_form id=123]`; the Gutenberg block it also
		// ships is not a shortcode and is out of scope for the shortcode rewrite pass.
		return array( 'ninja_form' );
	}

	/**
	 * @inheritDoc
	 */
	public function list_available(): array {
		if ( ! $this->is_active() ) {
			return array();
		}

		$available = array();

		foreach ( Ninja_Forms()->form()->get_forms() as $form ) {
			$form_id = $form->get_id();
			$title   = (string) $form->get_setting( 'title' );

			// get_forms() rows have no get_fields() of their own - fetch it from the full form.
			$available[] = array(
				'source_id'        => $form_id,
				'title'            => '' !== $title ? $title : __( '(untitled form)', 'vuloform' ),
				'status'           => 'publish',
				'field_count'      => count( Ninja_Forms()->form( $form_id )->get_fields() ),
				'already_migrated' => null !== self::map_get( $this->get_id(), $form_id ),
			);
		}

		return $available;
	}

	/**
	 * @param int|string $form_id          Ninja Forms form id.
	 * @param int|null   $existing_form_id A VuloForm form already created for this source form, if any.
	 * @param string[]   $errors           Compatibility notes, by reference.
	 * @return int VuloForm form id, or 0 on failure.
	 */
	protected function migrate_one( $form_id, ?int $existing_form_id, array &$errors ) {
		$form_id = (int) $form_id;
		$form    = Ninja_Forms()->form( $form_id )->get();

		if ( ! $form ) {
			$errors[] = sprintf(
				/* translators: %d: Ninja Forms form id. */
				__( 'Ninja Forms form #%d could not be read.', 'vuloform' ),
				$form_id
			);

			return 0;
		}

		$title  = (string) $form->get_setting( 'title' );
		$title  = '' !== $title ? $title : __( 'Untitled form', 'vuloform' );
		$fields = array();

		foreach ( $form->get_fields() as $raw_field ) {
			$field = $this->migrate_field( $raw_field, $errors, $title );

			if ( $field ) {
				$fields[] = $field;
			}
		}

		$schema = array(
			'fields'   => $fields,
			'settings' => $this->migrate_settings( $form, $title, $errors ),
		);

		if ( $existing_form_id ) {
			$updated = VuloForm()->forms->update(
				$existing_form_id,
				array(
					'title'  => $title,
					'schema' => $schema,
					'status' => 'published',
				)
			);

			return $updated ? $existing_form_id : 0;
		}

		return (int) VuloForm()->forms->create( $title, $schema, 'published' );
	}

	/**
	 * @param \NF_Database_Models_Field $raw    One Ninja Forms field.
	 * @param string[]                  $errors Compatibility notes, by reference.
	 * @param string                    $title  Source form title, for error messages.
	 * @return array|null A VuloForm field, or null when the type has no equivalent or isn't a field.
	 */
	private function migrate_field( $raw, array &$errors, string $title ): ?array {
		$nf_type = (string) $raw->get_setting( 'type' );

		if ( in_array( $nf_type, self::IGNORED_TYPES, true ) ) {
			return null;
		}

		$type  = self::FIELD_TYPE_MAP[ $nf_type ] ?? null;
		$label = (string) $raw->get_setting( 'label' );

		if ( null === $type ) {
			$errors[] = sprintf(
				/* translators: 1: form title, 2: Ninja Forms field type. */
				__( '"%1$s": the "%2$s" field type is not supported yet and was skipped.', 'vuloform' ),
				$title,
				$nf_type
			);

			return null;
		}

		$key = (string) $raw->get_setting( 'key' );

		$field = array(
			'id'          => 'f_nf' . sanitize_key( '' !== $key ? $key : (string) $raw->get_id() ),
			'type'        => $type,
			'label'       => $label,
			'description' => (string) $raw->get_setting( 'desc' ),
			'placeholder' => (string) $raw->get_setting( 'placeholder' ),
			'required'    => (bool) $raw->get_setting( 'req' ),
			'default'     => (string) $raw->get_setting( 'default' ),
		);

		if ( in_array( $type, array( 'select', 'radio', 'checkboxes' ), true ) ) {
			$field['options'] = array();

			foreach ( (array) $raw->get_setting( 'options' ) as $option ) {
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
			$field['consent_text'] = '' !== $label ? $label : __( 'I agree', 'vuloform' );
		}

		if ( 'html' === $type ) {
			$field['content'] = (string) $raw->get_setting( 'default_value' );
		}

		return $field;
	}

	/**
	 * @param \NF_Database_Models_Form $form   Ninja Forms form.
	 * @param string                   $title  Source form title, for compatibility notes.
	 * @param string[]                 $errors Compatibility notes, by reference.
	 * @return array A VuloForm `settings` object (Schema::sanitize() rebuilds/validates it on save).
	 */
	private function migrate_settings( $form, string $title, array &$errors ): array {
		$out = array();

		foreach ( $form->get_actions() as $index => $action ) {
			$action_type = (string) $action->get_setting( 'type' );

			if ( 'email' === $action_type ) {
				$out['notifications'][] = array(
					'id'      => 'nf_notification_' . $index,
					'name'    => (string) $action->get_setting( 'label' ),
					'enabled' => null === $action->get_setting( 'active' ) || (bool) $action->get_setting( 'active' ),
					'channel' => 'email',
					'to'      => (string) ( $action->get_setting( 'email_to' ) ?: get_option( 'admin_email' ) ),
					'subject' => (string) $action->get_setting( 'email_subject' ),
					'message' => (string) ( $action->get_setting( 'email_message' ) ?: '{all_fields}' ),
				);
			} elseif ( 'redirect' === $action_type ) {
				$out['confirmation'] = array(
					'type'         => 'redirect',
					'message'      => '',
					'redirect_url' => (string) $action->get_setting( 'redirect_url' ),
				);
			} elseif ( 'successmessage' === $action_type && empty( $out['confirmation'] ) ) {
				$out['confirmation'] = array(
					'type'         => 'message',
					'message'      => (string) $action->get_setting( 'success_message' ),
					'redirect_url' => '',
				);
			} elseif ( 'save' !== $action_type && '' !== $action_type ) {
				$errors[] = sprintf(
					/* translators: 1: form title, 2: Ninja Forms action type. */
					__( '"%1$s": the "%2$s" action is not supported yet and was skipped.', 'vuloform' ),
					$title,
					$action_type
				);
			}
		}

		return $out;
	}
}
