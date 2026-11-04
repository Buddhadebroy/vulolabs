<?php
/**
 * WpFormsMigrator class file.
 *
 * @package VuloForm
 */

namespace VuloForm\Migration;

defined( 'ABSPATH' ) || exit;

/**
 * Imports forms from WPForms (Lite or Pro - both use the same storage).
 *
 * WPForms stores a form as a `wpforms` post; its definition is JSON in `post_content`
 * (`wpforms_decode()`/`wpforms_encode()`), shaped `{field_id, fields: {id => field}, settings:
 * {...}, meta: {...}}` - confirmed against `includes/class-form.php` and the field classes under
 * `includes/fields/` in the public wpforms-lite source (plugins.svn.wordpress.org/wpforms-lite).
 * Nothing here reads WPForms' entries tables; only the form definition is migrated, never
 * submissions.
 *
 * `migrate()` never touches the source form, and only ever creates VuloForm forms - it is safe to
 * run repeatedly: `MigrationMap` skips a source form already migrated unless `$overwrite` is set,
 * in which case the previously-created VuloForm form is updated in place rather than duplicated.
 */
class WpFormsMigrator implements MigratorInterface {

	const POST_TYPE = 'wpforms';

	/**
	 * WPForms field type => VuloForm field type, for every type WPForms Lite's own `includes/fields/`
	 * folder defines. Types with no VuloForm equivalent (currently none in Lite) are reported, not
	 * dropped - see migrate_field().
	 *
	 * @var array<string, string>
	 */
	private const FIELD_TYPE_MAP = array(
		'text'                 => 'text',
		'textarea'             => 'textarea',
		'email'                => 'email',
		'number'               => 'number',
		'number-slider'        => 'number',
		'select'               => 'select',
		'radio'                => 'radio',
		'checkbox'             => 'checkboxes',
		'gdpr-checkbox'        => 'consent',
		'name'                 => 'name',
		'internal-information' => 'html',
	);

	/**
	 * @var MigrationMap
	 */
	private $map;

	public function __construct() {
		$this->map = new MigrationMap();
	}

	/**
	 * @inheritDoc
	 */
	public function get_id(): string {
		return 'wpforms';
	}

	/**
	 * @inheritDoc
	 */
	public function get_label(): string {
		return __( 'WPForms', 'vuloform' );
	}

	/**
	 * @inheritDoc
	 */
	public function list_available(): array {
		if ( ! post_type_exists( self::POST_TYPE ) ) {
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
			$data = $this->decode( $post->post_content );

			$available[] = array(
				'source_id'        => $post->ID,
				'title'            => $post->post_title ? $post->post_title : __( '(untitled form)', 'vuloform' ),
				'status'           => $post->post_status,
				'field_count'      => $data ? count( (array) ( $data['fields'] ?? array() ) ) : 0,
				'already_migrated' => null !== $this->map->get( $this->get_id(), $post->ID ),
			);
		}

		return $available;
	}

	/**
	 * @inheritDoc
	 */
	public function migrate( array $source_ids = array(), bool $overwrite = false ): array {
		$migrated = 0;
		$skipped  = 0;
		$errors   = array();

		if ( ! post_type_exists( self::POST_TYPE ) ) {
			return array(
				'migrated'           => 0,
				'skipped'            => 0,
				'errors'             => array( __( 'WPForms is not installed, so there is nothing to migrate.', 'vuloform' ) ),
				'posts_updated'      => 0,
				'references_updated' => 0,
			);
		}

		foreach ( $this->list_available() as $row ) {
			$source_id = $row['source_id'];

			if ( $source_ids && ! in_array( $source_id, $source_ids, true ) ) {
				continue;
			}

			$existing_form_id = $this->map->get( $this->get_id(), $source_id );

			if ( $existing_form_id && ! $overwrite ) {
				++$skipped;
				continue;
			}

			try {
				$form_id = $this->migrate_one( (int) $source_id, $existing_form_id, $errors );

				if ( $form_id ) {
					$this->map->record( $this->get_id(), $source_id, $form_id );
					++$migrated;
				} else {
					$errors[] = sprintf(
						/* translators: %s: WPForms form id. */
						__( 'WPForms form #%s could not be created in VuloForm.', 'vuloform' ),
						$source_id
					);
				}
			} catch ( \Throwable $e ) {
				$errors[] = sprintf(
					/* translators: 1: WPForms form id, 2: error message. */
					__( 'WPForms form #%1$s: %2$s', 'vuloform' ),
					$source_id,
					$e->getMessage()
				);
			}
		}

		$shortcodes = $this->replace_shortcodes();

		return array(
			'migrated'           => $migrated,
			'skipped'            => $skipped,
			'errors'             => $errors,
			'posts_updated'      => $shortcodes['posts_updated'],
			'references_updated' => $shortcodes['references_updated'],
		);
	}

