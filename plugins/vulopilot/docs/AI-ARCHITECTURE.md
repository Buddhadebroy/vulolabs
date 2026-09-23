# VuloPilot - AI request architecture

Companion to [`RULE-ENGINE.md`](RULE-ENGINE.md), [`SCANNERS.md`](SCANNERS.md), and
[`DATABASE.md`](DATABASE.md). Covers how an AI call gets from a feature to VuloCloud and back:
`AiRequestSender`, the failures it can throw, safety validation, the VuloCloud connection/credits
layer, and where AI actions live.

There is **no provider concept** in this plugin. VuloCloud is the only place an AI answer comes
from - it holds every key and decides which vendor serves a call - so there is nothing to register,
select, decorate or fall back between. Earlier versions had a `ProviderRegistry`,
`AIProviderInterface`, a `VuloCloudProxyProvider` adapter, three decorators and a fallback chain
around that single gateway call; all of it was removed, and the decorators' real work (budget,
retry, history) became plain steps inside `AiRequestSender`.

## The request path (`classes/AiAssistant/`)

```
feature  →  VuloPilot()->ai_request_sender->send( $messages, $image, $surface )
              1. validate_prompt()                            (VuloPilotException, TYPE_UNSAFE_PROMPT)
              2. AiCreditsConnection::is_connected()           (\RuntimeException "No AI connection is configured.")
              3. per-minute request budget                     (VuloPilotException, TYPE_RATE_LIMIT_EXCEEDED)
              4. AiCreditsConnection::execute()                {siteId, secret, feature, prompt, context, site_tone} → VuloCloud
                 retried on TYPE_TRANSIENT_GATEWAY, exponential backoff, 3 attempts
              5. one vulopilot_ai_history row                 (success and failure both)
              6. sanitize_response()
```

`AiRequestSender` is one class - the request-building, safety-validation and response-sanitizing
steps that used to live in separate `AIRequest`/`AISafetyValidator` classes were folded into it as
private state/methods, since neither had a real caller besides this one (see that class's own
docblock for the full reasoning). `AIResponse` stays its own class: it's the parameter type
`Utill\AIActionInterface::parse_response()` takes, read by every AI Action across both plugins, and
also constructed independently by `AiCopilot\ActionRunner`'s credits-metered path - a real,
cross-cutting contract type, not something private to the sender.

