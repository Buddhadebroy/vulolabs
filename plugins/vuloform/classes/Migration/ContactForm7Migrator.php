<?php
/**
 * ContactForm7Migrator class file.
 *
 * @package VuloForm
 */

namespace VuloForm\Migration;

defined( 'ABSPATH' ) || exit;

/**
 * Imports forms from Contact Form 7. A form is a `wpcf7_contact_form` post; its fields live as
 * form-tags (`[text* your-name]`) in the `_form` postmeta, parsed with a tag scanner built from
 * CF7's own documented syntax. Mail settings come from `_mail` postmeta; CF7 has no redirect-on-
 * submit, so confirmations always migrate as a message. Safe to re-run, like the other migrators.
 */
class ContactForm7Migrator extends AbstractMigrator {

	const POST_TYPE     = 'wpcf7_contact_form';
	const META_FORM     = '_form';
	const META_MAIL     = '_mail';
	const META_MESSAGES = '_messages';

	/**
	 * CF7 form-tag type => VuloForm field type. `submit` is not a field and is skipped outright;
	 * `quiz` and the CAPTCHA tags (`captchac`/`captchar`, legacy `recaptcha`) have no VuloForm
	 * equivalent and are reported, not guessed at - see migrate_field().
	 *
	 * @var array<string, string>
	 */
	private const FIELD_TYPE_MAP = array(
		'text'       => 'text',
		'email'      => 'email',
		'url'        => 'url',
		'tel'        => 'phone',
		'number'     => 'number',
		'range'      => 'number',
		'date'       => 'date',
		'textarea'   => 'textarea',
		'select'     => 'select',
		'checkbox'   => 'checkboxes',
		'radio'      => 'radio',
		'acceptance' => 'consent',
		'file'       => 'file',
		'hidden'     => 'hidden',
	);

	/**
	 * Form-tag types that are never a migratable field (no error reported for these).
	 *
	 * @var string[]
	 */
	private const IGNORED_TYPES = array( 'submit' );

	/**
	 * @inheritDoc
	 */
	public function get_id(): string {
		return 'contact-form-7';
	}

	/**
	 * @inheritDoc
	 */
	public function plugin_files(): array {
		return array( 'contact-form-7/wp-contact-form-7.php' );
	}

	/**
	 * @inheritDoc
	 */
	public function get_label(): string {
		return __( 'Contact Form 7', 'vuloform' );
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
		// CF7's embed shortcode is `[contact-form-7 id="123" title="..."]`.
		return array( 'contact-form-7' );
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
			$tags = $this->scan_tags( (string) get_post_meta( $post->ID, self::META_FORM, true ) );

			$field_count = 0;

			foreach ( $tags as $tag ) {
				if ( ! in_array( $tag['type'], self::IGNORED_TYPES, true ) ) {
					++$field_count;
				}
			}

			$available[] = array(
				'source_id'        => $post->ID,
				'title'            => $post->post_title ? $post->post_title : __( '(untitled form)', 'vuloform' ),
				'status'           => $post->post_status,
				'field_count'      => $field_count,
				'already_migrated' => null !== self::map_get( $this->get_id(), $post->ID ),
			);
		}

