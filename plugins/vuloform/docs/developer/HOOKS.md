# Hooks and public functions

Wait for `vuloform_loaded` before using any of this.

## Functions

```php
vuloform_render( int $form_id ): string        // HTML of a published form, '' otherwise
vuloform_get_form( int $form_id ): ?array      // id, title, status, schema
vuloform_get_submission( int $id ): ?array     // id, form_id, status, data, meta, created_at
```

## Actions

| Action | Arguments | When |
| --- | --- | --- |
| `vuloform_loaded` | none | Services are ready. |
| `vuloform_after_installed` | none | Tables were created or updated. |
| `vuloform_submission_created` | `$submission_id, $values, $form` | A submission was accepted (not spam). `$submission_id` is 0 when the form does not store submissions. |

```php
add_action( 'vuloform_submission_created', function ( $id, $values, $form ) {
	if ( 'Newsletter signup' === $form['title'] && ! empty( $values['email'] ) ) {
		my_list_subscribe( $values['email'] );
	}
}, 10, 3 );
```

## Filters

| Filter | Value | Other arguments |
| --- | --- | --- |
| `vuloform_field_types` | Field type definitions | |
| `vuloform_templates` | Form templates | |
| `vuloform_render_field` | HTML of one field | `$field, $form` |
| `vuloform_spam_check` | `[ 'verdict' => ok\|spam\|reject, 'message' => '' ]` | `$form, $post` |
| `vuloform_validate_field` | Error message, `''` when valid | `$field, $value, $values, $form` |
| `vuloform_submission_values` | Values about to be stored | `$form` |
| `vuloform_notification_email` | `to, subject, message, headers`, or `false` to cancel | `$notification, $form, $values` |
| `vuloform_webhook_payload` | Payload array | `$webhook, $form` |
| `vuloform_rest_controllers` | Controller instances by key | |
| `vuloform_submenus` | Admin submenu tabs | |
| `vuloform_module_sources` | Folders of extension modules: `path`, `namespace` | |
| `vuloform_sanitize_field` | A sanitized field | `$raw` |
| `vuloform_form_extensions` | Per-form extension settings, id => array | `$fields` |
| `vuloform_form_problems` | What stops a form being published | `$schema` |
| `vuloform_refuse_submission` | A message to refuse a submission before anything is stored, `''` to accept | `$form` |
| `vuloform_submission_result` | What an accepted submission answers with: `message`, `redirect`, ... | `$values, $form` |
| `vuloform_localize_data` | Data handed to the admin app | |

See [EXTENSIONS.md](EXTENSIONS.md) for how these fit together.

Reject a value:

```php
add_filter( 'vuloform_validate_field', function ( $error, $field, $value ) {
	if ( '' === $error && 'email' === $field['type'] && substr( (string) $value, -12 ) === '@example.com' ) {
		return __( 'Please use your work address.', 'my-plugin' );
	}
	return $error;
}, 10, 3 );
```

Plug in an anti-spam service:

```php
add_filter( 'vuloform_spam_check', function ( $verdict, $form, $post ) {
	if ( 'ok' === $verdict['verdict'] && my_service_says_spam( $post ) ) {
		$verdict['verdict'] = 'spam';
	}
	return $verdict;
}, 10, 3 );
```

## Email and SMS delivery

VuloForm calls `vulomail_send_email()` and `vulomail_send_sms()` when the VuloMail plugin is active and falls back to `wp_mail()` for email. Nothing needs configuring in VuloForm for that.