`AiRequestSender` is built once in `VuloPilot::init_classes()` and shared - every caller
(`AiCopilot\ActionRunner`, `GeoAnalysis\GeoAnalyzer`, `ContentOptimization\ContentAnalyzer`,
`AiAssistant\SiteToneLearner`, and vulopilot-pro's analyzers/REST controllers) is handed that same
instance (`VuloPilot()->ai_request_sender`) rather than constructing its own.

- **Budget.** `MAX_REQUESTS_PER_MINUTE` (20), a WP transient counter keyed by minute
  (`vulopilot_ai_rate_vulocloud_<minute>`). Every attempt, retries included, spends from it. It is
  a local pre-emptive guard against burning AI credits, not a spend cap.
- **History.** Recorded around the retries (`AiHistoryRepository::insert()`), so one call is one row
  regardless of how many attempts it took. Failures are recorded too (`status = 'failure'`, zero
  credits) so the audit trail covers what was tried, not only what worked.
- **Images.** `send()`'s own `$image` parameter is recorded on the call but the VuloCloud wire
  contract carries text only today, so nothing sends one. Image attachments in Copilot chat get the
  same honest "can't be read" note any other unsupported file does.

## Failures: one exception class, not a hierarchy

`Utill\VuloPilotException` replaced what used to be a small hierarchy of near-empty subclasses
(`AiRequestException`, `AiByokNotConfiguredException`, `GatewayRequestException`,
`RateLimitExceededException`, `TransientGatewayException`, `UnsafePromptException`,
`InvalidActionInputException`, `InvalidActionOutputException`, `InsufficientCreditsException`) - one
class, a `type` constant instead of a class hierarchy, and an optional `$context` array for
whichever extra data that type needs.

```
VuloPilotException::TYPE_AI_REQUEST              common parent type - see is_ai_request_failure()
VuloPilotException::TYPE_AI_BYOK_NOT_CONFIGURED  VuloCloud has no AI key that resolves for this site
VuloPilotException::TYPE_GATEWAY_REQUEST         not retry-eligible (malformed request, rejected)
VuloPilotException::TYPE_RATE_LIMIT_EXCEEDED     thrown before the request is sent
VuloPilotException::TYPE_TRANSIENT_GATEWAY       retry-eligible (network error, 5xx, 429)
VuloPilotException::TYPE_UNSAFE_PROMPT           thrown by validate_prompt(); not an AI-request-failure type
VuloPilotException::TYPE_INVALID_ACTION_INPUT    an AIActionInterface's validate_input() rejected the input
VuloPilotException::TYPE_INVALID_ACTION_OUTPUT   an AIActionInterface's validate_output() rejected the output
VuloPilotException::TYPE_INSUFFICIENT_CREDITS    ActionRunner's credits fallback came back empty
```

A caller that wants to turn any AI-gateway failure into a 502 calls `$exception->is_ai_request_failure()`
(true for `TYPE_AI_REQUEST`/`TYPE_AI_BYOK_NOT_CONFIGURED`/`TYPE_GATEWAY_REQUEST`/
`TYPE_RATE_LIMIT_EXCEEDED`/`TYPE_TRANSIENT_GATEWAY` - what `instanceof AiRequestException` used to
mean) rather than comparing `get_type()` against each one by hand; one that wants to tell "not
connected" apart catches `\RuntimeException` (thrown by the sender when this site isn't connected to
VuloCloud at all).

## Contracts and value objects

```
classes/
├── Utill/
│   ├── AIActionInterface.php         one AI-assisted workflow (see AI-ACTIONS.md)
│   └── VuloPilotException.php        the one exception class - see "Failures" above
└── AiAssistant/
    ├── AiRequestSender.php           the request path - see above (also holds the former
    │                                 AIRequest/AISafetyValidator logic as private state/methods)
    ├── AIResponse.php                content, credits_used, request_id - the AIActionInterface contract type
    ├── ActionPreview.php             AIActionInterface::build_preview()'s own return type
    ├── ActionExecutionResult.php     AIActionInterface::execute()'s own return type
    ├── AiHistoryRepository.php       `vulopilot_ai_history` - one row per AiRequestSender::send() call
    └── ActionRunRepository.php       `vulopilot_ai_action_runs` - one row per AiCopilot\ActionRunner::propose()
```

## VuloCloud connection and credits (`classes/AiAssistant/`)

