# VuloPilot — AI provider architecture

Companion to [`RULE-ENGINE.md`](RULE-ENGINE.md), [`SCANNERS.md`](SCANNERS.md), and
[`DATABASE.md`](DATABASE.md). Covers the adapter contract, all 6 provider adapters, the
decorator stack (usage-tracking/retry/rate-limit/fallback), `SafeRequestSender`, safety
validation, and the extension strategy.

## Contracts (`vulolabs/plugins/vulopilot/classes/`)

These, like every other contract in this codebase, used to live in a separate Composer path
package, `vulolabs/packages/php/vulopilot-core` — that package no longer exists (see
`SCANNERS.md`'s and `RULE-ENGINE.md`'s own "Contracts" sections for the same correction). Every
class below lives directly in the plugin under `VuloPilot\`:

```
classes/
├── Contracts/AI/
│   └── AIProviderInterface.php    get_id/get_label/supports_streaming/get_available_models/send()/send_streaming()
├── ValueObjects/
│   ├── AIRequest.php               model, messages, temperature, max_tokens — no credential
│   └── AIResponse.php              content, provider, model, prompt/completion tokens, finish_reason
└── Exceptions/
    ├── AIProviderException.php         base — catch this for "any provider failure"
    ├── TransientProviderException.php  retry-eligible (network error, 5xx, 429)
    ├── ProviderRequestException.php    not retry-eligible (bad key, malformed request)
    ├── RateLimitExceededException.php  thrown before an inner call even happens
    └── UnsafePromptException.php       thrown by the safety validator, before any provider is touched
```

> **Superseded:** this pass originally also defined `AIJobHandlerInterface` (context/prompt/parse
> for one AI conversation tied to a `Recommendation`) plus `AIJobRunner` and two job handlers. A
> later pass ([`AI-ACTIONS.md`](AI-ACTIONS.md)) replaced all of that with `AIActionInterface` +
> `AIActions\ActionRunner` once a second, genuinely different kind of AI-assisted workflow
> (user-typed input with no `Recommendation` at all, e.g. "Generate Blog") showed the
> Recommendation-only assumption was already too narrow. Those files were deleted, not left
> around deprecated — see `AI-ACTIONS.md`'s "Why this supersedes `AIJobHandlerInterface`" for the
> full reasoning. Everything below this note (providers, decorators, safety validation) is
> unaffected and still current.

- **`AIProviderInterface` is the only interface for a "provider"** — and every decorator
  (`Decorators\*`) implements the *same* interface it wraps. That's what makes "no
  provider-specific code outside adapters" structurally true: `AIActions\ActionRunner` calling
  `send()` never knows or needs to know whether it's talking to a raw `OpenAiProvider` or several
  decorators deep.
- **No `AIRequestInterface`/`AIResponseInterface`** — same reasoning as `Finding`/`ScanResult`/
  `Recommendation` in the Scanner/Rule Engine passes: there's exactly one shape for "a
  provider-agnostic chat request/response," so an interface for either would have one
  implementation and add nothing. (Unlike `Finding`/`Recommendation`, neither `AIRequest` nor
  `AIResponse` claims to validate its own constructor input either way — there's simply nothing
  to validate here: every field is a plain scalar or array with no closed vocabulary attached.)
- **The exception hierarchy is what makes the decorator stack composable without any decorator
  inspecting *what kind* of provider it's wrapping** — `RetryingProvider` only ever asks "was
  this a `TransientProviderException`?", never "was this an OpenAI rate limit?".

## The 6 adapters (`classes/AIProviders/Providers/`)

| Adapter | Auth | Notable difference from the others |
|---|---|---|
| `OpenAiProvider` | `Authorization: Bearer` | The reference shape — `/chat/completions`, SSE streaming |
| `OpenRouterProvider` | `Authorization: Bearer` | Same wire protocol as OpenAI + `HTTP-Referer`/`X-Title` headers |
| `GroqProvider` | `Authorization: Bearer` | Same wire protocol as OpenAI, different base URL |
| `AnthropicProvider` | `x-api-key` header | `system` role pulled out of `messages[]` into a top-level field; `max_tokens` is *required*; response `content` is typed blocks, not a string; SSE framed as named events |
| `GeminiProvider` | `?key=` query param | `contents`/`parts` shape; assistant role is called `'model'`; system message goes in `systemInstruction`; streaming needs `alt=sse` to get line-by-line events instead of one streamed JSON array |
| `OllamaProvider` | none (local server) | No API key at all — what's "configured" is a base URL; streaming is raw NDJSON, not SSE |

Still exactly 6, still exactly this list — `ProviderRegistry::get_default_adapter_classes()`
maps `'openai'|'anthropic'|'gemini'|'openrouter'|'ollama'|'groq'` to these same 6 classes today.

**`AbstractOpenAiCompatibleProvider`** is the shared base for OpenAI/OpenRouter/Groq — real code
reuse, not a forced abstraction, because those three genuinely speak the same protocol.
Anthropic/Gemini/Ollama each get a standalone adapter because their request/response shapes are
genuinely different — folding them into the same base class would have been the opposite
mistake (a false abstraction hiding real differences).

### Streaming — what's real here and what's a documented gap

`StreamingHttpClient` (`AIProviders/Support/`) opens a real blocking socket read via PHP's native
`http://`/`https://` stream wrapper (`fopen()` + `fread()` in a loop) — not `wp_remote_post()`,
which buffers WordPress's entire HTTP response before returning and has no incremental-read hook
at all. This is genuine, working streaming transport: bytes are delivered to each adapter's
line-parsing callback as the server sends them, not simulated after the fact.

