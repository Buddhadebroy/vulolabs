# AI Architecture

VuloCart does not talk to an AI provider. The site connects to a **VuloCloud** account once, and every AI request is sent to the VuloCloud AI gateway, where it runs on the connected Organization's key and credits. No provider name, model or API key is stored on the site.

Code: `classes/AI/` (core classes) and `modules/Ai/` (module wiring, routes, table).

## Parts

| Class | Job |
|---|---|
| `AI\VuloCloudConnection` | The site's connection: the connect flow, the encrypted credential, status and `execute()` |
| `AI\ConnectBrokerCallbackHandler` | The `admin-post` endpoint VuloCloud sends the browser back to after approval |
| `AI\Services\CredentialEncryption` | AES-256-CBC encryption of the stored secret, keyed from `wp_salt('auth')` |
| `AI\AiClient` | The one entry point features call: `VuloCart()->ai_client` |
| `AI\AiUsageLogUtil` | Reads and writes `vulocart_ai_usage_log` |
| `Ai\Rest` | Connection and usage routes (admin only) |

## The connect flow

1. In Settings → Integrations the admin presses **Connect**. The panel asks `GET /vulocloud-ai-connection/broker-authorize-url`.
2. The admin approves on VuloCloud (passwordless; no account password is typed on the site).
3. VuloCloud redirects the browser to `admin-post.php?action=vulocart_connect_broker_callback` with a single-use `code` and the `state`.
4. `ConnectBrokerCallbackHandler::handle_callback()` verifies `state`, `VuloCloudConnection::exchange_code()` redeems the code for a **site id and secret**, and the secret is stored encrypted in the option read by `get_connection()`. The browser returns to Settings → Integrations with `connect_status=connected|error`.
5. **Disconnect** (`POST /vulocloud-ai-connection/disconnect`) revokes the credential on VuloCloud, as far as possible, and always clears it locally.

The VuloCloud URL comes from the constant `VULOCART_VULOCLOUD_URL` (default `https://store.vulolabs.com`). `VULOCART_VULOCLOUD_HOST_ORGANIZATION_ID` can pin an Organization; when empty, VuloCloud asks which one to use.

## Making a request

```php
$ai = VuloCart()->ai_client;

if ( $ai && $ai->is_configured() ) {
	$text = $ai->prompt( 'catalog.description', $system_prompt, $user_message );
	$data = $ai->prompt_json( 'catalog.seo', $system_prompt, $user_message ); // decoded array
}
```

- The first argument of every call is a **feature name** (`catalog.description`, `support.merchant`, ...). It is written to the usage log, so the admin can see what the credits were spent on.
- `prompt()` returns the reply text; `prompt_json()` expects JSON and returns the decoded array.
- A failure throws `AI\Exceptions\AIProviderException`. Features catch it and show the message.
- `generate_image()` and `embed()` are **not available** through VuloCloud AI yet: they log a failed attempt and throw `AIProviderException`. Features built on them (AI product images in Catalog AI, Vector Search) therefore report that the capability is not available until the gateway offers it.
- `VuloCart()->ai_client` only exists while the **AI module** is active. Code outside the module must check for it.

## Usage and credits

Every call, successful or not, is written to `vulocart_ai_usage_log` (provider, model, feature, prompt and completion tokens, success, error). `GET /ai/usage` returns lifetime totals (calls, tokens, failures) and the 50 most recent rows. The connection status (`GET /vulocloud-ai-connection`) reports whether the Organization has an AI key configured and the remaining credits. The status never includes the secret.

## Features built on it

The free plugin ships the connection only. The AI features are vulocart-pro modules: Catalog AI, Checkout AI, Support AI and Vector Search. They share one card on the Modules screen (`ai`), and all use `VuloCart()->ai_client`.
