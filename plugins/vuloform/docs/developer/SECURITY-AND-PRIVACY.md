# Security and privacy

## Access

- Every admin screen and private REST route requires `manage_options`. REST requests carry the WordPress REST nonce.
- Public routes are limited to: get a token, submit a published form, load a published form for embedding.
- A draft is indistinguishable from a missing form.

## Input

- Form definitions are rebuilt from scratch on save (`Schema::sanitize`); see [FORM-SCHEMA.md](FORM-SCHEMA.md).
- Submitted values are sanitized per field type and validated on the server, including option lists, number ranges and lengths. Hidden conditional fields are discarded. Calculations are recomputed.
- All database access uses `$wpdb->prepare()` or `$wpdb->insert/update/delete`.
- All output is escaped at the point of output. The confirmation message is HTML written by the administrator (`wp_kses_post`); values typed by the visitor are escaped before they are placed in it.

## Specific threats

| Threat | Handling |
| --- | --- |
| Cross-site request forgery on admin actions | REST nonce + capability |
| Spam and flooding | Signed token, honeypot, minimum time, per-visitor rate limit |
| Malicious uploads | Allow-list of types, content check, double-extension check, random names, protected folder, downloads only through an authenticated route |
| Server-side request forgery through webhooks | `https` only, no credentials, resolved address must be public, no redirects, checked at send time |
| Email header injection | Line breaks removed from subject and headers; addresses validated |
| CSV formula injection | Risky leading characters are neutralised on export |
| Leaking data through the public API | The submit response contains no submission id or stored data |
| Secrets in logs | Webhook secrets and response bodies are never recorded |

## Known limits

- **Uploads on nginx.** The `.htaccess` guard only works on Apache and LiteSpeed. On nginx an uploaded file can be fetched by anyone who knows its URL. The URL contains 52 random characters and is never shown to visitors, but a server rule denying `/wp-content/uploads/vuloform/` is recommended.
- **DNS rebinding.** The webhook destination is resolved and checked just before the request, and WordPress resolves it again when sending. A hostile DNS server could answer differently the second time.
- **Hidden fields** hold whatever the browser sends. Do not use one for anything that must be trusted.
- **Rate limiting behind a proxy.** The limit uses `REMOTE_ADDR`. If the site is behind a proxy that does not pass the real address to PHP, all visitors share one allowance.

## Privacy

- No telemetry, no external requests except the webhooks and email an administrator configures.
- IP addresses are not stored unless Settings switches that on.
- The rate limit stores a keyed hash of the address for one minute, not the address.
- A retention period can delete old submissions automatically.
- `Security\Privacy` registers a personal data exporter and eraser with WordPress (Tools > Export Personal Data / Erase Personal Data). They match submissions sent by the WordPress user with that email address while logged in, and submissions in which the address appears in any answer. The eraser deletes the matching submissions and their uploaded files.
- Suggested privacy policy text is added to the WordPress privacy policy guide.

VuloForm provides these tools. Whether a site complies with GDPR or another law depends on how the site owner uses them.
