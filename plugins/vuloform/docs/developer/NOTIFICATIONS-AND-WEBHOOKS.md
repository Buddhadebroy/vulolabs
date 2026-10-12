# Notifications and webhooks

Both listen to `vuloform_submission_created`.

## Email

`Notifications\Notifier::send_email()` builds a plain-text email from the notification's `to`, `subject` and `message`, with placeholders filled by `Submissions\Formatter::fill()`:

`{field_key}`, `{all_fields}`, `{form_title}`, `{site_name}`.

- `to` may contain addresses and `{field_key}` placeholders. That is how a confirmation reaches the person who filled in the form. Every resolved address is validated and at most ten are used (`Notifier::MAX_RECIPIENTS`), so a field filled in by a visitor can't turn a notification into a mass mailing. The same cap applies to SMS numbers.
- Line breaks are stripped from the subject and from header values.
- `reply_to` names an email field of the form.
- The `vuloform_notification_email` filter can change the email or return `false` to cancel it.

If the VuloMail plugin is active the email is handed to `vulomail_send_email()`, otherwise to `wp_mail()`. Either way the recorded status is `handed_off`: VuloForm knows the message was accepted for sending, not that it arrived.

## SMS

A notification's `channel` is `email`, `sms` or `both`. With `both`, `to`, `subject` and `message` are the email's, and `sms_to` and `sms_message` are the text message's; `Notifier::send_all()` sends each and records one event per channel.

SMS is only possible through VuloMail with an SMS connection (`vulomail_is_sms_ready()`), using `vulomail_send_sms()`. Without it the notification is recorded as `skipped`. VuloForm contains no SMS gateway code.

## Webhooks

A webhook posts the submission as JSON to an `https://` URL:

```json
{
  "form_id": 12,
  "form_title": "Contact",
  "submission_id": 37,
  "submitted_at": "2026-10-09T18:45:29+00:00",
  "fields": { "full_name": "Ada Lovelace", "email": "ada@example.com" }
}
```

`fields` holds display values. A file field sends file names, never the files. A webhook can be limited to chosen fields. `vuloform_webhook_payload` filters the payload.

Headers:

- `X-VuloForm-Delivery`: `{submission_id}-{webhook_id}`, identical on every attempt, so the receiver can ignore a repeat.
- `X-VuloForm-Signature`: `sha256=` + HMAC-SHA256 of the raw body with the webhook's secret. Only sent when a secret is set.

Verifying in PHP:

```php
$expected = 'sha256=' . hash_hmac( 'sha256', $raw_body, $secret );
$valid    = hash_equals( $expected, $_SERVER['HTTP_X_VULOFORM_SIGNATURE'] ?? '' );
```

### Delivery

Delivery never delays the visitor. Each webhook is a WP-Cron single event (`vuloform_send_webhook`) with the submission id, webhook id and attempt number.

- Timeout 8 seconds, no redirects followed.
- 2xx is `delivered`.
- A network error, 5xx or 429 is retried: after 5 minutes, then after 30 minutes. Three attempts in total, then `failed`.
- Any other status is `failed` at once.

Each attempt is appended to the submission's `meta.events` with a status and a short reason. The response body and the secret are never recorded.

### Allowed destinations

`Webhooks::url_problem()` is checked when the webhook is sent, not only when it is saved. It refuses anything that is not `https`, URLs with credentials, hosts that do not resolve, and hosts that resolve to a private, loopback, link-local or reserved address (including the site's own server). The request then goes through `wp_safe_remote_post()`.
