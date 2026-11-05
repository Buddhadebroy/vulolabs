<?php
/**
 * FormidableMigrator class file.
 *
 * @package VuloForm
 */

namespace VuloForm\Migration;

defined( 'ABSPATH' ) || exit;

/**
 * Imports forms from Formidable Forms.
 *
 * Like Ninja Forms, Formidable keeps forms and fields in its own tables (`frm_forms`, `frm_fields`)
 * rather than as posts, so this migrator goes through its public API classes - `FrmForm::getAll()`
 * / `FrmField::get_all_for_form()` - instead of querying those tables directly. Formidable's DB
 * layer (`FrmDb`) auto (un)serializes the `options` column on a form and the `field_options` column
 * on a field, so both come back as plain arrays already.
 *
 * Two things below are not re-verified against every Formidable version the way the field-type map
 * is, the same honesty caveat as Forminator's notification format: the `success_action`/
 * `success_msg`/`success_url` keys read off a form's `options` for its confirmation, and whether
 * `FrmFormAction` (Formidable's own notification-actions API, added after email settings moved out
 * of `options` into separate `frm_form_actions` posts) is present to read notifications from - when
 * it isn't, notifications are reported rather than guessed at.
 *
 * Like the other migrators, this never touches the source form and is safe to re-run:
 * `MigrationMap` skips an already-migrated form unless `$overwrite` is set, in which case the
 * previously-created VuloForm form is updated in place.
 */
class FormidableMigrator extends AbstractMigrator {

	/**
	 * Formidable field type => VuloForm field type. `captcha` renders a CAPTCHA, not a data field,
	 * and is skipped outright - see migrate_field(). Types with no safe VuloForm equivalent (`rte`,
	 * `data`/`lookup`, `tag`, `user_id`, `password`, `scale`, `image`, `repeat`, and any Pro-only
	 * add-on field) are reported, not guessed at.
	 *
	 * @var array<string, string>
	 */
	private const FIELD_TYPE_MAP = array(
		'text'     => 'text',
		'textarea' => 'textarea',
		'email'    => 'email',
		'url'      => 'url',
		'phone'    => 'phone',
		'number'   => 'number',
		'select'   => 'select',
		'radio'    => 'radio',
		'checkbox' => 'checkboxes',
		'hidden'   => 'hidden',
		'date'     => 'date',
		'time'     => 'time',
		'file'     => 'file',
		'html'     => 'html',
		'divider'  => 'divider',
	);

	/**
	 * Field types that are never a migratable field (no error reported for these).
	 *
	 * @var string[]
	 */
	private const IGNORED_TYPES = array( 'captcha' );

	/**
	 * @inheritDoc
	 */
	public function get_id(): string {
		return 'formidable';
	}

	/**
	 * @inheritDoc
	 */
	public function plugin_files(): array {
		return array( 'formidable/formidable.php', 'formidable-pro/formidable-pro.php' );
	}

	/**
	 * @inheritDoc
	 */
	public function get_label(): string {
		return __( 'Formidable Forms', 'vuloform' );
	}

	/**
	 * @inheritDoc
	 */
	protected function is_active() {
		return class_exists( 'FrmForm' ) && class_exists( 'FrmField' );
	}

	/**
	 * @inheritDoc
	 */
	protected function shortcode_tags() {
		// Formidable's embed shortcode is `[formidable id="123"]` (also aliased `[display-frm-data]`
		// for views, which isn't a form embed and is left untouched).
		return array( 'formidable' );
	}

	/**
	 * @inheritDoc
	 */
	public function list_available(): array {
		if ( ! $this->is_active() ) {
			return array();
		}

		$available = array();

		foreach ( \FrmForm::getAll() as $form ) {
			if ( ! empty( $form->is_template ) || 'trash' === ( $form->status ?? '' ) ) {
				continue;
			}

			$form_id = (int) $form->id;

			$available[] = array(
				'source_id'        => $form_id,
				'title'            => $form->name ? $form->name : __( '(untitled form)', 'vuloform' ),
				'status'           => 'draft' === ( $form->status ?? '' ) ? 'draft' : 'publish',
				'field_count'      => count( \FrmField::get_all_for_form( $form_id ) ),
				'already_migrated' => null !== $this->map->get( $this->get_id(), $form_id ),
			);
		}

		return $available;
	}

