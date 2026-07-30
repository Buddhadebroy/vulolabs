# VuloPilot — MCP Server

Companion to [`DATABASE.md`](DATABASE.md), [`SCANNERS.md`](SCANNERS.md), and
[`WOOCOMMERCE-INTELLIGENCE-MODULE.md`](WOOCOMMERCE-INTELLIGENCE-MODULE.md).
Different shape from every prior phase's own doc: Phase 11 ("MCP Server")
is Pro-only with **no existing partial implementation to audit** — this
is new surface area, not a gap in something that already existed. What
this doc audits instead is which *existing* infrastructure this new
module reuses rather than reinvents, since that reuse is what makes
"Approval-based execution only" actually safe.

## What already existed that this module leans on

| Existing piece | What it already does | How MCP Server reuses it |
|---|---|---|
| `AIActions\ActionRunner::propose()` (Free) | Validates input → builds an AI prompt → calls the provider → validates the output → persists a `pending_approval` row in `vulopilot_ai_action_runs` and returns its preview. Never applies anything itself. | The **entire** mechanism behind "Approval-based execution only" — every Content/SEO/Visibility/WooCommerce Tool calls this and nothing else. |
| `Automation\Actions\RunAiActionAction` (Pro) | An existing automation action that already calls `propose()` and stops, specifically so an automation triggering an AI fix still requires human approval. | Direct precedent proving this exact "propose, never approve" pattern is already trusted elsewhere in this codebase for the identical reason. |
| `FindingRepository`/`Reports\ReportTypeInterface` (Free) | Pure, already-existing read/aggregate queries over `vulopilot_scan_findings` and registered report types. | `GetFindingsTool`/`GetReportTool` — read-only, so entirely outside the approval gate; no new query logic was written. |
| `AutomationRepository`/`TriggerRegistry`/`ActionRegistry`/`ConditionRegistry` (Free schema, Pro registries) | Already back `Automation\AutomationsRest::create_item()`'s own validation. | `CreateAutomationTool` mirrors that exact validation, with one addition (see below). |
| WordPress Application Passwords (WP core, 5.6+) | Already-built, already-secure, per-user, revocable REST credentials. | The **only** authentication this module uses — no new credential storage/hashing was written for external MCP clients to authenticate with. |

No JSON-RPC or MCP SDK exists anywhere in this monorepo's dependency tree
(checked every `composer.json`/`composer.lock` in the repo) — the wire
protocol itself (`McpProtocolHandler`) is hand-implemented, scoped to
only the four methods a tools-only server needs.

## Pro (`modules/McpServer/`, brand-new module)

No Free-side equivalent exists at all — unlike scanners/AI actions,
where Free genuinely has its own tier, this entire module (contract,
registry, protocol handler, every tool) lives in Pro, only ever
registering itself into Free's existing extension points
(`vulopilot_rest_controllers`, `vulopilot_dashboard_widgets`).

### The protocol: `POST /mcp`

