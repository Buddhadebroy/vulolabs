# Automations, Scan Persistence and History Core

Code reference for `classes/Automations`, `classes/Utill` (scan/finding pipeline) and `classes/Reports`. User views: [../user/AUTOMATIONS.md](../user/AUTOMATIONS.md), [../user/REPORTS.md](../user/REPORTS.md). Engine detail: [AUTOMATION-ENGINE-MODULE](AUTOMATION-ENGINE-MODULE.md).

## Scan to finding pipeline

```
ScanRunner::run($scanner_id) / run_all() / run_category($category)
   -> each Scanner::scan() returns Finding[]
   -> do_action('vulopilot_scan_completed', ScanResult)
ScanPersistenceListener  -> writes vulopilot_scans / vulopilot_scan_findings
   -> do_action('vulopilot_scan_persisted', $result, $scan_id)
RuleEngine               -> RuleRegistry rules turn findings into Recommendations
   -> do_action('vulopilot_recommendations_generated')
```

## Built-in automations

`BuiltinAutomationSeeder` creates two rows in `vulopilot_automations`: a full site scan and a visibility report. `AutomationScheduler` runs them on WP-Cron and records each run in `vulopilot_automations_runs`.

- The scan automation calls `ScanRunner`.
- The report automation calls the `vulopilot_send_scheduled_visibility_report` filter. A handler returns `true` (sent), `false` (failed) or leaves the initial `null`, in which case the run is recorded as failed with "No report delivery extension is active."

## Manual actions

`Automations\ManualActionRunner` runs one registered action against one finding. Add actions with `vulopilot_manual_action_sources`. `SnoozeFindingAction` is the built-in example.

## Reports and history

`Reports\ReportRepository` is storage and query only (table `vulopilot_reports`). The History tab reads the activity log (`vulopilot_activity_logs`) and AI history (`vulopilot_ai_history`) through `Dashboard\Rest` and `AiCopilot` controllers; see [REST-API](REST-API.md).

## Class reference

### `classes/Automations`