This site holds no AI credential itself. `AiCreditsConnection` is the site-scoped connection to
VuloCloud - the passwordless broker "Connect to VuloCloud" flow behind Settings → Connections →
VuloCloud AI (served by `Rest\VuloCloudAiConnection`/`Rest\AiCredits`, the return redirect handled
by `ConnectBrokerCallbackHandler`, which self-registers at boot since `admin-post.php` never fires
`rest_api_init`) - **and** the BYOK gateway call itself (`execute()`/`byok_status()`, folded in from
this plugin's former, single-caller `AiByokGatewayClient` class) **and** the low-level
`/plugin/connect/*`/`/plugin/ai-credits/*` HTTP calls (folded in from this plugin's former, also
single-caller `VuloCloudApiClient` class, itself already a merge of `ConnectBrokerClient` +
`AiCreditsApiClient`). One class now owns: stored connection state, the connect/exchange flow, the
credits balance/disconnect calls, and the one real BYOK AI call - all of it read/write against the
same `vulopilot_ai_credits_connection` option, with no state or behavior left over in a
single-purpose HTTP-client class once every one of those had exactly one real caller.

`AiAssistant\CredentialEncryption` (AES-256-CBC, key derived from `wp_salt('auth')`) stays its own
class - it's a generic secret-at-rest utility shared well beyond this connection (Google OAuth
tokens in `Settings\GoogleServicesConnection`, vulopilot-pro's Backup Cloud Storage credentials).
`AiAssistant\VuloCloudAccountConnection` (a separate, informational-only *person*-level login status
- distinct from this *site*-level connection) also stays its own class - `AiCreditsConnection::get_status()`
composes it in, but doesn't depend on it, and `FrontendScripts`/`Rest\AiCredits` read it
independently too.

AI Credits are a separate, metered path, not a layer on top: `AiCopilot\Services\AiCreditGatewayClient`
calls VuloCloud's credit-metered `POST /plugin/ai/execute` (a different wire contract -
`{featureId, action, context}`). `AiCopilot\ActionRunner::send_prompt_or_credits()` is where the two
meet: it always sends through `AiRequestSender` first, and only falls through to credits - for the
action ids in `CREDIT_FEATURE_MAP` - when that throws `VuloPilotException` with
`TYPE_AI_BYOK_NOT_CONFIGURED`. Every other action id's "not configured" is a final `\RuntimeException`.

## AI actions (`modules/AiCopilot/`)

AI actions belong to the AI Copilot module: `ActionRegistry`, `ActionRunner`,
`ContentCreationOrchestrator`, every `Actions\*Action` class, and the `Rest\AiActionRuns` and
`Rest\Copilot` controllers all live under `modules/AiCopilot/` (`VuloPilot\AiCopilot\…`). The
contract they implement, `Utill\AIActionInterface`, stays in shared core because vulopilot-pro
implements it too. See [`AI-ACTIONS.md`](AI-ACTIONS.md) for the full lifecycle
(propose → validate → preview → approve → execute → rollback → log).

`ai_action_registry` and `ai_action_runner` are constructed in `VuloPilot::init_classes()` and read
from the container by vulopilot-pro and the Dashboard/History controllers, so they exist whether or
not the module is active; the REST surface itself gates on the module being active.

## Safety validation

Two gates, both private methods on `AiRequestSender`, called for every caller:

- **`validate_prompt()`** - runs *before* a request is ever sent. Rejects prompts over 32,000
  characters (`MAX_PROMPT_LENGTH`), and rejects (rather than silently stripping) any prompt whose
  text matches a known API-key shape (OpenAI-style `sk-[a-zA-Z0-9]{20,}`, Google
  `AIza[0-9A-Za-z\-_]{35}`, a PEM `-----BEGIN (RSA |EC )?PRIVATE KEY-----` header) - a
  self-consistency check against a prompt-builder interpolating a credential, not a general PII
  scanner.
- **`sanitize_response()`** - runs on every response before anything sees it. Strips all
  HTML/script content via `wp_kses( $content, array() )` - an AI response is never trusted as
  safe-to-render markup just because the HTTP call succeeded.

## Extension strategy

- **A new AI action**: implement `AIActionInterface` and add the class through
  `vulopilot_ai_action_sources` (`AiCopilot\ActionRegistry`), the same discovery-by-filter shape as
  `SCANNERS.md`/`RULE-ENGINE.md`. vulopilot-pro's `AbstractBasicAction` is the model.
- **A new AI backend**: not an extension point. Which vendor answers is a VuloCloud-side change
  (`contexts/vulopilot/ai-byok`), not a class here.

## What's not here yet

- **Multimodal (vision) messages** - see "Images" above; needs a VuloCloud-side wire contract
  change. `AI-ACTIONS.md`'s `GenerateAltAction` is context-based, not vision-based, as an honest
  answer to that gap.
- **Quota enforcement** - nothing reads or increments a spend/token budget. The per-minute budget
  in `AiRequestSender` limits *rate*, not total spend, a related but different mechanism.