`McpServerRest` exposes one route implementing MCP's Streamable HTTP
transport in its simplest valid form: every request gets a direct JSON
response, never an SSE stream (this server has nothing to push a
client didn't just ask for). `McpProtocolHandler` dispatches four JSON-RPC
2.0 methods — `initialize`, `notifications/initialized`, `tools/list`,
`tools/call` — plus `ping`. Targets protocol version `2024-11-05`. No
`resources`/`prompts` capability is implemented — the phase spec names
only "Tools" categories, so that's the whole surface built.

Gated on **both**:
- `current_user_can('manage_options')` — the same capability every other
  route in this codebase requires.
- The `enable_mcp_server` setting (Free-owned, **off by default** — see
  `Utill.php`) — a site owner must explicitly opt in before this route
  does anything beyond "disabled," since it's an endpoint external AI
  clients can reach.

Authenticates the same way any external tool already talks to the WP
REST API: a WordPress Application Password. No bespoke API key/OAuth
scheme was invented — reusing what WordPress core already provides
avoids adding new credential storage this codebase would then have to
keep secure itself.

### Approval-based execution only

This is the whole point of the phase, and it's enforced by construction,
not by convention:

- **Content/SEO/Visibility/WooCommerce Tools** all extend
  `Tools\AbstractActionProposalTool`, whose entire `call()` implementation
  is: call `ActionRunner::propose()`, translate any exception into an
  `isError` result, otherwise report the `run_id` and preview title with
  an explicit "pending human approval" message. There is **no**
  `approve`/`reject`/`rollback` MCP tool anywhere — an external client can
  never grant its own proposal approval by calling a second tool
  immediately after the first. A human must still open the Dashboard.
- **Report Tools** (`GetFindingsTool`/`GetReportTool`) are pure reads —
  outside the gate entirely, since nothing is mutated by looking at
  existing findings/reports.
- **Automation Tools**: `ListAutomationsTool` is a pure read.
  `CreateAutomationTool` is the one tool that isn't an AI-action proposal
  (an automation record is configuration, not a content mutation) — its
  own safety mechanism is instead that **the created automation's
  `status` is always forced to `'disabled'`**, regardless of anything the
  caller sends. A human must explicitly flip it on from the Dashboard
  (the same enable/disable toggle `Automation.tsx` already has) before it
  can ever fire and run its own configured actions. `run_now()` — the one
  call that would make an automation execute immediately — is
  deliberately **not** exposed as an MCP tool at all.

### The 16 tools

A curated, representative set across the six named categories — not a
wrapper around every existing scanner/AI action (there are dozens; see
[`ScannerRegistry`](SCANNERS.md) and every module's own `Actions/`
folder). `ToolRegistry::get_default_tool_classes()` is the source of
truth; a third party (or a later pass) adds more via
`vulopilot_mcp_tool_sources`, same filter-based discovery shape as every
sibling registry (`ScannerRegistry`, `ActionRegistry`, `TriggerRegistry`).

| Category | Tools | Wraps |
|---|---|---|
| Content | `generate_alt_text`, `improve_readability`, `generate_excerpt` | Free's own `GenerateAltAction`/`ImproveReadabilityAction`/`GenerateExcerptAction` |
| SEO | `write_meta_title`, `write_meta_description`, `generate_schema` | Free's own `WriteMetaTitleAction`/`WriteMetaDescriptionAction`/`GenerateSchemaAction` |
| Visibility | `generate_faq`, `generate_summary_block`, `generate_author_bio` | Free's own `GenerateFaqAction`/`GenerateSummaryBlockAction`/`GenerateAuthorBioAction` (GEO/AI-search visibility, E-E-A-T) |
| WooCommerce | `write_product_short_description`, `write_product_long_description`, `rewrite_product_title` | `WooCommerceAi`'s own actions — only resolve when that Pro module is active; an unregistered action id surfaces as a normal `isError` result, not a fatal |
| Report | `get_findings`, `get_report` | `FindingRepository`/`ReportTypeRegistry` directly — read-only |
| Automation | `list_automations`, `create_automation` | `AutomationRepository` — `create_automation` always forces `status: 'disabled'` |

Every tool that wraps an `AIActionInterface` action only ever needs
`post_id` (or `attachment_id`) from the caller — every "previous title"/
"previous description"/author lookup is derived internally by the
action's own `validate_input()` from the post/product itself, confirmed
by reading each action's source rather than assumed.

### Dashboard widget

`McpServerStatusWidget.tsx` registers into Free's own Dashboard grid via
`vulopilot_dashboard_widgets` (same pattern `AiMonitoringWidget.tsx`/
`KnowledgeGraphHealthWidget.tsx` already established for a Pro widget) —
shows whether `enable_mcp_server` is on, how many tools are registered,
and the endpoint URL, backed by a small dedicated read
(`GET /mcp/status`, deliberately **not** gated on the setting itself, so
the widget can still show "disabled"). `mcp-server-status` was added to
`Utill::DASHBOARD_WIDGET_IDS` (Free) — required, or a saved dashboard
layout would silently drop it.

### A timing bug caught before it shipped

`ToolRegistry`'s constructor registers its own `add_action('init', ...,
20)` callback — the same "gather every filter-registered source once
`init` has definitely finished firing" shape `ScannerRegistry`/
`ActionRegistry`/`TriggerRegistry` all share. The first draft of
`Module.php` built `ToolRegistry` *lazily*, inside
`register_rest_controllers()` — but that method only ever runs from the
`vulopilot_rest_controllers` filter during `rest_api_init`, which fires
well *after* `init`. A registry built that late would register its own
`init` callback after the event already passed, and `get_all_tools()`
would always be empty. Fixed by building `ToolRegistry` eagerly in
`Module::__construct()` instead (modules are instantiated near the very
top of `VuloPilot::init_classes()`, well before `init` fires at all) and
passing the already-initialized instance down to `McpServerRest`.

## What's not here yet

- **`resources`/`prompts` MCP capabilities.** The phase spec names only
  "Tools" categories; this pass builds exactly that.
- **Every other existing scanner/AI action as its own MCP tool.** 16
  curated tools across the six named categories, not dozens — see the
  table above. Adding more later is exactly what
  `vulopilot_mcp_tool_sources` is for.
- **Server-initiated messages (SSE stream, the optional `GET /mcp`
  half of Streamable HTTP).** This server only ever responds directly to
  a request; it never needs to push something a client didn't just ask
  for, so the optional stream was never built.
