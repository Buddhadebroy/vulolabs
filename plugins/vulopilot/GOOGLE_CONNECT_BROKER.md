# Google Connect broker — contract with VuloCloud (v2, per-Organization)

`VuloPilot\Services\GoogleServicesConnection` (this plugin) routes
"Connect Google Services" through a VuloCloud-hosted broker instead of
talking to `accounts.google.com` directly, once both
`VULOPILOT_GOOGLE_BROKER_URL` **and** `VULOPILOT_GOOGLE_APPLICATION_ID`
are set (`config.php`). This is the same shape RankMath's own Google
Connect uses, and is the real fix for the "Redirect URI scaling"
trade-off documented in that same file: Google OAuth Clients only
accept a fixed, pre-registered allowlist of redirect URIs, and with the
embedded shared Client (`VULOPILOT_GOOGLE_CLIENT_ID`/`SECRET`), only
domains someone has manually added to that Client's allowlist in Google
Cloud Console can complete the handshake. With a broker, Google only
ever sees VuloCloud's own single, permanently-registered redirect URI —
any customer domain works with zero manual allowlisting.

**Status: implemented on both sides.** VuloCloud's server side lives in
`contexts/google-connect` (see that repo's `GOOGLE_CONNECT_INTEGRATION.md`
for the full server-side writeup); this document is this plugin's own
copy of the same contract, kept for the WordPress-side implementers
(`GoogleServicesConnection`, `GoogleOAuthBrokerClient`,
`GoogleSearchConsoleOAuthCallbackHandler`) who don't have the VuloCloud
repo open.

## What changed from v1

