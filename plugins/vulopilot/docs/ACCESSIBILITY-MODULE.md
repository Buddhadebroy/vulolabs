# VuloPilot — Accessibility

Companion to [`DATABASE.md`](DATABASE.md), [`SCANNERS.md`](SCANNERS.md),
[`SECURITY-MODULE.md`](SECURITY-MODULE.md), and to `vulopilot-pro`'s own
[`ACCESSIBILITY-AUDITS-MODULE.md`](../../../../plugins/vulopilot-pro/docs/ACCESSIBILITY-AUDITS-MODULE.md).
Same "audit what already exists
first" shape as that file: Free already had scanners covering most of
Phase 8's five bullets, spread across three different scanner categories
(`accessibility`, `images`, `geo`) rather than missing entirely — so this
pass's real Free-side gap turned out to be one new scanner, not five. Pro's
`SecurityMonitoring` module's shape (an independent scheduler, a
category-scoped dashboard/history REST surface, additive React cards) is
reused wholesale for a new `AccessibilityAudits` module, rather than
re-deriving the same design from scratch.

## Audit: what already existed

| Spec item | Status before this pass |
|---|---|
| WCAG Scanner (Free) | **Did not exist at all** — no check for WCAG 2.4.4 (Link Purpose) or any other single, generically-branded "WCAG" rule. |
| Missing Alt (Free) | Already fully built — `Scanners\Basic\ImagesScanner` (category `images`, not `accessibility`) already flags image attachments missing alt text, gated by `flag_missing_alt_text`. Untouched. |
| Labels (Free) | Already fully built — `Scanners\Basic\FormLabelsScanner` (category `accessibility`) already flags `<input>`/`<textarea>`/`<select>` elements with no associated label/aria-label/aria-labelledby. Untouched. |
| Heading Hierarchy (Free) | Already fully built — `Scanners\Basic\GeoSemanticStructureScanner` (category `geo`, built for the GEO module) already flags a heading level *skip* (e.g. `<h2>` directly followed by `<h4>`), its own docblock explicitly citing "the same heading-order definition of a skip that accessibility checkers like axe-core use." Untouched. |
| ARIA Detection (Free) | Already fully built — `Scanners\Basic\AriaAttributesScanner` (category `accessibility`) already flags a clickable `<div>`/`<span>` (has an `onclick` handler) with no `role` attribute. Untouched. |
| Bulk Fixes (Pro) | **Did not apply to any accessibility finding** — OneClickFix's `BulkFixRest`/`MechanicalFixRunner`/`ScannerFixMap` are already fully generic across every scanner category (built in an earlier pass), but none of the four accessibility scanner ids were mapped to a fix yet. |
| Scheduled Audits (Pro) | **Did not exist as its own schedule** — accessibility scanners only ran as a side effect of Automation module's own general `scan_frequency` cadence (if active) or SecurityMonitoring's unrelated `security_scan_frequency`, no independent accessibility-only schedule/setting. |
| Accessibility Reports (Pro) | Free's own generic Reports pipeline (`GET/POST /reports`, CSV/PDF export, `Reports\Types\AccessibilityReport`) already covers exporting a period report — but there was no current-state dashboard summary the way SecurityMonitoring's own dashboard card gives Security. |
| Historical Tracking (Pro) | **Did not exist at all** — no snapshot table or trend data scoped to the `accessibility` category (the closest existing thing, `vulopilot_site_health_snapshots`, tracks the whole-site score, not any one category). |

## Free — one new scanner, category `accessibility`

`WcagScanner` (`wcag-scanner`) lives in `classes/Scanners/Basic/`,
registered in `ScannerRegistry::get_default_scanner_classes()` alongside
`AccessibilityScanner`/`FormLabelsScanner`/`AriaAttributesScanner` under the
same `accessibility` category string, gated by its own settings toggle
(`enable_wcag_scanner`, `Settings → Scanning → Accessibility`) — same
granular, per-scanner-toggle posture this category already uses (no whole-
category kill switch beyond the existing `enable_accessibility_scanning`).

Flags links whose *entire* visible text is a generic, out-of-context phrase
("click here", "read more", "learn more", "here", "this link", "link",
"more") — not merely containing one of those words, which would false-
positive on a link with real context like "click here to read our shipping
policy." This is WCAG 2.4.4 (Link Purpose, In Context): a screen reader
user who pulls up a page's own link list (a common navigation shortcut)
hears nothing but "click here, click here, click here" with no way to tell
them apart. It's the single most common rule automated accessibility
auditors (axe-core's `link-name`, WAVE's "Suspicious Link Text") flag, and
neither plugin had a check for it before this pass — distinct from
`AriaAttributesScanner` (missing role on a clickable non-link element) and
`FormLabelsScanner` (unlabeled form fields).

The other four Free bullets needed no new code — see the audit table above
for exactly which pre-existing scanner (and category) already satisfies
each one.

### Schema addition: `vulopilot_accessibility_snapshots`

A new table + `Repositories` (Pro-side `AccessibilitySnapshotRepository`),
same "Free owns the schema/migration, Pro owns the concrete repository and
population logic" split `vulopilot_file_baselines`/
`vulopilot_geo_visibility_history`/`vulopilot_site_health_snapshots` already
establish. One row per calendar day (`snapshot_date` UNIQUE, upserted).
Empty and inert without Pro's `AccessibilityAudits` module active. See
`DATABASE.md` for the full column list.

## Pro (`modules/AccessibilityAudits/`)