	/**
	 * @param int|string $form_id          Formidable form id.
	 * @param int|null   $existing_form_id A VuloForm form already created for this source form, if any.
	 * @param string[]   $errors           Compatibility notes, by reference.
	 * @return int VuloForm form id, or 0 on failure.
	 */
	protected function migrate_one( $form_id, ?int $existing_form_id, array &$errors ) {
		$form_id = (int) $form_id;
		$form    = \FrmForm::getOne( $form_id );

		if ( ! $form ) {
			$errors[] = sprintf(
				/* translators: %d: Formidable form id. */
				__( 'Formidable form #%d could not be read.', 'vuloform' ),
				$form_id
			);

			return 0;
		}

		$title  = $form->name ? $form->name : __( 'Untitled form', 'vuloform' );
		$fields = array();

		foreach ( \FrmField::get_all_for_form( $form_id ) as $raw_field ) {
			$field = $this->migrate_field( $raw_field, $errors, (string) $title );

			if ( $field ) {
				$fields[] = $field;
			}
		}

		$schema = array(
			'fields'   => $fields,
			'settings' => $this->migrate_settings( $form_id, (array) ( $form->options ?? array() ), (string) $title, $errors ),
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
	 * @param object   $raw    One Formidable field, as returned by FrmField::get_all_for_form().
	 * @param string[] $errors Compatibility notes, by reference.
	 * @param string   $title  Source form title, for error messages.
	 * @return array|null A VuloForm field, or null when the type has no equivalent or isn't a field.
	 */
	private function migrate_field( $raw, array &$errors, string $title ): ?array {
		$frm_type = (string) $raw->type;

		if ( in_array( $frm_type, self::IGNORED_TYPES, true ) ) {
			return null;
		}

		$type = self::FIELD_TYPE_MAP[ $frm_type ] ?? null;

		if ( null === $type ) {
			$errors[] = sprintf(
				/* translators: 1: form title, 2: Formidable field type. */
				__( '"%1$s": the "%2$s" field type is not supported yet and was skipped.', 'vuloform' ),
				$title,
				$frm_type
			);

			return null;
		}

		$options = (array) ( $raw->field_options ?? array() );
		$label   = (string) $raw->name;

		$field = array(
			'id'          => 'f_frd' . sanitize_key( (string) $raw->field_key ),
			'type'        => $type,
			'label'       => $label,
			'description' => (string) $raw->description,
			'placeholder' => (string) ( $options['placeholder'] ?? '' ),
			'required'    => ! empty( $options['required'] ),
			'default'     => (string) $raw->default_value,
		);

		if ( in_array( $type, array( 'select', 'radio', 'checkboxes' ), true ) ) {
			$field['options'] = array();

			foreach ( (array) ( $options['options'] ?? array() ) as $option ) {
				$option_label = (string) ( is_array( $option ) ? ( $option['label'] ?? '' ) : $option );
				$option_value = (string) ( is_array( $option ) ? ( $option['value'] ?? $option_label ) : $option_label );

				if ( '' !== $option_label ) {
					$field['options'][] = array(
						'label' => $option_label,
						'value' => $option_value,
					);
				}
			}
		}

		if ( 'html' === $type ) {
			$field['content'] = (string) ( $options['custom_html'] ?? $raw->description );
		}

		return $field;
	}

	/**
	 * @param int      $form_id Formidable form id.
	 * @param array    $options Form's `options` array.
	 * @param string   $title   Source form title, for compatibility notes.
	 * @param string[] $errors  Compatibility notes, by reference.
	 * @return array A VuloForm `settings` object (Schema::sanitize() rebuilds/validates it on save).
	 */
	private function migrate_settings( int $form_id, array $options, string $title, array &$errors ): array {
		$out = array();

		$success_action = (string) ( $options['success_action'] ?? 'message' );

		if ( 'redirect' === $success_action && ! empty( $options['success_url'] ) ) {
			$out['confirmation'] = array(
				'type'         => 'redirect',
				'message'      => '',
				'redirect_url' => (string) $options['success_url'],
			);
		} elseif ( ! empty( $options['success_msg'] ) ) {
			$out['confirmation'] = array(
				'type'         => 'message',
				'message'      => (string) $options['success_msg'],
				'redirect_url' => '',
			);
		}

		if ( class_exists( '\FrmFormAction' ) && method_exists( '\FrmFormAction', 'get_action_for_form' ) ) {
			$actions = \FrmFormAction::get_action_for_form( $form_id, 'email' );

			foreach ( (array) $actions as $index => $action ) {
				$settings = (array) ( $action->post_content ?? array() );

				$out['notifications'][] = array(
					'id'      => 'frd_notification_' . $index,
					'name'    => (string) ( $action->post_title ?? '' ),
					'enabled' => 'publish' === ( $action->post_status ?? 'publish' ),
					'channel' => 'email',
					'to'      => (string) ( $settings['email_to'] ?? get_option( 'admin_email' ) ),
					'subject' => (string) ( $settings['email_subject'] ?? '' ),
					'message' => (string) ( $settings['email_message'] ?? '{all_fields}' ),
				);
			}
		} else {
			$errors[] = sprintf(
				/* translators: %s: form title. */
				__( '"%s": email notifications could not be read from this Formidable version and were not migrated; add them again under this form\'s Notifications tab.', 'vuloform' ),
				$title
			);
		}

		return $out;
	}
}
