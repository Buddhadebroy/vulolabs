# Connections and Security

## Classes

| Class | File | What it does |
|---|---|---|
| `ProviderRegistry` | `classes/Connections/ProviderRegistry.php` | Knows which adapter classes exist per channel; returns their field schemas; builds an adapter from a connection |
| `ConnectionRepository` | `classes/Connections/ConnectionRepository.php` | Stores connections in one option; encrypts secret fields; validates input; masks for display |
| `Secrets` | `classes/Security/Secrets.php` | Encrypts and decrypts credentials; masks them |
| `Redactor` | `classes/Security/Redactor.php` | Scrubs credentials out of error text; masks emails and phone numbers |
| `HttpClient` | `classes/Security/HttpClient.php` | The one place adapters make outbound HTTP requests from |

## 1. Providers

`ProviderRegistry::classes( $channel )` returns `provider id => class`, after the `vulomail_email_providers` or `vulomail_sms_providers` filter. A class that doesn't exist or doesn't implement the channel's interface is dropped.

Each adapter describes itself through a static `definition()`:

```php
array(
	'label'  => 'Mailgun',
	'desc'   => 'Mailgun transactional email API.',
	'fields' => array(
		array( 'key' => 'api_key', 'label' => 'API key', 'type' => 'password', 'secret' => true, 'required' => true ),
		array( 'key' => 'region', 'label' => 'Region', 'type' => 'select', 'default' => 'us', 'options' => array( ... ) ),
	),
)
```

Field types: `text`, `password`, `number`, `select`, `toggle`. Optional keys: `required`, `secret`, `default`, `options`, `help`, `show_if` (`array( 'auth' => true )`: the field only applies, and is only required, while that other field has that value).

The definitions are sent to the admin app in `vulomailAppLocalizer.providers`, and the connection form is generated from them. Adding a provider needs no JavaScript.

## 2. Connections

Stored in the `vulomail_connections` option (not autoloaded) as `id => record`:

```php
array(
	'id'       => 'cab12cd34ef',
	'channel'  => 'email',          // or 'sms'
	'provider' => 'mailgun',
	'label'    => 'Main',
	'enabled'  => true,
	'settings' => array( 'api_key' => 'vm1:...', 'domain' => 'mg.example.com', 'region' => 'eu' ),
)
```

Which connection is used is not part of the record: the settings `email_primary`, `email_backup`, `sms_primary` and `sms_backup` hold connection ids.

| Method | Purpose |
|---|---|
| `save( array $input )` | Create or update. Validates every field against the schema; returns the record or a `WP_Error` |
| `config( $connection )` | Settings with secrets decrypted, ready for an adapter |
| `missing_fields( $connection )` | Labels of required fields that are empty, or whose secret can't be decrypted |
| `is_usable( $connection )` | Enabled and nothing missing |
| `for_display( $connection )` | The shape REST returns: secrets replaced by a mask |
| `delete( $id )` | Remove |

Rules in `save()`:

- **Channel and provider are fixed** once a connection exists; its stored secrets belong to them.
- **A secret left empty, or still holding its mask, keeps the stored value.** The browser never has the real secret to send back.
- **No line breaks in any stored value.** Several end up in SMTP commands or HTTP headers.
- A `select` value must be one of its options.

Email connections are not put into use when saved: the WordPress mailer stays the default until the site owner sets a primary. The first SMS connection does become the primary, because SMS has no default to fall back on (`Rest\Connections::save_item()`). Deleting a primary promotes the backup.

## 3. Encryption at rest

`Secrets::encrypt()` uses `sodium_crypto_secretbox` with a random nonce; stored values look like `vm1:<base64(nonce . ciphertext)>`.

The key is `sha256( secret . '|' . material )`, where:

- `material` is a random value generated once and stored in the `vulomail_key_material` option;
- `secret` is the `VULOMAIL_ENCRYPTION_KEY` constant if defined in `wp-config.php`, otherwise `wp_salt( 'auth' )`.

So neither a database dump nor the config file alone is enough to read a credential.

**Consequence:** if the site's salts change (or the constant does), `decrypt()` returns `''`, the connection reports its secret fields as missing, and the credential must be entered again. Diagnostics reports this.

`Secrets::mask()` returns eight bullets plus the last four characters, or bullets only for a secret of eight characters or fewer.

## 4. Outbound HTTP

`HttpClient::post()`:

- refuses any URL that isn't `https`;
- sets `redirection => 0`, because a redirect would forward the credential to another host;
- uses `wp_safe_remote_request()`, which refuses private and loopback addresses;
- times out after 15 seconds (`vulomail_http_timeout`).

Endpoints are constants in each adapter. Where an account identifier becomes part of the URL (Mailgun domain, Twilio Account SID, Plivo Auth ID) the adapter validates its format first.

SMTP is the exception: the host is whatever the site owner entered.

## 5. Error text

Provider responses can echo a credential. `Redactor::scrub( $text, $secrets )` removes the adapter's known secret values verbatim, then `Authorization` headers and `api_key=`/`token=`/`password=`-style pairs, then HTML. Adapters run every error through it before it reaches a `Result`, and from there the log and the screen.

## 6. Access control

- Every REST route requires `manage_options` (`Rest\Controller::check_permission()`). Core's REST cookie authentication verifies the `wp_rest` nonce before the permission callback runs.
- The admin page is registered with the same capability.
- Logged message bodies are shown as text in a `<pre>`, never rendered as HTML.
- Values passed to zyra props that render HTML go through `escapeHtml()` (`src/services/types.ts`).