		return $available;
	}

	/**
	 * @param int|string $post_id          CF7 form post id.
	 * @param int|null   $existing_form_id A VuloForm form already created for this source form, if any.
	 * @param string[]   $errors           Compatibility notes, by reference.
	 * @return int VuloForm form id, or 0 on failure.
	 */
	protected function migrate_one( $post_id, ?int $existing_form_id, array &$errors ) {
		$post_id = (int) $post_id;
		$post    = get_post( $post_id );

		if ( ! $post ) {
			$errors[] = sprintf(
				/* translators: %d: Contact Form 7 form id. */
				__( 'Contact Form 7 form #%d could not be read.', 'vuloform' ),
				$post_id
			);

			return 0;
		}

		$title  = $post->post_title ? $post->post_title : __( 'Untitled form', 'vuloform' );
		$tags   = $this->scan_tags( (string) get_post_meta( $post_id, self::META_FORM, true ) );
		$fields = array();

		foreach ( $tags as $tag ) {
			if ( in_array( $tag['type'], self::IGNORED_TYPES, true ) ) {
				continue;
			}

			$field = $this->migrate_field( $tag, $errors, (string) $title );

			if ( $field ) {
				$fields[] = $field;
			}
		}

		$schema = array(
			'fields'   => $fields,
			'settings' => $this->migrate_settings( $post_id ),
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
	 * @param array  $tag    One parsed form-tag, as returned by scan_tags().
	 * @param array  $errors Compatibility notes, by reference.
	 * @param string $title  Source form title, for error messages.
	 * @return array|null A VuloForm field, or null when the type has no equivalent.
	 */
	private function migrate_field( array $tag, array &$errors, string $title ): ?array {
		$cf7_type = $tag['type'];
		$type     = self::FIELD_TYPE_MAP[ $cf7_type ] ?? null;

		if ( null === $type ) {
			$errors[] = sprintf(
				/* translators: 1: form title, 2: CF7 form-tag type. */
				__( '"%1$s": the "%2$s" field type is not supported yet and was skipped.', 'vuloform' ),
				$title,
				$cf7_type
			);

			return null;
		}

		$values = $tag['values'];
		$atts   = $tag['atts'];
		$flags  = $tag['flags'];

		$field = array(
			'id'          => 'f_cf7' . sanitize_key( $tag['name'] ),
			'type'        => $type,
			'label'       => (string) ( $atts['label'] ?? $tag['name'] ),
			'description' => '',
			'placeholder' => (string) ( $atts['placeholder'] ?? ( in_array( $type, array( 'select', 'radio', 'checkboxes' ), true ) ? '' : ( $values[0] ?? '' ) ) ),
			'required'    => $tag['required'],
			'default'     => (string) ( $atts['default'] ?? '' ),
		);

		if ( in_array( $type, array( 'select', 'radio', 'checkboxes' ), true ) ) {
			$field['options'] = array();

			foreach ( $values as $value ) {
				if ( '' !== $value ) {
					$field['options'][] = array(
						'label' => $value,
						'value' => $value,
					);
				}
			}

			if ( 'select' === $type && in_array( 'multiple', $flags, true ) ) {
				$errors[] = sprintf(
					/* translators: 1: form title, 2: field name. */
					__( '"%1$s": the "%2$s" dropdown allows multiple selections in Contact Form 7; it migrated as a single-choice dropdown.', 'vuloform' ),
					$title,
					$tag['name']
				);
			}
		}

		if ( 'consent' === $type ) {
			// Acceptance tags show their checkbox label as the HTML *between* the opening and
			// closing `[acceptance]...[/acceptance]` pair, not as a tag attribute.
			$field['consent_text'] = '' !== $tag['content'] ? wp_strip_all_tags( $tag['content'] ) : $tag['name'];
		}

		if ( 'number' === $type ) {
			if ( isset( $atts['min'] ) ) {
				$field['min'] = $atts['min'];
			}

			if ( isset( $atts['max'] ) ) {
				$field['max'] = $atts['max'];
			}

			if ( 'range' === $cf7_type ) {
				$errors[] = sprintf(
					/* translators: 1: form title, 2: field name. */
					__( '"%1$s": the slider control on "%2$s" is not available in VuloForm; it migrated as a plain number field with the same min/max.', 'vuloform' ),
					$title,
					$tag['name']
				);
			}
		}

		return $field;
	}

	/**
	 * @param int $post_id CF7 form post id.
	 * @return array A VuloForm `settings` object (Schema::sanitize() rebuilds/validates it on save).
	 */
	private function migrate_settings( int $post_id ): array {
		$out = array();

		$mail = (array) get_post_meta( $post_id, self::META_MAIL, true );

		if ( $mail ) {
			$out['notifications'] = array(
				array(
					'id'      => 'cf7_notification_1',
					'name'    => __( 'Mail (1)', 'vuloform' ),
					'enabled' => ! isset( $mail['active'] ) || (bool) $mail['active'],
					'channel' => 'email',
					'to'      => (string) ( $mail['recipient'] ?? get_option( 'admin_email' ) ),
					'subject' => (string) ( $mail['subject'] ?? '' ),
					'message' => (string) ( $mail['body'] ?? '{all_fields}' ),
				),
			);
		}

		$messages = (array) get_post_meta( $post_id, self::META_MESSAGES, true );
		$sent_ok  = (string) ( $messages['mail_sent_ok'] ?? '' );

		if ( '' !== $sent_ok ) {
			// CF7 has no redirect-on-submit of its own, only an inline success message.
			$out['confirmation'] = array(
				'type'         => 'message',
				'message'      => $sent_ok,
				'redirect_url' => '',
			);
		}

		return $out;
	}

	/**
	 * Scans a CF7 form template for form-tags (`[type* name "value" key:value flag]`).
	 *
	 * @param string $form_template The `_form` postmeta value.
	 * @return array<int, array{type: string, required: bool, name: string, values: string[], atts: array<string, string>, flags: string[], content: string}>
	 */
	private function scan_tags( string $form_template ): array {
		$tags = array();

		if ( '' === trim( $form_template ) ) {
			return $tags;
		}

		preg_match_all(
			'/\[\s*([a-zA-Z][a-zA-Z0-9_-]*)(\*)?\s+([a-zA-Z0-9_-]+)((?:\s+(?:"[^"]*"|\'[^\']*\'|[^\s\]]+))*)\s*\](?:(.*?)\[\/\1\s*\])?/s',
			$form_template,
			$matches,
			PREG_SET_ORDER
		);

		foreach ( $matches as $match ) {
			$values = array();
			$atts   = array();
			$flags  = array();

			preg_match_all( '/"[^"]*"|\'[^\']*\'|\S+/', trim( $match[4] ), $tokens );

			foreach ( $tokens[0] as $token ) {
				if ( preg_match( '/^([a-zA-Z_][a-zA-Z0-9_-]*):(.*)$/s', $token, $kv ) ) {
					$atts[ $kv[1] ] = trim( $kv[2], "\"'" );
				} elseif ( preg_match( '/^(["\'])(.*)\1$/s', $token, $quoted ) ) {
					$values[] = $quoted[2];
				} else {
					$flags[] = $token;
				}
			}

			$tags[] = array(
				'type'     => strtolower( $match[1] ),
				'required' => '*' === $match[2],
				'name'     => $match[3],
				'values'   => $values,
				'atts'     => $atts,
				'flags'    => $flags,
				'content'  => isset( $match[5] ) ? trim( $match[5] ) : '',
			);
		}

		return $tags;
	}
}
