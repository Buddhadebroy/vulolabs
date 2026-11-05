<?php
/**
 * FluentFormsMigrator class file.
 *
 * @package VuloForm
 */

namespace VuloForm\Migration;

defined( 'ABSPATH' ) || exit;

/**
 * Imports forms from Fluent Forms, through its own `wpFluent()` query builder
 * (`function_exists( 'wpFluent' )` is the documented way addons detect it) rather than Fluent
 * Forms' internal model classes, which live under a versioned namespace not safe to `use` here.
 *
 * Fluent Forms is not hosted on wp.org either, so - like GravityFormsMigrator - the table/column
 * names and JSON shapes below are built from its own publicly shared developer snippets
 * (wpmanageninja.com/docs, and the many `wpFluent()->table(...)` examples in its hooks docs), not
 * a verified source read: `fluentform_forms.form_fields` is a JSON-encoded field list (each field
 * keyed by its `element` type slug, with label/placeholder/required under `settings`), and
 * `fluentform_form_meta` rows (keyed `notifications`, `formSettings`) hold everything else. Two
 * things are deliberately NOT guessed at and reported instead: the "Send To" field/conditional
 * routing a notification can use (the same ambiguity GravityFormsMigrator reports for Gravity
 * Forms), and the compound Full Name element (its sub-field settings shape wasn't confirmed).
 *
 * Like the other migrators, this never touches the source form and is safe to re-run.
 */
class FluentFormsMigrator extends AbstractMigrator {

	const TABLE_FORMS = 'fluentform_forms';
	const TABLE_META  = 'fluentform_form_meta';

	/**
	 * Fluent Forms `element` type => VuloForm field type, for the elements confirmed by name
	 * across Fluent Forms' own public hook/snippet docs. Types with no VuloForm equivalent or
	 * whose settings shape wasn't confirmed (`input_name`, `address`, `select_country`, `ratings`,
	 * `terms_and_condition` beyond the simpler `gdpr_agreement`, `payment_*`, `repeater_fields`,
	 * `custom_submit_button`) are reported, not guessed at - see migrate_field().
	 *
	 * @var array<string, string>
	 */
	private const FIELD_TYPE_MAP = array(
		'input_text'     => 'text',
		'textarea'       => 'textarea',
		'input_email'    => 'email',
		'phone'          => 'phone',
		'input_number'   => 'number',
		'select'         => 'select',
		'input_radio'    => 'radio',
		'input_checkbox' => 'checkboxes',
		'input_hidden'   => 'hidden',
		'date_time'      => 'date',
		'input_file'     => 'file',
		'custom_html'    => 'html',
		'gdpr_agreement' => 'consent',
	);

	/**
	 * Fluent Forms elements that are layout-only or non-data (not fields, no error reported).
	 *
	 * @var string[]
	 */
	private const IGNORED_TYPES = array( 'section_break', 'form_step', 'recaptcha', 'hcaptcha', 'custom_submit_button' );

	/**
	 * @inheritDoc
	 */
	public function get_id(): string {
		return 'fluentforms';
	}

	/**
	 * @inheritDoc
	 */
	public function get_label(): string {
		return __( 'Fluent Forms', 'vuloform' );
	}

	/**
	 * @inheritDoc
	 */
	protected function is_active() {
		return function_exists( 'wpFluent' );
	}

	/**
	 * @inheritDoc
	 */
	protected function shortcode_tags() {
		// Fluent Forms' embed shortcode is `[fluentform id="123"]`.
		return array( 'fluentform' );
	}