	/**
	 * Replaces `[wpforms id="N"]` with `[vuloform id="M"]` wherever N has a known mapping - every
	 * form ever migrated, not just this run's, so a retry also catches references that were added
	 * (or left unresolved) since an earlier migration.
	 *
	 * @return array{posts_updated: int, references_updated: int}
	 */
	private function replace_shortcodes(): array {
		$id_map = array();

		foreach ( $this->list_available() as $row ) {
			$form_id = $this->map->get( $this->get_id(), $row['source_id'] );

			if ( $form_id ) {
				$id_map[ (string) $row['source_id'] ] = $form_id;
			}
		}

		return ( new ShortcodeReplacer() )->replace( 'wpforms', 'id', $id_map );
	}

	/**
	 * @param int        $post_id          WPForms form post id.
	 * @param int|null   $existing_form_id A VuloForm form already created for this source form, if any (re-migrating with $overwrite).
	 * @param string[]   $errors           Compatibility notes, by reference.
	 * @return int VuloForm form id, or 0 on failure.
	 */
	private function migrate_one( int $post_id, ?int $existing_form_id, array &$errors ): int {
		$post = get_post( $post_id );
		$data = $post ? $this->decode( $post->post_content ) : null;

		if ( ! $post || ! $data ) {
			$errors[] = sprintf(
				/* translators: %d: WPForms form id. */
				__( 'WPForms form #%d could not be read.', 'vuloform' ),
				$post_id
			);

			return 0;
		}

		$title    = $post->post_title ? $post->post_title : __( 'Untitled form', 'vuloform' );
		$settings = (array) ( $data['settings'] ?? array() );
		$fields   = array();

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
			'settings' => $this->migrate_settings( $settings, $fields ),
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
	 * @param array  $raw     One WPForms field.
	 * @param array  $errors  Compatibility notes, by reference.
	 * @param string $title   Source form title, for error messages.
	 * @return array|null A VuloForm field, or null when the type has no equivalent.
	 */
	private function migrate_field( array $raw, array &$errors, string $title ): ?array {
		$wpforms_type = (string) ( $raw['type'] ?? '' );
		$type         = self::FIELD_TYPE_MAP[ $wpforms_type ] ?? null;

		if ( null === $type ) {
			$errors[] = sprintf(
				/* translators: 1: form title, 2: WPForms field type. */
				__( '"%1$s": the "%2$s" field type is not supported yet and was skipped.', 'vuloform' ),
				$title,
				$wpforms_type
			);

			return null;
		}

		$field = array(
			'id'          => 'f_wpf' . absint( $raw['id'] ?? 0 ),
			'type'        => $type,
			'label'       => (string) ( $raw['label'] ?? '' ),
			'description' => (string) ( $raw['description'] ?? '' ),
			'placeholder' => (string) ( $raw['placeholder'] ?? '' ),
			'required'    => ! empty( $raw['required'] ),
			'default'     => (string) ( $raw['default_value'] ?? '' ),
		);

		if ( in_array( $type, array( 'select', 'radio', 'checkboxes' ), true ) ) {
			$field['options'] = array();

			foreach ( (array) ( $raw['choices'] ?? array() ) as $choice ) {
				$label = (string) ( $choice['label'] ?? '' );

				if ( '' !== $label ) {
					$field['options'][] = array(
						'label' => $label,
						'value' => $label,
					);
				}
			}
		}

		if ( 'number' === $type ) {
			if ( isset( $raw['min'] ) ) {
				$field['min'] = $raw['min'];
			}

			if ( isset( $raw['max'] ) ) {
				$field['max'] = $raw['max'];
			}

			if ( 'number-slider' === $wpforms_type && isset( $raw['step'] ) ) {
				$field['step'] = $raw['step'];

				$errors[] = sprintf(
					/* translators: 1: form title, 2: field label. */
					__( '"%1$s": the slider control on "%2$s" is not available in VuloForm; it migrated as a plain number field with the same min/max/step.', 'vuloform' ),
					$title,
					$field['label']
				);
			}
		}

		if ( 'text' === $type || 'textarea' === $type ) {
			if ( ! empty( $raw['limit_enabled'] ) && 'characters' === ( $raw['limit_mode'] ?? '' ) ) {
				$field['maxlength'] = absint( $raw['limit_count'] ?? 0 );
			} elseif ( ! empty( $raw['limit_enabled'] ) ) {
				$errors[] = sprintf(
					/* translators: 1: form title, 2: field label. */
					__( '"%1$s": the word limit on "%2$s" is not supported; only character limits migrate.', 'vuloform' ),
					$title,
					$field['label']
				);
			}
		}

		if ( 'consent' === $type ) {
			$field['consent_text'] = (string) ( $raw['description'] ?? $field['label'] );
		}

		if ( 'name' === $type ) {
			$format = (string) ( $raw['format'] ?? 'first-last' );

			$field['parts'] = 'simple' === $format ? array( 'first' ) : array( 'first', 'last' );

			if ( 'first-middle-last' === $format ) {
				$errors[] = sprintf(
					/* translators: 1: form title, 2: field label. */
					__( '"%1$s": the middle-name part of "%2$s" is not supported; the field migrated with first/last name only.', 'vuloform' ),
					$title,
					$field['label']
				);
			}
		}

		if ( 'html' === $type ) {
			$field['content'] = (string) ( $raw['content'] ?? '' );
		}

		return $field;
	}

	/**
	 * @param array $settings WPForms `settings` object.
	 * @param array $fields   Already-migrated VuloForm fields, so notifications can be pointed at a real field key.
	 * @return array A VuloForm `settings` object (Schema::sanitize() rebuilds/validates it on save).
	 */
	private function migrate_settings( array $settings, array $fields ): array {
		$out = array();

		if ( ! empty( $settings['submit_text'] ) ) {
			$out['submit_label'] = (string) $settings['submit_text'];
		}

		$confirmations = (array) ( $settings['confirmations'] ?? array() );
		$confirmation  = reset( $confirmations );

		if ( is_array( $confirmation ) ) {
			$out['confirmation'] = array(
				'type'         => 'redirect' === ( $confirmation['type'] ?? '' ) ? 'redirect' : 'message',
				'message'      => (string) ( $confirmation['message'] ?? '' ),
				'redirect_url' => (string) ( $confirmation['redirect_url'] ?? '' ),
			);
		}

		$notifications = (array) ( $settings['notifications'] ?? array() );

		if ( ! empty( $settings['notification_enable'] ) || $notifications ) {
			$out['notifications'] = array();

			foreach ( $notifications as $index => $item ) {
				if ( ! is_array( $item ) ) {
					continue;
				}

				$out['notifications'][] = array(
					'id'      => 'wpf_notification_' . $index,
					'name'    => (string) ( $item['notification_name'] ?? '' ),
					'enabled' => true,
					'channel' => 'email',
					'to'      => (string) ( $item['email'] ?? get_option( 'admin_email' ) ),
					'subject' => (string) ( $item['subject'] ?? '' ),
					'message' => (string) ( $item['message'] ?? '{all_fields}' ),
				);
			}
		}

		return $out;
	}

	/**
	 * @param string $post_content A `wpforms` post's content.
	 * @return array|null Decoded form data, or null when it is not valid JSON.
	 */
	private function decode( string $post_content ): ?array {
		$data = json_decode( $post_content, true );

		return is_array( $data ) ? $data : null;
	}
}
