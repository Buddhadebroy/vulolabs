<?php
/**
 * GravityFormsMigrator class file.
 *
 * @package VuloForm
 */

namespace VuloForm\Migration;

defined( 'ABSPATH' ) || exit;

/**
 * Imports forms from Gravity Forms, through its own `GFAPI`. Notifications ("send to" can route
 * to a field or a condition) and conditional logic are reported, not migrated. Safe to re-run,
 * like the other migrators.
 */
class GravityFormsMigrator extends AbstractMigrator {

	/**
	 * Gravity Forms field type => VuloForm field type. Unmapped types (Post Fields, Pricing
	 * Fields, password, captcha, list, section) are reported, not guessed at - see migrate_field().
	 *
	 * @var array<string, string>
	 */
	private const FIELD_TYPE_MAP = array(
		'text'       => 'text',
		'textarea'   => 'textarea',
		'select'     => 'select',
		'number'     => 'number',
		'checkbox'   => 'checkboxes',
		'radio'      => 'radio',
		'hidden'     => 'hidden',
		'html'       => 'html',
		'page'       => 'page_break',
		'name'       => 'name',
		'address'    => 'address',
		'email'      => 'email',
		'phone'      => 'phone',
		'website'    => 'url',
		'date'       => 'date',
		'time'       => 'time',
		'fileupload' => 'file',
		'consent'    => 'consent',
		'signature'  => 'signature', // The Signature Add-On's own field type.
	);

	/**
	 * Gravity Forms' own stable numbering of a Name field's sub-inputs (`{field_id}.{n}`) - the
	 * same convention referenced throughout its public developer docs and code snippets.
	 *
	 * @var array<int, string>
	 */
	private const NAME_INPUTS = array(
		3 => 'first',
		6 => 'last',
	);

	/**
	 * Gravity Forms' own stable numbering of an Address field's sub-inputs.
	 *
	 * @var array<int, string>
	 */
	private const ADDRESS_INPUTS = array(
		1 => 'line1',
		2 => 'line2',
		3 => 'city',
		4 => 'state',
		5 => 'zip',
		6 => 'country',
	);

	/**
	 * @inheritDoc
	 */
	public function get_id(): string {
		return 'gravityforms';
	}

	/**
	 * @inheritDoc
	 */
	public function plugin_files(): array {
		return array( 'gravityforms/gravityforms.php' );
	}

	/**
	 * @inheritDoc
	 */
	public function get_label(): string {
		return __( 'Gravity Forms', 'vuloform' );
	}

	/**
	 * @inheritDoc
	 */
	protected function is_active() {
		return class_exists( 'GFAPI' );
	}

	/**
	 * @inheritDoc
	 */
	protected function shortcode_tags() {
		// `gravityforms` accepts this as an alias of the same shortcode.
		return array( 'gravityform', 'gravityforms' );
	}

	/**
	 * @inheritDoc
	 */
	public function list_available(): array {
		if ( ! $this->is_active() ) {
			return array();
		}

		// Both active and inactive forms, never trashed ones.
		$forms = (array) \GFAPI::get_forms( null, false );

		$available = array();

		foreach ( $forms as $form ) {
			$form = (array) $form;

			$available[] = array(
				'source_id'        => (int) ( $form['id'] ?? 0 ),
				'title'            => '' !== (string) ( $form['title'] ?? '' ) ? (string) $form['title'] : __( '(untitled form)', 'vuloform' ),
				'status'           => empty( $form['is_active'] ) ? 'draft' : 'publish',
				'field_count'      => count( (array) ( $form['fields'] ?? array() ) ),
				'already_migrated' => null !== $this->map->get( $this->get_id(), (int) ( $form['id'] ?? 0 ) ),
			);
		}

		return $available;
	}