| Class | File | What it does |
|---|---|---|
| `ActionRegistry` | `classes/Automations/ActionRegistry.php` | - |
| `AutomationScheduler` | `classes/Automations/AutomationScheduler.php` | - |
| `AutomationsRepository` | `classes/Automations/AutomationsRepository.php` | Persistence for vulopilot_automations (DATABASE.md). |
| `AutomationsRunRepository` | `classes/Automations/AutomationsRunRepository.php` | Persistence for vulopilot_automations_runs (DATABASE.md) - one row per time AutomationEngine ran (or attempted to run) an automation's actions. |
| `AutomationsRunResult` | `classes/Automations/AutomationsRunResult.php` | The outcome of a single Contracts\Automations\ActionInterface::execute() call - AutomationEngine\AutomationEngine aggregates one or more of these (an automation can run several actions in sequence) into the `vulopilot_automations_ |
| `BuiltinAutomationSeeder` | `classes/Automations/BuiltinAutomationSeeder.php` | - |
| `ManualActionRunner` | `classes/Automations/ManualActionRunner.php` | ActionInterface::execute() takes a Recommendation, not a Finding - this class is the one place that builds a synthetic one directly off a real Finding row (`rule_id` = self::MANUAL_RULE_ID) rather than getting it from RuleEngine:: |
| `SnoozeFindingAction` | `classes/Automations/Actions/SnoozeFindingAction.php` | - |
| `AutomationDashboardStats` | `classes/Automations/Rest/AutomationDashboardStats.php` | - |
| `Automations` | `classes/Automations/Rest/Automations.php` | GET /automations backs src/pages/Automations/Automations.tsx's table. |

Hooks and routes registered by these classes:

- `ActionRegistry` - hooks: `init`
- `AutomationScheduler` - hooks: `cron_schedules`, `init`
- `BuiltinAutomationSeeder` - hooks: `init`
- `AutomationDashboardStats` - routes: `/automation-dashboard-stats`
- `Automations` - routes: `/automations`, `/automations/(?P<id>\d+)`, `/automations/(?P<id>\d+)/run`

### `classes/Utill` (contracts, registries, runners)

| Class | File | What it does |
|---|---|---|
| `AIActionInterface` | `classes/Utill/AIActionInterface.php` | - |
| `AbstractBasicRule` | `classes/Utill/AbstractBasicRule.php` | Base class for every free-tier rule across every tab folder. |
| `ActionInterface` | `classes/Utill/ActionInterface.php` | An Automation Engine action - deliberately simpler than Contracts\AI\AIActionInterface's propose/approve/reject/rollback lifecycle: these run synchronously when an automation's trigger fires and its bound rule matches, with no sep |
| `Finding` | `classes/Utill/Finding.php` | A single issue surfaced by a Scanner. |
| `FindingRepository` | `classes/Utill/FindingRepository.php` | Persistence for vulopilot_scan_findings (DATABASE.md). |
| `Findings` | `classes/Utill/Findings.php` | GET /findings backs the shared FindingsTable component (Health/SEO/GEO/ Commerce/Dashboard pages - src/components/FindingsTable.tsx). |
| `Impact` | `classes/Utill/Impact.php` | A rule's estimated impact if its recommendation is resolved. |
| `Recommendation` | `classes/Utill/Recommendation.php` | What RuleEngine\RuleEngine turns a Finding into, via a matching RuleInterface::get_recommendation(). |
| `RepositoryInterface` | `classes/Utill/RepositoryInterface.php` | Generic CRUD contract so Free's repositories (Utill\RepositoryUtil and its concrete subclasses) are swappable/mockable in tests, per ARCHITECTURE.md. |
| `RepositoryUtil` | `classes/Utill/RepositoryUtil.php` | Shared $wpdb CRUD implementation for every VuloPilot custom table. |
| `RuleEngine` | `classes/Utill/RuleEngine.php` | VuloPilot RuleEngine class. |
| `RuleInterface` | `classes/Utill/RuleInterface.php` | - |
| `RuleRegistry` | `classes/Utill/RuleRegistry.php` | VuloPilot RuleRegistry class. |
| `RuleType` | `classes/Utill/RuleType.php` | The kind of recommendation a rule produces. |
| `ScanPersistenceListener` | `classes/Utill/ScanPersistenceListener.php` | VuloPilot ScanPersistenceListener class. |
| `ScanRepository` | `classes/Utill/ScanRepository.php` | Persistence for vulopilot_scans (DATABASE.md). |
| `ScanResult` | `classes/Utill/ScanResult.php` | The outcome of running a single ScannerInterface - fired as `do_action('vulopilot_scan_completed', $result)` by Scanners\ScanRunner. |
| `ScanRunner` | `classes/Utill/ScanRunner.php` | VuloPilot ScanRunner class. |
| `ScannedPostsTrait` | `classes/Utill/ScannedPostsTrait.php` | Gives a per-post scanner a one-line way to record every post it actually considered during scan() - call mark_post_scanned() inside the loop, before any `continue`, so a post that turned out clean is recorded the same as one that  |
| `ScannerInterface` | `classes/Utill/ScannerInterface.php` | - |
| `ScannerRegistry` | `classes/Utill/ScannerRegistry.php` | VuloPilot ScannerRegistry class. |
| `ScannerUtil` | `classes/Utill/ScannerUtil.php` | Base class for every free-tier scanner across every tab folder (Dashboard/, SeoVisibility/, Content/, etc.). |
| `Scans` | `classes/Utill/Scans.php` | GET /scans lists past scan runs; POST /scans triggers one synchronously via VuloPilot()->scan_runner (Scanners\ScanRunner - already wired in VuloPilot::init_classes()). |
| `ScoreSnapshotRepository` | `classes/Utill/ScoreSnapshotRepository.php` | The free tier's daily category score history behind the Performance "Speed History" and Security "Security Trend" cards - a `performance`/`security` slice of `vulopilot_snapshots`. |
| `Severity` | `classes/Utill/Severity.php` | Finding severity levels. |
| `SnapshotRepository` | `classes/Utill/SnapshotRepository.php` | Daily-snapshot storage shared by every "score history" feature - one row per (`snapshot_type`, `snapshot_date`) in `vulopilot_snapshots`, with the day's values kept together as JSON in `data`. |
| `StoreReadiness` | `classes/Utill/StoreReadiness.php` | - |
| `SupportsForceRunInterface` | `classes/Utill/SupportsForceRunInterface.php` | Optional companion to ScannerInterface (same "optional, instanceof-checked add-on" shape as TracksScannedObjectsInterface), implemented only by a scanner that self-rate-limits its own real work independently of the shared scan cad |
| `TracksScannedObjectsInterface` | `classes/Utill/TracksScannedObjectsInterface.php` | Optional companion to ScannerInterface, implemented only by scanners that iterate individual posts/pages (Scanners\Basic\ScannedPostsTrait). |
| `TriggerInterface` | `classes/Utill/TriggerInterface.php` | - |
| `UnresolvedCriticalFindingRule` | `classes/Utill/UnresolvedCriticalFindingRule.php` | The one cross-cutting rule in this set: applies to any Finding with Severity::CRITICAL regardless of category (get_categories() returns an empty array - see RuleInterface's docblock for what that means), and always produces the en |
| `VuloPilotException` | `classes/Utill/VuloPilotException.php` | Single exception class for every VuloPilot-specific failure that used to be its own subclass (AiRequestException, GatewayRequestException, a "VuloCloud has no usable key" subclass, RateLimitExceededException, TransientGatewayExcep |

Hooks and routes registered by these classes:

- `Findings` - routes: `/findings`, `/findings/(?P<id>\d+)`, `/findings/(?P<id>\d+)/actions/(?P<action_id>[a-z0-9-]+)`, `/findings/attention-summary`, `/findings/bulk`, `/findings/groups`
- `RuleEngine` - hooks: `vulopilot_scan_completed`
- `RuleRegistry` - hooks: `init`
- `ScanPersistenceListener` - hooks: `vulopilot_scan_completed`
- `ScannerRegistry` - hooks: `init`
- `Scans` - routes: `/scans`
- `StoreReadiness` - routes: `/store-readiness`

### `classes/Reports`

| Class | File | What it does |
|---|---|---|
| `ReportRepository` | `classes/Reports/ReportRepository.php` | Persistence for vulopilot_reports (DATABASE.md). |
| `History` | `classes/Reports/Rest/History.php` | GET /history backs the AI Copilot page's History tab (HistoryTab.tsx) - a real, day-groupable activity timeline, distinct from `GET /activity-logs` (ActivityLogs.php, Free, backs Reports > Activity's own flat, unfiltered table): t |

Hooks and routes registered by these classes:

- `History` - routes: `/history`, `/history/(?P<id>\d+)`