	/**
	 * @inheritDoc
	 */
	public function list_available(): array {
		if ( ! $this->is_active() ) {
			return array();
		}

		$forms = wpFluent()->table( self::TABLE_FORMS )->get();

		$available = array();

		foreach ( (array) $forms as $form ) {
			$form   = (object) $form;
			$fields = $this->decode_fields( (string) ( $form->form_fields ?? '' ) );

			if ( 'trashed' === ( $form->status ?? '' ) ) {
				continue;
			}

			$available[] = array(
				'source_id'        => (int) $form->id,
				'title'            => '' !== (string) ( $form->title ?? '' ) ? (string) $form->title : __( '(untitled form)', 'vuloform' ),
				'status'           => 'draft' === ( $form->status ?? '' ) ? 'draft' : 'publish',
				'field_count'      => count( $fields ),
				'already_migrated' => null !== $this->map->get( $this->get_id(), (int) $form->id ),
			);
		}

		return $available;
	}

	/**
	 * @param int|string $form_id          Fluent Forms form id.
	 * @param int|null   $existing_form_id A VuloForm form already created for this source form, if any.
	 * @param string[]   $errors           Compatibility notes, by reference.
	 * @return int VuloForm form id, or 0 on failure.
	 */
	protected function migrate_one( $form_id, ?int $existing_form_id, array &$errors ) {
		$form_id = (int) $form_id;
		$form    = wpFluent()->table( self::TABLE_FORMS )->find( $form_id );

		if ( ! $form ) {
			$errors[] = sprintf(
				/* translators: %d: Fluent Forms form id. */
				__( 'Fluent Forms form #%d could not be read.', 'vuloform' ),
				$form_id
			);

			return 0;
		}

		$title      = '' !== (string) ( $form->title ?? '' ) ? (string) $form->title : __( 'Untitled form', 'vuloform' );
		$raw_fields = $this->decode_fields( (string) ( $form->form_fields ?? '' ) );
		$fields     = array();

		foreach ( $raw_fields as $raw_field ) {
			$field = $this->migrate_field( $raw_field, $errors, (string) $title );

			if ( $field ) {
				$fields[] = $field;
			}
		}

		$schema = array(
			'fields'   => $fields,
			'settings' => $this->migrate_settings( $form_id, (string) $title, $errors ),
		);

		$status = 'draft' === ( $form->status ?? '' ) ? 'draft' : 'published';

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
	 * @param string $form_fields The `fluentform_forms.form_fields` JSON column.
	 * @return array<int, array> Every field object under the decoded `fields` key.
	 */
	private function decode_fields( string $form_fields ): array {
		$data = json_decode( $form_fields, true );

		return is_array( $data ) ? (array) ( $data['fields'] ?? array() ) : array();
	}

	/**
	 * @param array    $raw    One Fluent Forms field object (decoded from JSON).
	 * @param string[] $errors Compatibility notes, by reference.
	 * @param string   $title  Source form title, for error messages.
	 * @return array|null A VuloForm field, or null when the type has no equivalent or isn't a field.
	 */
	private function migrate_field( array $raw, array &$errors, string $title ): ?array {
		$element = (string) ( $raw['element'] ?? '' );

		if ( in_array( $element, self::IGNORED_TYPES, true ) ) {
			return null;
		}

		$type = self::FIELD_TYPE_MAP[ $element ] ?? null;

		$settings = (array) ( $raw['settings'] ?? array() );
		$label    = (string) ( $settings['label'] ?? '' );

		if ( null === $type ) {
			$errors[] = sprintf(
				/* translators: 1: form title, 2: Fluent Forms field type. */
				__( '"%1$s": the "%2$s" field type is not supported yet and was skipped.', 'vuloform' ),
				$title,
				'' !== $element ? $element : __( '(unknown)', 'vuloform' )
			);

			return null;
		}

		$attributes = (array) ( $raw['attributes'] ?? array() );
		$name       = (string) ( $attributes['name'] ?? $element );
		$required   = (bool) ( $settings['validation_rules']['required']['value'] ?? false );

		$field = array(
			'id'          => 'f_flf' . sanitize_key( $name ),
			'type'        => $type,
			'label'       => $label,
			'description' => (string) ( $settings['help_message'] ?? '' ),
			'placeholder' => (string) ( $settings['placeholder'] ?? '' ),
			'required'    => $required,
			'default'     => (string) ( $attributes['value'] ?? $settings['value'] ?? '' ),
		);

		if ( in_array( $type, array( 'select', 'radio', 'checkboxes' ), true ) ) {
			$field['options'] = array();

			// Fluent Forms has used both a flat `{value: label}` map and an `advancedOptions` list
			// of `{label, value}` across versions - both are read defensively here.
			$advanced = (array) ( $raw['advancedOptions'] ?? array() );

			if ( $advanced ) {
				foreach ( $advanced as $option ) {
					$option_label = (string) ( is_array( $option ) ? ( $option['label'] ?? '' ) : '' );
					$option_value = (string) ( is_array( $option ) ? ( $option['value'] ?? '' ) : '' );

					if ( '' !== $option_label ) {
						$field['options'][] = array(
							'label' => $option_label,
							'value' => '' !== $option_value ? $option_value : $option_label,
						);
					}
				}
			} else {
				foreach ( (array) ( $raw['options'] ?? array() ) as $value => $option_label ) {
					$option_label = (string) $option_label;

					if ( '' !== $option_label ) {
						$field['options'][] = array(
							'label' => $option_label,
							'value' => (string) $value,
						);
					}
				}
			}
		}

		if ( 'consent' === $type ) {
			$field['consent_text'] = '' !== $label ? $label : __( 'I agree', 'vuloform' );
		}

		if ( 'html' === $type ) {
			$field['content'] = (string) ( $settings['html_codes'] ?? '' );
		}

		return $field;
	}

	/**
	 * @param int      $form_id Fluent Forms form id.
	 * @param string   $title   Source form title, for compatibility notes.
	 * @param string[] $errors  Compatibility notes, by reference.
	 * @return array A VuloForm `settings` object (Schema::sanitize() rebuilds/validates it on save).
	 */
	private function migrate_settings( int $form_id, string $title, array &$errors ): array {
		$out = array();

		$form_settings = $this->get_meta_value( $form_id, 'formSettings' );
		$confirmation  = (array) ( $form_settings['confirmation'] ?? array() );

		if ( $confirmation ) {
			$redirect_to = (string) ( $confirmation['redirectTo'] ?? '' );
			$is_redirect = in_array( $redirect_to, array( 'customUrl', 'customPage' ), true );

			$out['confirmation'] = array(
				'type'         => $is_redirect ? 'redirect' : 'message',
				'message'      => (string) ( $confirmation['messageToShow'] ?? '' ),
				'redirect_url' => (string) ( $confirmation['customUrl'] ?? '' ),
			);
		}

		// A notification's "Send To" can point at a field's own answer or a conditional rule, not
		// only a fixed address - the same ambiguity GravityFormsMigrator reports for Gravity Forms'
		// notifications, so these are reported rather than guessed at.
		$notifications = $this->get_meta_value( $form_id, 'notifications' );

		if ( $notifications ) {
			$errors[] = sprintf(
				/* translators: %s: form title. */
				__( '"%s": email notifications were found but could not be migrated automatically (Fluent Forms can route a notification to a field\'s answer, which has no safe automatic translation); add them again under this form\'s Notification Settings.', 'vuloform' ),
				$title
			);
		}

		return $out;
	}

	/**
	 * @param int    $form_id  Fluent Forms form id.
	 * @param string $meta_key One of `fluentform_form_meta`'s own meta keys.
	 * @return array Decoded meta value, or an empty array when absent or not valid JSON.
	 */
	private function get_meta_value( int $form_id, string $meta_key ): array {
		$row = wpFluent()->table( self::TABLE_META )
			->where( 'form_id', $form_id )
			->where( 'meta_key', $meta_key )
			->first();

		if ( ! $row || ! isset( $row->value ) ) {
			return array();
		}

		$data = json_decode( (string) $row->value, true );

		if ( is_array( $data ) ) {
			return $data;
		}

		$data = maybe_unserialize( $row->value );

		return is_array( $data ) ? $data : array();
	}
}