	/**
	 * @param int|string $form_id          Gravity Forms form id.
	 * @param int|null   $existing_form_id A VuloForm form already created for this source form, if any (re-migrating with $overwrite).
	 * @param string[]   $errors           Compatibility notes, by reference.
	 * @return int VuloForm form id, or 0 on failure.
	 */
	protected function migrate_one( $form_id, ?int $existing_form_id, array &$errors ) {
		$form_id = (int) $form_id;
		$form    = \GFAPI::get_form( $form_id );

		if ( ! is_array( $form ) || empty( $form ) ) {
			$errors[] = sprintf(
				/* translators: %d: Gravity Forms form id. */
				__( 'Gravity Forms form #%d could not be read.', 'vuloform' ),
				$form_id
			);

			return 0;
		}

		$title  = '' !== (string) ( $form['title'] ?? '' ) ? (string) $form['title'] : __( 'Untitled form', 'vuloform' );
		$fields = array();

		foreach ( (array) ( $form['fields'] ?? array() ) as $raw_field ) {
			// A GF_Field object on some versions, a plain array on others - cast reads either.
			$field = $this->migrate_field( (array) $raw_field, $errors, $title );

			if ( $field ) {
				$fields[] = $field;
			}
		}

		$schema = array(
			'fields'   => $fields,
			'settings' => $this->migrate_settings( $form, $title, $errors ),
		);

		$status = empty( $form['is_active'] ) ? 'draft' : 'published';

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
	 * @param array  $raw    One Gravity Forms field.
	 * @param array  $errors Compatibility notes, by reference.
	 * @param string $title  Source form title, for error messages.
	 * @return array|null A VuloForm field, or null when the type has no equivalent.
	 */
	private function migrate_field( array $raw, array &$errors, string $title ): ?array {
		$gf_type = (string) ( $raw['type'] ?? '' );
		$type    = self::FIELD_TYPE_MAP[ $gf_type ] ?? null;

		// 'multiselect' has no close VuloForm equivalent, so it's intentionally left unmapped.
		if ( null === $type ) {
			$errors[] = sprintf(
				/* translators: 1: form title, 2: Gravity Forms field type. */
				__( '"%1$s": the "%2$s" field type is not supported yet and was skipped.', 'vuloform' ),
				$title,
				'' !== $gf_type ? $gf_type : __( '(unknown)', 'vuloform' )
			);

			return null;
		}

		$label = (string) ( $raw['label'] ?? '' );

		$field = array(
			'id'          => 'f_gf' . absint( $raw['id'] ?? 0 ),
			'type'        => $type,
			'label'       => $label,
			'description' => (string) ( $raw['description'] ?? '' ),
			'placeholder' => (string) ( $raw['placeholder'] ?? '' ),
			'required'    => ! empty( $raw['isRequired'] ),
			'default'     => (string) ( $raw['defaultValue'] ?? '' ),
		);

		if ( in_array( $type, array( 'select', 'radio', 'checkboxes' ), true ) ) {
			$field['options'] = array();

			foreach ( (array) ( $raw['choices'] ?? array() ) as $choice ) {
				$choice_label = (string) ( is_array( $choice ) ? ( $choice['text'] ?? '' ) : '' );
				$choice_value = (string) ( is_array( $choice ) ? ( $choice['value'] ?? '' ) : '' );

				if ( '' !== $choice_label ) {
					$field['options'][] = array(
						'label' => $choice_label,
						'value' => '' !== $choice_value ? $choice_value : $choice_label,
					);
				}
			}
		}

		if ( 'file' === $type ) {
			$extensions = array_filter( array_map( 'trim', explode( ',', (string) ( $raw['allowedExtensions'] ?? '' ) ) ) );

			if ( $extensions ) {
				$field['allowed_types'] = array_values( $extensions );
			}

			if ( isset( $raw['maxFileSize'] ) && (int) $raw['maxFileSize'] > 0 ) {
				$field['max_size_mb'] = (int) $raw['maxFileSize'];
			}
		}

		if ( 'consent' === $type ) {
			$field['consent_text'] = (string) ( $raw['description'] ?? ( $raw['checkboxLabel'] ?? $label ) );
		}

		if ( 'html' === $type ) {
			$field['content'] = (string) ( $raw['content'] ?? '' );
		}

		if ( 'name' === $type ) {
			$this->migrate_compound_parts( $field, $raw, self::NAME_INPUTS, array( 'first', 'last' ) );
		}

		if ( 'address' === $type ) {
			$this->migrate_compound_parts( $field, $raw, self::ADDRESS_INPUTS, array( 'line1', 'line2', 'city', 'state', 'zip', 'country' ) );
		}

		if ( ! empty( $raw['conditionalLogic'] ) ) {
			$errors[] = sprintf(
				/* translators: 1: form title, 2: field label. */
				__( '"%1$s": conditional logic on "%2$s" uses a different rule engine and was not migrated; rebuild it under this field\'s Logic tab.', 'vuloform' ),
				$title,
				$label
			);
		}

		return $field;
	}

	/**
	 * Fills `$field['parts']` for a Name/Address field, from Gravity Forms' own `{field_id}.{n}`
	 * sub-input numbering: present and not explicitly hidden keeps the part.
	 *
	 * @param array              $field    VuloForm field, modified in place.
	 * @param array              $raw      The Gravity Forms field.
	 * @param array<int, string> $map      Gravity Forms sub-input number => VuloForm part name.
	 * @param string[]           $fallback Every part, used when `inputs` is missing entirely.
	 * @return void
	 */
	private function migrate_compound_parts( array &$field, array $raw, array $map, array $fallback ): void {
		$inputs = (array) ( $raw['inputs'] ?? array() );

		if ( ! $inputs ) {
			$field['parts'] = $fallback;
			return;
		}

		$present = array();

		foreach ( $inputs as $input ) {
			$input  = (array) $input;
			$id     = (string) ( $input['id'] ?? '' );
			$dot_at = strpos( $id, '.' );

			if ( false === $dot_at || ! empty( $input['isHidden'] ) ) {
				continue;
			}

			$number = (int) substr( $id, $dot_at + 1 );

			if ( isset( $map[ $number ] ) ) {
				$present[] = $map[ $number ];
			}
		}

		$field['parts'] = $present ? $present : $fallback;
	}

	/**
	 * @param array    $form   The Gravity Forms form.
	 * @param string   $title  Source form title, for compatibility notes.
	 * @param string[] $errors Compatibility notes, by reference.
	 * @return array A VuloForm `settings` object (Schema::sanitize() rebuilds/validates it on save).
	 */
	private function migrate_settings( array $form, string $title, array &$errors ): array {
		$out = array();

		$confirmations = (array) ( $form['confirmations'] ?? array() );
		$confirmation  = reset( $confirmations );

		if ( is_array( $confirmation ) ) {
			$out['confirmation'] = array(
				'type'         => 'redirect' === ( $confirmation['type'] ?? '' ) ? 'redirect' : 'message',
				'message'      => (string) ( $confirmation['message'] ?? '' ),
				'redirect_url' => (string) ( $confirmation['url'] ?? '' ),
			);
		}

		// "Send To" can route to a field's answer, not just a fixed address - reported, not guessed at.
		if ( ! empty( $form['notifications'] ) ) {
			$errors[] = sprintf(
				/* translators: %s: form title. */
				__( '"%s": email notifications were found but could not be migrated automatically (Gravity Forms can route a notification to a field\'s answer, which has no safe automatic translation); add them again under this form\'s Notifications tab.', 'vuloform' ),
				$title
			);
		}

		return $out;
	}
}
