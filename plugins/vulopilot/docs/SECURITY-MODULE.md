# VuloPilot — Security

Companion to [`DATABASE.md`](DATABASE.md), [`SCANNERS.md`](SCANNERS.md), and
[`AUTOMATION-ENGINE-MODULE.md`](AUTOMATION-ENGINE-MODULE.md). Same
"audit what already exists first" shape as that file: `vulopilot-pro`'s
`SecurityMonitoring` module already shipped 7 scanners (admin-username,
anonymous REST user-enumeration, file editor, debug mode, xmlrpc exposure,
security headers, exposed files) before this pass, but Free had **zero**
scanners under the `security` category at all, and neither plugin had any
scheduling, alerting, vulnerability-database, file-integrity, or
incident-reporting concept.

## Audit: what already existed

| Spec item | Status before this pass |
|---|---|
| Outdated Plugins (Free) | Already fully built — `Scanners\Basic\UpdatesScanner` (category `updates`, not `security`) already flags core/plugin/theme updates via core's own `get_core_updates()`/`get_plugin_updates()`/`get_theme_updates()`. Untouched. |
| Weak Password Detection (Free) | **Did not exist at all.** |
| Basic Vulnerabilities (Free) | **Did not exist as a distinct check** — only `UpdatesScanner`'s generic "a newer version exists" (not the same as "is this specific installed version known-vulnerable"). |
| File Changes (Free) | **Did not exist at all** — no hashing/checksum code anywhere in either plugin. |
| Scheduled Security Monitoring (Pro) | **Did not exist as its own schedule** — security scanners only ran as a side effect of Automation module's own general `scan_frequency` cadence (if that module happened to be active), no independent security-only schedule/setting. |
| Alerts (Pro) | **Did not exist as a security-specific concept** — the closest existing thing, Free's own `notify_on_critical_findings` (`ScanPersistenceListener::maybe_notify_critical_findings()`), already emails on any CRITICAL finding in any category, with a fixed severity and no dedup. |
| Advanced Vulnerabilities (Pro) | **Did not exist at all** — no CVE/vulnerability-database integration anywhere. |
| Integrity Monitoring (Pro) | **Did not exist at all.** |
| Incident Reports (Pro) | **Did not exist as a distinct concept** — `Reports\Types\SecurityReport` (Free) already exists as a generic `category='security'` findings-for-period report; no "incident" framing. |

## Free — four new scanners, all category `security`

All four live in `classes/Scanners/Basic/`, registered in
`ScannerRegistry::get_default_scanner_classes()` alongside the 7
pre-existing Pro `SecurityMonitoring` scanners under the same `security`
category string. Each has its own settings toggle (`Settings → Scanning →
Security`) rather than a whole-category kill switch — same granular,
per-scanner-toggle posture the 4 pre-existing Pro toggles in this category
already established (`enable_rest_api_scanner` etc.), deliberately *not*
a new `enable_security_scanning` category switch, since this category has
never used one.