What's **not** here: real concurrent multi-stream handling (e.g. a raw cURL multi-handle) — every
`send_streaming()` call is a single blocking connection, which is the correct and sufficient
shape for "stream one AI response to one dashboard request," the only use case this pass builds
for.

## Credentials (BYOK)

`vulopilot_ai_provider_configs` (`DATABASE.md`) stores `provider`, `credentials` (always
encrypted — see below), `default_model`, `is_active`, `quota_limit`/`quota_used`.
`Repositories\AiProviderConfigRepository` is a thin `AbstractRepository` subclass, same shape as
every other repository in this codebase.

**`Services\CredentialEncryption`** is confirmed still exactly as designed — AES-256-CBC
(`openssl_encrypt`/`openssl_decrypt`), key derived via `hash('sha256', wp_salt('auth'), true)`
(never stored in the database itself), random IV per call. `ProviderRegistry::build_provider()` is
the **one place** a credential is ever decrypted — repositories, REST controllers, and action
code never see a raw key.

### BYOK vs. Built-in Credits

This pass builds BYOK only — a site owner enters their own key, it's encrypted and stored, and
`ProviderRegistry` decrypts it to build an adapter. **Built-in Credits (a VuloLabs-hosted,
metered proxy so a site owner doesn't need their own key) is a Pro-tier extension point, not built
here** — the natural shape for it is a `BuiltInCreditsProvider` decorator (license-gated, like
every other Pro capability per `plugin-families.md`) that implements `AIProviderInterface` and
proxies through VuloLabs's own server instead of decrypting a stored key, composing with the
existing decorator stack exactly the way `RetryingProvider`/`RateLimitedProvider` do. Confirmed
still unbuilt — there is no such class, and no `vulopilot-pro` module registers a second AI
provider via `vulopilot_ai_provider_sources` today. This keeps Free's adapters and BYOK fully
functional and real on their own, with Pro adding a mode, not adding business logic Free is
missing.

### Settings UI

`RestAPI\Controllers\AiProviders` (`GET/POST /ai-providers`, `POST /ai-providers/{id}`,
`POST /ai-providers/{id}/delete`) is what actually writes to `vulopilot_ai_provider_configs` from
the dashboard. It never returns a stored row's `credentials` value — only a `has_credential`
boolean — the same decrypt-only-in-`ProviderRegistry::build_provider()` boundary described above.
Backs `src/components/Settings/AiProvidersPanel.tsx` — an earlier pass of this doc placed that
file under a `Settings/Account/` subfolder; it actually lives directly under `Settings/`. Wired
into the Settings page as its own `ai-providers` tab (`src/pages/Settings/Settings.tsx`'s
`currentTab === 'ai-providers'` escape hatch, same shape as the `import-export` tab, joined since
by an `indexnow` tab using the identical pattern) — hand-built rather than `InputRenderer`-driven
since provider configs live in their own table, not the flat settings option every other tab
auto-saves into.

## The decorator stack (`classes/AIProviders/Decorators/`)

An earlier pass of this doc described the build order as
`RateLimitedProvider → RetryingProvider → UsageTrackingProvider → (raw adapter)`. Reading
`ProviderRegistry::build_provider()`'s actual construction shows the nesting is the other way
around:

```php
return new Decorators\UsageTrackingProvider(
    new Decorators\RetryingProvider(
        new Decorators\RateLimitedProvider( $adapter )
    )
);
```

```
UsageTrackingProvider → RetryingProvider → RateLimitedProvider → (raw adapter)
```

`UsageTrackingProvider` is the **outermost** wrapper — its `send()` runs first when a caller
invokes the built provider — not the innermost as previously documented. Working through what
each layer actually does, in the order a call really passes through them:

1. **`UsageTrackingProvider`** — wraps everything else in a `try`/`catch`, calls its inner
   provider, and records one `vulopilot_ai_history` row per call regardless of outcome (its own
   docblock: "an audit trail... is only complete if it includes the calls that didn't work").
   Because it's outermost, this also means it logs a `'failure'` row even for a request that never
   reached a real provider at all — one rejected by `RateLimitedProvider`'s local budget check,
   three layers in. That's a real, observable consequence of the actual nesting order, not just a
   documentation nuance: `vulopilot_ai_history` is an audit trail of "every attempt this site
   made," not only "every attempt that actually left the server."
2. **`RetryingProvider`** — retries only `TransientProviderException` with exponential backoff
   (500ms, 1s, 2s, …); a `ProviderRequestException` or `RateLimitExceededException` passes
   straight through untouched (`with_retries()`'s `catch` clause is typed to
   `TransientProviderException` specifically), because retrying either would never help (see each
   exception's own docblock).
3. **`RateLimitedProvider`** — checks a per-minute budget (a WP transient, not a new caching
   layer — see its docblock) immediately before calling its own inner provider, so a spent budget
   never wastes a network round trip to the raw adapter. This is the innermost decorator, right
   next to the real adapter — still true to the original intent ("check the budget before even
   trying the network call"), just not the outermost wrapper the way an earlier pass of this doc
   implied.

The net externally-observable behavior this doc originally described is still accurate — a
locally rate-limited request never reaches the network, and only transient failures get retried —
the correction above is specifically about which decorator sits where in the actual object graph,
which matters if you're reasoning about exactly what "record every attempt" captures.

**`ProviderFallbackChain`** is the "Fallback" requirement — also `AIProviderInterface`-shaped, but
built differently: `ProviderRegistry::build_fallback_chain()` builds one already-decorated chain
per configured provider (so each provider in the chain still gets its own usage-tracking/retry/
rate-limit stack) and tries them in order (`try_each()`), moving on at any `AIProviderException`.
Fallback is what happens *after* an individual provider's own retries are exhausted, not a
replacement for them.

## `SafeRequestSender` — the "safety-validate → send → sanitize" sequence

**`AIProviders\Support\SafeRequestSender`** is the class every real AI call in this codebase goes
through today. Its own docblock is explicit about where it came from: originally written once,
inline, inside `AIActions\ActionRunner::propose()`; extracted out into its own small, reusable
class once [`GEO-MODULE.md`](GEO-MODULE.md)'s `GeoAnalysis\GeoAnalyzer` needed the identical
sequence for a read-only analysis call that isn't an `AIAction` at all (no mutation, so no
Approval/Execution/Rollback lifecycle applies). `ContentIntelligence\ContentAnalyzer`
(`CONTENT-INTELLIGENCE-MODULE.md`) reuses the same instance for the same reason. `VuloPilot.php`'s
bootstrap constructs exactly one `SafeRequestSender`
(`container['ai_request_sender']`), shared by `ai_action_runner`, `geo_analyzer`, and
`content_analyzer` alike — one safety-validated call path, not three.

```php
public function send( array $messages ): AIResponse
```

1. `AISafetyValidator::validate_prompt( $messages )` — throws `UnsafePromptException` before
   anything is sent.
2. `ProviderRegistry::build_fallback_chain()` — throws a plain `\RuntimeException` if no provider
   is configured at all.
3. Picks the fallback chain's first model (`get_available_models()[0]`) and sends.
4. `AISafetyValidator::sanitize_response()` on whatever comes back, always — even a successful
   response is never trusted un-sanitized.

Deliberately narrow: this is not a new "AI request abstraction layer" — it's the one sequence
`AIProviderInterface::send()` always needs wrapped around it, given a shared name so every call
site reads as "send this safely" instead of restating the mechanics.

## Job orchestration — now `AIActions\ActionRunner`

Superseded by the full action lifecycle in [`AI-ACTIONS.md`](AI-ACTIONS.md) — `propose()` covers
what this section used to describe (build a prompt, send it via `SafeRequestSender`, parse the
result), then adds the Validator/Preview/Approval/Execution/Rollback/Logging stages `AIJobRunner`
never had. See that document for the full orchestration, including its now-larger list of real
callers.

## Safety validation (`Safety\AISafetyValidator`)

Two gates, not one — still used exactly as described here, called from both `SafeRequestSender`
consumers (`AIActions\ActionRunner`, `GeoAnalysis\GeoAnalyzer`, `ContentIntelligence\ContentAnalyzer`),
not directly by adapters:

- **`validate_prompt()`** — runs *before* a request is ever sent. Rejects prompts over 32,000
  characters (`MAX_PROMPT_LENGTH`), and rejects (rather than silently stripping) any prompt whose
  text matches a known API-key shape (OpenAI-style `sk-[a-zA-Z0-9]{20,}`, Google
  `AIza[0-9A-Za-z\-_]{35}`, a PEM `-----BEGIN (RSA |EC )?PRIVATE KEY-----` header) — a
  self-consistency check against exactly the kind of credential this codebase's own adapters
  handle, not a general PII scanner.
- **`sanitize_response()`** — runs on every response before an action ever sees it. Strips all
  HTML/script content via `wp_kses( $content, array() )` — an AI response is never trusted as
  safe-to-render markup just because the HTTP call succeeded.

## Extension strategy

Identical shape to `SCANNERS.md`/`RULE-ENGINE.md`, again on purpose:

1. **A new Free adapter** (a 7th provider): implement `AIProviderInterface`, add it to
   `ProviderRegistry::get_default_adapter_classes()`.
2. **A Pro provider mode** (e.g. the Built-in Credits decorator described above): register
   via `add_filter( 'vulopilot_ai_provider_sources', ... )` from a Pro module, license-gated the
   same way every other Pro capability is (`plugin-families.md`), `get_tier()` returning `'pro'`
   — not `'premium'`, the same correction made in `SCANNERS.md`'s and `AI-ACTIONS.md`'s own
   extension-strategy sections. **Nothing does this yet** — see "BYOK vs. Built-in Credits" above.
3. **A third-party adapter**: the same filter (`vulopilot_ai_provider_sources`), from any other
   plugin — no more privileged a path for Pro than for a third party.

## What's not here yet

- **Multimodal (vision) messages.** `AIRequest`'s `messages` are still plain
  `{role, content: string}` — no image/file attachment support. `AI-ACTIONS.md`'s
  `GenerateAltAction` is context-based, not vision-based, as an honest answer to that gap, not a
  stand-in claiming to be vision-based.
- **Built-in Credits.** BYOK is fully real and functional; the Pro-tier hosted/metered mode is
  designed (see above) but not built.
- **Quota enforcement** against `vulopilot_ai_provider_configs.quota_limit`/`quota_used` — the
  columns exist in `DATABASE.md`'s schema (confirmed still present in `Install.php`); nothing
  reads or increments them anywhere in the codebase today. `RateLimitedProvider` enforces a *rate*
  (requests per minute), not a *budget* (total spend/tokens per period) — a related but different
  mechanism, deliberately not conflated here.
