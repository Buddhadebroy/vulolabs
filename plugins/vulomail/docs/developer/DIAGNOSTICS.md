# Diagnostics

`VuloMail\Diagnostics\Diagnostics` (`classes/Diagnostics/Diagnostics.php`) backs **Tools → Diagnostics** through `GET /tools/diagnostics`. Checks are read-only: none of them changes a setting or sends a message.

## Result shape

```php
array(
	'id'      => 'sender_dns',
	'label'   => 'Sender domain DNS',
	'status'  => 'warning',          // good | warning | error | info
	'message' => 'What was found.',
	'fix'     => 'What to do about it.',
	'action'  => array( 'label' => 'Open Email settings', 'tab' => 'settings&subtab=email' ), // or 'url' => '...'; or null
)
```

Build one with `self::result()`, and an action with `self::to_tab()` or `self::to_url()`. A check may return `null` to say nothing.

## Checks

`run()` executes these in order. Each runs inside `try/catch \Throwable`, so one check that can't run on a given server is reported as an `info` row instead of taking the screen down.

| Id | Looks at |
|---|---|
| `email_routing` | Whether routing is on and which connections are primary and backup |
| `wp_mail` | Who actually handles `wp_mail()` on this site: VuloMail, another plugin, or WordPress's built-in mailer |
| `recent_email` | The delivery log, as evidence of whether email is really going out |
| `sender` | Whether a sender address is configured |
| `sender_dns` | SPF and DMARC TXT records of the sender domain |
| `other_mail_plugins` | Other active email delivery plugins (`MAIL_PLUGINS`) |
| `sms_routing` | Whether SMS is on and which gateways are in use |
| `connections` | Enabled connections with a missing required field or an undecryptable credential |
| `environment` | PHP, WordPress, OpenSSL |
| `log_table` | The log table exists; logging and retention state |
| `cron` | `DISABLE_WP_CRON` |

### DNS lookups

PHP's `dns_get_record()` has no timeout. `check_sender_dns()` therefore skips hosts with no dot and reserved development TLDs (`.test`, `.local`, `.localhost`, `.example`, `.invalid`, `.internal`, `.lan`), and caches a successful result for 10 minutes. DKIM can't be checked: the selector is only known to the email provider.

## Adding a check

```php
add_filter( 'vulomail_diagnostics', function ( $checks ) {
	$checks[] = array(
		'id'      => 'my_plugin',
		'label'   => 'My Plugin',
		'status'  => function_exists( 'vulomail_is_sms_ready' ) && vulomail_is_sms_ready() ? 'good' : 'warning',
		'message' => 'My Plugin sends its text messages through VuloMail.',
	);
	return $checks;
} );
```

A row without `id`, `label`, `status` and `message` is dropped.

VuloMail ships no check for any other plugin. A plugin that delivers through VuloMail adds its own row this way.