v1 (this file's earlier draft) assumed **one** VuloCloud-wide Google
Cloud OAuth Client shared by every VuloLabs customer. v2 is
per-**Organization** instead: each VuloLabs reseller/brand
(`Organization` in VuloCloud) registers and owns its own Google Cloud
OAuth Client via VuloCloud's organization panel ("Google Connect" tab),
the same way it already owns its own Stripe/PayPal/SES credentials.
Concretely, that means every broker request now also carries this
site's own registered `LicenseApplication` id
(`VULOPILOT_GOOGLE_APPLICATION_ID`) — the same id already used for
license validation — so VuloCloud knows *which* Organization's Google
Client to use. All request field names are also now **camelCase**
(matching this plugin's existing license-validation request contract);
response bodies stay snake_case (`access_token`/`refresh_token`/
`expires_in`) since that matches OAuth2's own RFC 6749 §5.1, not this
plugin's usual convention — deliberate, documented at both ends.

## Actors and the full round trip

1. A site owner clicks "Connect Google Services" on their WordPress
   install (`vulopilot`). Their browser navigates to VuloCloud:
   `GET {VULOPILOT_GOOGLE_BROKER_URL}/plugin/google/authorize`.
2. VuloCloud resolves `applicationId` → the owning Organization → that
   Organization's own registered Google Cloud OAuth Client, then 302s
   the browser to `https://accounts.google.com/o/oauth2/v2/auth` using
   that Client's ID and VuloCloud's **own** fixed `redirect_uri` (the
   only one ever registered in Google Cloud Console, shared across
   every Organization).
3. The site owner consents on Google's real consent screen.
4. Google redirects back to VuloCloud's fixed callback with a `code`.
5. VuloCloud exchanges that `code` with Google server-to-server using
   the **same** Organization's Client Secret, then 302s the browser
   back to the **original WordPress site's own** callback URL
   (captured in step 1) with a new, VuloCloud-issued `code` — NOT
   Google's code, and NOT the tokens themselves (tokens never touch the
   browser/URL bar).
6. The WordPress site's callback
   (`GoogleSearchConsoleOAuthCallbackHandler::handle_callback()`) calls
   VuloCloud server-to-server: `POST /plugin/google/exchange`, trading
   that code for the real Google `access_token`/`refresh_token`, which it
   then encrypts and stores locally (`GoogleServicesConnection`) — same
   storage shape as the direct-to-Google flow.
7. Later, when the stored access token expires, the WordPress site calls
   `POST /plugin/google/refresh` (with `applicationId` again — a bare
   refresh token doesn't say which Organization's Client it belongs to)
   server-to-server to get a new one — a broker-issued `refresh_token`
   is only valid against the Organization's own OAuth Client, so it
   cannot be refreshed by calling Google directly with the embedded
   shared Client's credentials.

VuloCloud never stores Google tokens long-term for this flow — steps
5–7 only use a short-lived Redis correlation record (the `authorize`
call's `organizationId`/`domain`/`return_uri`/`state`, TTL 600s) and a
short-lived, single-use exchange code (TTL 300s, atomically consumed).
The real, long-lived Google tokens end up stored on the WordPress site
itself, exactly as they do today.

## Endpoints VuloCloud implements

### `GET /plugin/google/authorize`

Query params (from `GoogleOAuthBrokerClient::get_authorize_url()`):

| param | meaning |
|---|---|
| `applicationId` | This site's own registered VuloCloud `LicenseApplication` id (`VULOPILOT_GOOGLE_APPLICATION_ID`) — resolves which Organization's Google Cloud OAuth Client to use. Unknown/inactive id → `400 GOOGLE_BROKER_APPLICATION_NOT_FOUND`/`GOOGLE_BROKER_APPLICATION_INACTIVE`. |
| `domain` | The WordPress site's own `home_url()` — used only as a correlation key, not trusted for anything security-sensitive (see Security notes). |
| `returnUri` | The WordPress site's own OAuth callback (`admin-post.php?action=vulopilot_gsc_oauth_callback`) — where VuloCloud must redirect the browser back to once Google's handshake completes. Must be `http(s)` or the request fails closed (`400 GOOGLE_BROKER_INVALID_RETURN_URI`). |
| `state` | An opaque value generated by the WordPress site (a real WP nonce + `return_to` target, base64'd JSON) — VuloCloud echoes this back verbatim on the final redirect (step 5) and never inspects/decodes it. It is the WordPress site's own CSRF guard, not VuloCloud's. |

If the resolved Organization has no Google Settings connected yet (or
they're disabled), VuloCloud returns `400 GOOGLE_BROKER_NOT_CONFIGURED`
instead of redirecting — surfaced to the site owner as "Google Connect
isn't available for this site yet."

Required scopes (must match `GoogleServicesConnection::SCOPES`
exactly):

```
https://www.googleapis.com/auth/webmasters.readonly
https://www.googleapis.com/auth/analytics.readonly
https://www.googleapis.com/auth/adsense.readonly
```

Plus `access_type=offline&prompt=consent`, same reason
`GoogleServicesConnection::get_authorization_url()`'s own docblock
gives: Google only issues a `refresh_token` on first consent unless
`prompt=consent` forces it on every authorization.

### `POST /plugin/google/exchange`

Request body (`GoogleOAuthBrokerClient::exchange()`) — no
`applicationId` needed here; the single-use `code` already carries the
resolved Organization from step 5:

```json
{ "domain": "https://customer-site.example", "code": "<exchange code from the redirect>" }
```

Response, `200`:

```json
{
  "access_token": "ya29....",
  "refresh_token": "1//....",
  "expires_in": 3599
}
```

`refresh_token` may be omitted/empty if Google didn't return one on this
particular consent. Unknown/expired/already-consumed `code` → `400
GOOGLE_BROKER_CODE_INVALID`.

### `POST /plugin/google/refresh`

Request body (`GoogleOAuthBrokerClient::refresh()`):

```json
{ "applicationId": "...", "domain": "https://customer-site.example", "refreshToken": "1//...." }
```

Response, `200`:

```json
{ "access_token": "ya29....", "expires_in": 3599 }
```

(No `refresh_token` in the response — Google doesn't rotate it on a
refresh grant, so the WordPress site keeps using the one it already has
stored.)

Response, failure: any non-2xx with a JSON body carrying `message`
(or `error`) — `GoogleOAuthBrokerClient` surfaces either as the
`WP_Error` message shown to the site owner.

## Security notes

- **The WordPress site's own `state` value is its real CSRF guard** —
  VuloCloud treats it as an opaque blob to echo back, never as
  something it authenticates against.
- **`domain` is a correlation/UX convenience, not an authorization
  check.** The actual security boundary is `applicationId` (resolves
  the Organization) plus `/plugin/google/exchange`'s `code` being
  unguessable, single-use, and short-TTL.
- **`returnUri` is validated as `http(s)`** before any redirect is
  issued — closes the open-redirect surface any OAuth broker's
  `redirect_uri`/`return_uri` parameter otherwise has.
- An Organization's Google Cloud OAuth Client Secret never appears in
  any response to a WordPress site — only `access_token`/
  `refresh_token` values, exactly like the endpoints above specify.
- Every `/plugin/google/*` request is public (no session — a WordPress
  site has none) but rate-limited (60/min, Redis-backed across API
  instances).

## What does NOT change on the WordPress side

Everything downstream of "we have a valid access token" is identical
regardless of direct-vs-broker: `list_search_console_sites()`,
`GoogleAnalyticsClient`, `GoogleAdSenseClient`, the REST controller
(`Controllers\GoogleServices`), and every React panel consuming it. The
branch lives entirely inside `GoogleServicesConnection` (`has_broker()`,
`get_authorization_url()`, `exchange_broker_code_for_tokens()`,
`refresh_access_token()`) and `GoogleOAuthBrokerClient` — no other file
needed to change.

## Registering a site's `applicationId`

`VULOPILOT_GOOGLE_APPLICATION_ID` is this site's existing VuloCloud
`LicenseApplication` id — the same registration that already backs
license validation (see the vulopilot-pro Licensing integration), not a
new concept. A VuloLabs staff member registers one Application per
distributed build via VuloCloud's `POST
organizations/{id}/plugin-applications`; there's no self-service UI for
this yet on either side (no Client ID/Secret field on the WordPress
side either, by design — see config.php's own docblock).