- **`UpdatesScanner`** (existing, untouched) — "Outdated Plugins."
- **`WeakPasswordScanner`** (`weak-passwords`) — "Weak Password Detection."
  Checks every administrator account's password hash against a small,
  fixed dictionary of the most commonly used passwords via core's own
  `wp_check_password()` — the same hashing/verification path core uses at
  login, so no plaintext candidate is ever stored or logged anywhere
  beyond the in-memory comparison itself. Scoped to administrators only
  (not every registered user) — the accounts whose compromise matters
  most, and checking a bounded dictionary against every user on a large
  membership site would be disproportionate cost. Deliberately a small,
  illustrative dictionary, not a large wordlist: a hardening check ("is
  this guessable in the first ten tries"), not a credential-stuffing tool.
- **`BasicVulnerabilitiesScanner`** (`basic-vulnerabilities`) — "Basic
  Vulnerabilities." Three checks, none overlapping any pre-existing
  scanner: the homepage's own `<meta name="generator">` tag exposing the
  exact core version; the bundled `readme.html` being publicly reachable
  (same exposure, independent of the tag); the database table prefix
  still being the default `wp_`. Distinct from Pro's own "Advanced
  Vulnerabilities": this checks generic hardening/exposure, not specific
  CVEs against specific installed versions.
- **`CoreFileIntegrityScanner`** (`core-file-integrity`) — "File Changes."
  Uses core's own `get_core_checksums()` (the same official,
  api.wordpress.org-published md5 list `wp core verify-checksums`/Site
  Health's own core-file check use) rather than inventing or bundling a
  checksum source — flags modified or missing core files only (matching
  what the published checksums list can actually verify; it enumerates
  files that should exist, not every file that shouldn't). Deliberately
  core-only: core ships an authoritative baseline to diff against;
  third-party plugin/theme files don't, which is exactly the gap Pro's
  own "Integrity Monitoring" closes with a locally-maintained baseline
  instead.

### Schema addition: `vulopilot_file_baselines`

A new table + `Repositories\FileBaselineRepository`, both Free-owned —
same "Free owns the schema/Repository, Pro owns the population/diff
logic" split `vulopilot_entity_relationships`/`vulopilot_geo_visibility_history`
already establish. Empty and inert without Pro's Integrity Monitoring
scanner active. See `DATABASE.md` for the full column list.

## Pro (`modules/SecurityMonitoring/`)

### Scheduled Security Monitoring — an independent cadence

`SecurityScanScheduler` — its own small wp-cron wrapper (own hook
`vulopilot_pro_security_scan`, own setting `security_scan_frequency`:
`disabled`/`hourly`/`daily`/`weekly`), calling
`ScanRunner::run_category('security')` rather than `run_all()`. Not built
by reusing Automation module's own `Scheduler` class: that instance is
only ever constructed when the Automation module itself is active, and
Security Monitoring must keep working (including its own schedule) with
Automation switched off — each Pro module is its own independently
toggleable package, not a dependency of another Pro module.

### Alerts — security-scoped, threshold-configurable, de-duplicated

`AlertDispatcher` self-hooks the same `vulopilot_scan_completed` action
Free's own `ScanPersistenceListener`/`RuleEngine` already hook. Differs
from Free's existing `notify_on_critical_findings` in three ways: scoped
to `security`-category findings only (not every category); a configurable
minimum severity (`security_alert_min_severity`, default `high`) rather
than a fixed CRITICAL; and de-duplicated via a per-scanner transient of
already-alerted finding signatures, so a still-open finding a recurring
scheduled scan re-detects doesn't re-send an email every single run.
Delivers via `wp_mail()` (`security_alert_email`, falls back to the site
admin email) and logs to the existing `vulopilot_activity_logs`
(`ActivityLogRepository`, the same generic building block Automation's
`CreateNotificationAction` already uses) — reused, not duplicated.

### Advanced Vulnerabilities — version-specific, not just version-lag

`AdvancedVulnerabilitiesScanner` (`advanced-vulnerabilities`) matches each
installed plugin's *exact version* against a `Contracts\VulnerabilityFeedInterface`'s
known-vulnerable ranges, surfacing the specific CVE and the version that
fixes it — deeper than Free's `UpdatesScanner` ("a newer version exists")
or `BasicVulnerabilitiesScanner` (generic hardening, no CVE data at all).

**Known gap, documented rather than silently worked around** (same
"document, don't silently fix" posture the root `CLAUDE.md` already takes
for this repo's other inherited gaps): the default feed,
`LocalSeedVulnerabilityFeed`, is a small, entirely local, illustrative
dataset using deliberately fictional plugin slugs — never a real
published plugin's name or slug, so this never makes a security claim
about any real, currently-maintained third-party plugin. A real feed
needs either a live, credentialed external intelligence API (a commercial
CVE database this codebase has no account/API key for) or a
self-maintained dataset someone has to keep current — neither is
something to fabricate a fake external HTTP integration for. Swap in a
real feed later via the `vulopilot_pro_vulnerability_feed` filter without
touching the scanner itself.

### Integrity Monitoring — a locally-maintained baseline for plugins/themes

`IntegrityMonitoringScanner` (`integrity-monitoring`) hashes (sha256) every
`.php` file under `WP_PLUGIN_DIR`/`get_theme_root()`, capped at
`integrity_monitoring_max_files` (default 2000, combined across both) to
bound cost on large sites, and diffs against `FileBaselineRepository`. The
very first run ever seeds the baseline silently (no Findings — "every file
on disk right now" is the starting state, not a change) via the
`vulopilot_pro_integrity_baseline_established` option flag; every run
after that reports files added, modified, or removed since the previous
baseline.

### Incident Reports — a presentation layer, not a new schema

`IncidentsRest` (`GET /security-incidents`) re-presents every open
`security`-category Finding as an "incident," worst severity first —
deliberately not a new schema/concept: `FindingRepository`'s own `status`
field (`open`/`resolved`/`ignored`/`snoozed`) already **is** an incident's
lifecycle, and the Security page's existing `FindingsTable` resolve/
ignore/snooze actions already **are** how an incident gets closed. This
endpoint only re-presents that same data, filtered and framed, rather than
duplicating Findings' own persistence or status machinery.

### React UI — this module's first-ever frontend

`SecurityMonitoring` had zero `src/`/REST surface before this pass.
`SecurityDashboardCard.tsx` (backed by a new `GET /security-dashboard-stats`,
`SecurityDashboardRest.php`) and `IncidentReportsPanel.tsx` (backed by
`IncidentsRest`) register into two new filter slots on Free's own
`Security.tsx` — `vulopilot_security_dashboard_card`/
`vulopilot_security_incident_reports_panel` — as **additive cards**
alongside the existing `FindingsTable`, not a full-page replacement the
way Automation's single `vulopilot_automation_panel` slot works: Security
findings are already useful with Free alone (the FindingsTable already
shows every `security` finding, Free or Pro), so this page only adds
extra cards on top rather than gating its base content behind Pro.

## What's not here yet

- **A live/credentialed vulnerability intelligence feed.** See Advanced
  Vulnerabilities' own section above.
- **File-integrity monitoring for uploads/mu-plugins/wp-config.php.**
  Scoped to plugin/theme `.php` files only, matching what actually
  executes; broadening scope is a bounded, separate follow-up.
- **Alert delivery channels beyond email + the activity log** (e.g. a
  webhook/Slack integration) — same reasoning `RestTrigger`'s own
  docblock gives for not building a dedicated webhook credential system in
  `AUTOMATION-ENGINE-MODULE.md`'s pass: real, additional surface area
  deliberately not built here.
- **A UI toggle to disable individual `SecurityMonitoring` scanners
  beyond what already has one.** `enable_xmlrpc_scanner`/
  `enable_security_headers_scanner`/`enable_exposed_files_scanner` are
  real, pre-existing settings keys their respective scanners already read,
  but only `enable_rest_api_scanner` has ever had its own field on the
  Settings screen — a pre-existing gap, unrelated to this pass, left
  documented rather than silently expanded in scope.