A brand-new module — this is the first Pro feature scoped to the
`accessibility` category. Deliberately registers no new scanner of its
own (the one new scanner this phase needed, `WcagScanner`, is Free, per
the established "Free owns scanners/reports/registries, Pro registers
extra behavior around them" split).

### Scheduled Audits — an independent cadence

`AccessibilityAuditScheduler` — its own small wp-cron wrapper (own hook
`vulopilot_pro_accessibility_audit`, own setting
`accessibility_audit_frequency`: `disabled`/`hourly`/`daily`/`weekly`),
calling `ScanRunner::run_category('accessibility')` rather than
`run_all()`. Same shape as `SecurityMonitoring\SecurityScanScheduler`, and
built for the identical reason: not reused from a sibling Pro module,
since this module must keep working (including its own schedule) with
Automation/SecurityMonitoring switched off.

### Historical Tracking — a category-scoped daily snapshot

`AccessibilitySnapshotRepository` (`vulopilot_accessibility_snapshots`) is
populated directly from `Module::maybe_refresh_snapshot()`, self-hooked on
`vulopilot_scan_completed` — same "Module.php hooks the completed-scan
action directly, no separate builder class" shape
`AdvancedReports\Module::refresh_todays_snapshot()` already uses for its
own whole-site snapshot table. Scoped to only recompute when the
just-completed scan is one of the four `accessibility`-category scanner
ids (unlike that whole-site method, which recomputes on every scan of any
category — appropriate there, wasteful here). The score itself reuses the
identical severity-weighted formula
(`100 - critical*15 - high*8 - medium*3 - low*1`, floored at 0) that
`AdvancedReports`' own whole-site score and `SecurityMonitoring`'s
dashboard share, just recomputed from `FindingRepository::get_severity_breakdown_for_category('accessibility')`
instead of a whole-site count.

### Accessibility Reports — current-state dashboard card

`AccessibilityDashboardRest` (`GET /accessibility-dashboard-stats`) and
`AccessibilityHistoryRest` (`GET /accessibility-history`) back two new
React components. Free's own generic Reports pipeline already covers
exporting a full period report (CSV/PDF, `Reports\Types\AccessibilityReport`)
— these two endpoints are the current-state summary and trend chart, not a
competing report generator.

### Bulk Fixes — mapping into OneClickFix's existing infrastructure

`OneClickFix\BulkFixRest`/`MechanicalFixRunner`/`ScannerFixMap` were
already fully generic across every scanner category before this pass (an
earlier module's own work) — `POST /findings/bulk-fix` loops the exact same
per-finding fix resolution `POST /findings/{id}/fix` already uses, keyed
only by finding id, never by category. This phase's entire "Bulk Fixes"
contribution is mapping the four accessibility scanner ids into
`ScannerFixMap`:

- `accessibility` (content contains *any* `<h1>` at all, on the premise the
  active theme already renders the page's own title as the one true
  `<h1>`) → a new mechanical fix, `demote-content-h1s`
  (`MechanicalFixRunner::demote_content_h1s()`), which demotes every
  content `<h1>` to `<h2>`. Deliberately **not** a reuse of AdvancedSeo's
  existing `demote-extra-h1s` (keeps the first `<h1>`, demotes only
  subsequent ones) despite the superficial similarity — that method is a
  no-op for the single-`<h1>` case this scanner most commonly flags,
  confirmed via live verification.
- `aria-attributes` (a clickable element missing a `role`) → a new
  mechanical fix, `add-missing-aria-roles`
  (`MechanicalFixRunner::add_missing_aria_roles()`), which adds
  `role="button" tabindex="0"` to exactly the elements the scanner itself
  flagged — a deterministic markup edit, not a guess about content.
- `form-labels`/`wcag-scanner` are **deliberately left unmapped** — an
  unlabeled field's correct label text, and a non-ambiguous replacement for
  a "click here" link, both require knowing what the field/link is
  actually *for*. That's the same "guess what to write" editorial judgment
  call `ScannerFixMap`'s own docblock already rules out for
  `orphan-pages`/`seo-images`/`FocusKeywordAuditScanner`. No safe,
  deterministic, or non-presumptuous action exists for either.

### React UI — additive cards on Free's Accessibility.tsx

`AccessibilityDashboardCard.tsx` (backed by `AccessibilityDashboardRest`)
and `AccessibilityHistoryChart.tsx` (backed by `AccessibilityHistoryRest`,
rendered with the same `recharts` `AreaChart` Free's own
`HealthTimelineWidget.tsx` already uses for the whole-site trend) register
into two new filter slots on Free's own `Accessibility.tsx` —
`vulopilot_accessibility_dashboard_card`/`vulopilot_accessibility_history_panel`
— as **additive cards** around the existing `FindingsTable`, same
"register a source, don't modify the host" pattern
`SecurityMonitoring`/GEO/Reports already use.

## What's not here yet

- **A UI for reordering/removing individual ambiguous-link phrases from
  `WcagScanner`'s own dictionary.** The phrase list
  (`WcagScanner::AMBIGUOUS_PHRASES`) is a fixed, small, well-known set —
  same "illustrative, fixed dictionary, not a configurable wordlist"
  posture `WeakPasswordScanner`'s own `COMMON_PASSWORDS` already takes.
- **Color contrast checking.** Genuinely requires rendering the page (a
  headless browser or a screenshot pipeline), which is out of scope for
  this codebase's PHP-side, regex-over-`post_content` scanning approach —
  same category of gap as `SECURITY-MODULE.md`'s "live vulnerability feed"
  (a real, separate infrastructure investment, not something to fake).
- **Bulk-fixing `form-labels`/`wcag-scanner` findings.** See "Bulk Fixes"
  above for why no safe, deterministic fix exists for either yet.
