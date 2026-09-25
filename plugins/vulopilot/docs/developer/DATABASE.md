# Database Reference

The free plugin creates **17 custom tables**. This page lists each one with its columns and indexes (generated from `classes/Install.php`), what writes to it and the rules that apply to it.

For where settings, post meta and user meta live, see [Other storage](#other-storage).

## How the schema is managed

- Tables are declared in `Utill::TABLES` (key => table name) and created in `classes/Install.php` with `dbDelta()`. Every table name is prefixed with `$wpdb->prefix`.
- `Install::install()` runs on activation and whenever the stored version (option `vulopilot_version`) differs from the plugin version. It is safe to run repeatedly: `dbDelta()` only creates what is missing and adds new columns.
- New columns are added by editing the `CREATE TABLE` statement. Do not drop or repurpose a column in a later release.
- Some `CREATE TABLE` statements deliberately omit `IF NOT EXISTS`. `dbDelta()` mis-reads the table name when that clause is present and then skips adding new columns on existing sites. If you add a column to one of those tables, keep the statement without it.
- Always go through the matching repository class in `classes/*`, never raw `$wpdb` queries scattered in features. Repositories use prepared statements.

## Conventions

- `id` is `bigint(20) unsigned AUTO_INCREMENT`.
- `*_id` columns are plain indexed integers, not foreign key constraints. WordPress core does the same and `dbDelta()` does not manage constraints; integrity is enforced in the repository layer.
- `object_type` + `object_ref` / `object_id` are used only where the target genuinely varies (findings, activity, AI history).
- JSON is stored as `longtext` and encoded with `wp_json_encode()` / decoded with `json_decode()` in the repository.
- Timestamps are `created_at` (and where needed `updated_at`, `started_at`, `finished_at`). Times the plugin writes itself use UTC (`current_time( 'mysql', true )`); columns that default to `CURRENT_TIMESTAMP` use the database server's time.

## Table list

| Key in `Utill::TABLES` | Table | Purpose | Repository |
|---|---|---|---|
| `scan` | `{prefix}vulopilot_scans` | One row per scanner run. | ScanRepository |
| `scan_finding` | `{prefix}vulopilot_scan_findings` | One row per problem a scanner found. | FindingRepository |
| `automations` | `{prefix}vulopilot_automations` | One row per automation: a trigger, optional conditions and a list of actions. | AutomationsRepository |
| `automations_run` | `{prefix}vulopilot_automations_runs` | History of automation executions. | AutomationsRunRepository |
| `ai_history` | `{prefix}vulopilot_ai_history` | A permanent, excerpt-only audit trail of AI calls, shown in Reports -> History. | AiHistoryRepository |
| `ai_conversation` | `{prefix}vulopilot_ai_conversations` | Full AI Copilot chat threads, so a conversation can be reopened. | AiConversationRepository |
| `ai_action_run` | `{prefix}vulopilot_ai_action_runs` | The propose, approve, execute and roll back history for every AI action. | ActionRunRepository |
| `report` | `{prefix}vulopilot_reports` | Records of generated reports and their files. | ReportRepository |
| `activity_log` | `{prefix}vulopilot_activity_logs` | General audit trail of meaningful site events (scans, changes, alerts). | ActivityLogRepository |
| `snapshot` | `{prefix}vulopilot_snapshots` | Daily rollups used for trend charts. | SnapshotRepository / ScoreSnapshotRepository |
| `crawler_visit` | `{prefix}vulopilot_crawler_visits` | Visits by known AI crawlers, detected by user agent. | CrawlerVisitRepository |
| `redirect` | `{prefix}vulopilot_redirects` | Redirect rules used by the redirect manager. | RedirectRepository |
| `not_found_log` | `{prefix}vulopilot_not_found_logs` | Requests that returned 404, written by `NotFoundLogger` when the `log_404s` setting is on. | NotFoundLogRepository |
| `performance_sample` | `{prefix}vulopilot_performance_samples` | Short-retention samples of speed data. | PerformanceRequestRepository, CoreWebVitalsRepository |
| `page_speed` | `{prefix}vulopilot_page_speed` | Per-page results from Google PageSpeed Insights, shown on the Slow Pages tab. | PageSpeedRepository |
| `security_event` | `{prefix}vulopilot_security_events` | Login attempts and firewall matches, used by login protection and the firewall log. | LoginAttemptRepository, FirewallBlockRepository |
| `backup` | `{prefix}vulopilot_backups` | One row per backup, including the automatic safety snapshot taken before a restore. | BackupRepository |

## Relationships

```
scans 1 ---- * scan_findings                 (scan_findings.scan_id)
automations 1 ---- * automation_runs         (automations_runs.automation_id)
ai_action_runs        stands alone; AI actions reference their target by object_type + object_ref
ai_history / activity_logs   reference any object by object_type + object_id
snapshots / page_speed / performance_samples / crawler_visits / security_events / backups   stand alone
```

## 1. `vulopilot_scans`

One row per scanner run. Written by `ScanRunner` and `ScanPersistenceListener`. Repository: `ScanRepository`.

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | `bigint(20) unsigned` | no |  |
| `scanner_id` | `varchar(100)` | no |  |
| `scanner_tier` | `varchar(20)` | no | `'free'` |
| `status` | `varchar(20)` | no | `'queued'` |
| `trigger_type` | `varchar(20)` | no | `'manual'` |
| `triggered_by` | `bigint(20) unsigned` | yes | `NULL` |
| `started_at` | `datetime` | yes | `NULL` |
| `finished_at` | `datetime` | yes | `NULL` |
| `duration_ms` | `int(10) unsigned` | yes | `NULL` |
| `summary` | `longtext` | yes | `NULL` |
| `scanned_objects` | `longtext` | yes | `NULL` |
| `error_message` | `text` | yes | `NULL` |
| `created_at` | `timestamp` | no | `CURRENT_TIMESTAMP` |

Indexes: `PRIMARY KEY (id)`; `KEY idx_scanner (scanner_id)`; `KEY idx_status (status)`; `KEY idx_created (created_at)`.

- `status` moves `queued` -> `running` -> `completed` or `failed`; `error_message` explains a failure.
- `trigger_type` says whether a person or a schedule started the run; `triggered_by` is the user id when it was a person.
- `summary` and `scanned_objects` are JSON stored as `longtext`.

## 2. `vulopilot_scan_findings`

One row per problem a scanner found. This is the table behind every list of issues and every score. Repository: `FindingRepository`.

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | `bigint(20) unsigned` | no |  |
| `scan_id` | `bigint(20) unsigned` | no |  |
| `scanner_id` | `varchar(100)` | no |  |
| `severity` | `varchar(20)` | no | `'info'` |
| `category` | `varchar(50)` | no |  |
| `title` | `varchar(255)` | no |  |
| `description` | `longtext` | yes | `NULL` |
| `object_type` | `varchar(50)` | yes | `NULL` |
| `object_ref` | `varchar(255)` | yes | `NULL` |
| `dedupe_key` | `varchar(255)` | yes | `NULL` |
| `status` | `varchar(20)` | no | `'open'` |
| `resolved_at` | `datetime` | yes | `NULL` |
| `meta` | `longtext` | yes | `NULL` |
| `created_at` | `timestamp` | no | `CURRENT_TIMESTAMP` |
| `last_seen_at` | `timestamp` | no | `CURRENT_TIMESTAMP` |

Indexes: `PRIMARY KEY (id)`; `KEY idx_scan (scan_id)`; `KEY idx_severity (severity)`; `KEY idx_status (status)`; `KEY idx_category (category)`.

- `dedupe_key` identifies the same problem across scans, so a finding is updated (`last_seen_at`) rather than duplicated.
- `status` is separate from the scan's status: a scan finishes once, but a finding stays `open` until a later scan no longer reports it (then it is `resolved`, with `resolved_at`).
- `object_type` + `object_ref` say what the finding is about (a post, URL, file, plugin slug and so on). There is no single typed column because the target varies.
- `meta` is JSON with scanner-specific detail.

## 3. `vulopilot_automations`

One row per automation: a trigger, optional conditions and a list of actions. The two built-in automations are seeded by `BuiltinAutomationSeeder`. Repository: `AutomationsRepository`.

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | `bigint(20) unsigned` | no |  |
| `name` | `varchar(191)` | no |  |
| `rule_id` | `bigint(20) unsigned` | yes | `NULL` |
| `category` | `varchar(30)` | no | `'monitoring'` |
| `trigger_type` | `varchar(50)` | no |  |
| `trigger_config` | `longtext` | yes | `NULL` |
| `conditions` | `longtext` | yes | `NULL` |
| `actions` | `longtext` | no |  |
| `status` | `varchar(20)` | no | `'enabled'` |
| `last_triggered_at` | `datetime` | yes | `NULL` |
| `created_by` | `bigint(20) unsigned` | yes | `NULL` |
| `created_at` | `timestamp` | no | `CURRENT_TIMESTAMP` |
| `updated_at` | `timestamp` | no | `CURRENT_TIMESTAMP` |

Indexes: `PRIMARY KEY (id)`; `KEY idx_rule (rule_id)`; `KEY idx_status (status)`; `KEY idx_trigger_type (trigger_type)`; `KEY idx_category (category)`.

- `trigger_config`, `conditions` and `actions` are JSON.
- `rule_id` is nullable and unused by the built-in automations.
- `last_triggered_at` is updated by `AutomationScheduler`.

## 4. `vulopilot_automations_runs`

History of automation executions. Written by `AutomationScheduler` for every run. Repository: `AutomationsRunRepository`.

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | `bigint(20) unsigned` | no |  |
| `automation_id` | `bigint(20) unsigned` | no |  |
| `triggered_by` | `varchar(50)` | no |  |
| `trigger_ref_id` | `bigint(20) unsigned` | yes | `NULL` |
| `status` | `varchar(20)` | no | `'running'` |
| `actions_executed` | `int(10) unsigned` | no | `0` |
| `actions_failed` | `int(10) unsigned` | no | `0` |
| `changes_made` | `int(10) unsigned` | no | `0` |
| `result_log` | `longtext` | yes | `NULL` |
| `retry_count` | `tinyint(3) unsigned` | no | `0` |
| `started_at` | `datetime` | no |  |
| `finished_at` | `datetime` | yes | `NULL` |
| `created_at` | `timestamp` | no | `CURRENT_TIMESTAMP` |

Indexes: `PRIMARY KEY (id)`; `KEY idx_automation (automation_id)`; `KEY idx_status (status)`; `KEY idx_started (started_at)`.

- `status`, `actions_executed`, `actions_failed` and `changes_made` summarize the run; `result_log` is JSON detail per action.
- `retry_count` counts retries, capped by the `automation_max_retries` setting.

## 5. `vulopilot_ai_history`

A permanent, excerpt-only audit trail of AI calls, shown in Reports -> History. Repository: `AiHistoryRepository`.

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | `bigint(20) unsigned` | no |  |
| `request_id` | `varchar(64)` | yes | `NULL` |
| `credits_used` | `int(10) unsigned` | yes | `NULL` |
| `object_type` | `varchar(50)` | yes | `NULL` |
| `object_id` | `bigint(20) unsigned` | yes | `NULL` |
| `surface` | `varchar(30)` | yes | `NULL` |
| `status` | `varchar(20)` | no |  |
| `prompt_excerpt` | `text` | yes | `NULL` |
| `response_excerpt` | `text` | yes | `NULL` |
| `requested_by` | `bigint(20) unsigned` | yes | `NULL` |
| `created_at` | `timestamp` | no | `CURRENT_TIMESTAMP` |

Indexes: `PRIMARY KEY (id)`; `KEY idx_request_id (request_id)`; `KEY idx_created (created_at)`; `KEY idx_object (object_type, object_id)`; `KEY idx_surface (surface)`.

- Every AI call writes one row. There is no separate job queue table.
- Only excerpts of the prompt and response are stored, not full text, to limit retention of personal data.
- `credits_used` and `request_id` come from VuloCloud. `surface` records which screen or feature made the call.

## 6. `vulopilot_ai_conversations`

Full AI Copilot chat threads, so a conversation can be reopened. Repository: `AiConversationRepository`.

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | `bigint(20) unsigned` | no |  |
| `user_id` | `bigint(20) unsigned` | no |  |
| `title` | `varchar(255)` | no |  |
| `turns` | `longtext` | no |  |
| `created_at` | `datetime` | no | `CURRENT_TIMESTAMP` |
| `updated_at` | `datetime` | no | `CURRENT_TIMESTAMP` |

Indexes: `PRIMARY KEY (id)`; `KEY idx_user_id (user_id)`; `KEY idx_updated_at (updated_at)`.

- `turns` is JSON holding the whole thread.
- Deliberately separate from `ai_history`, which stores excerpts only.

## 7. `vulopilot_ai_action_runs`

The propose -> approve -> execute -> roll back history for every AI action ([AI-ACTIONS](AI-ACTIONS.md)). Repository: `ActionRunRepository`.

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | `bigint(20) unsigned` | no |  |
| `action_id` | `varchar(100)` | no |  |
| `status` | `varchar(20)` | no | `'pending_approval'` |
| `object_type` | `varchar(50)` | yes | `NULL` |
| `object_ref` | `varchar(255)` | yes | `NULL` |
| `input` | `longtext` | yes | `NULL` |
| `output` | `longtext` | yes | `NULL` |
| `preview` | `longtext` | yes | `NULL` |
| `snapshot` | `longtext` | yes | `NULL` |
| `error_message` | `text` | yes | `NULL` |
| `requested_by` | `bigint(20) unsigned` | yes | `NULL` |
| `approved_by` | `bigint(20) unsigned` | yes | `NULL` |
| `approval_method` | `varchar(20)` | no | `'manual'` |
| `risk_level` | `varchar(10)` | no | `'medium'` |
| `created_at` | `timestamp` | no | `CURRENT_TIMESTAMP` |
| `approved_at` | `datetime` | yes | `NULL` |
| `executed_at` | `datetime` | yes | `NULL` |
| `rolled_back_at` | `datetime` | yes | `NULL` |

Indexes: `PRIMARY KEY (id)`; `KEY idx_action (action_id)`; `KEY idx_status (status)`; `KEY idx_object (object_type, object_ref)`.

- `status` starts at `pending_approval`. `approved_by` and `approval_method` record who approved and how.
- `input`, `output`, `preview` and `snapshot` are JSON; `snapshot` holds what `rollback()` needs to undo the change.
- `risk_level` is set by the action; timestamps record approval, execution and rollback.

## 8. `vulopilot_reports`

Records of generated reports and their files. Repository: `ReportRepository`.

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | `bigint(20) unsigned` | no |  |
| `report_type` | `varchar(50)` | no |  |
| `format` | `varchar(10)` | no | `'pdf'` |
| `period_start` | `date` | yes | `NULL` |
| `period_end` | `date` | yes | `NULL` |
| `status` | `varchar(20)` | no | `'generating'` |
| `file_path` | `varchar(255)` | yes | `NULL` |
| `generated_by` | `bigint(20) unsigned` | yes | `NULL` |
| `meta` | `longtext` | yes | `NULL` |
| `created_at` | `timestamp` | no | `CURRENT_TIMESTAMP` |

Indexes: `PRIMARY KEY (id)`; `KEY idx_type (report_type)`; `KEY idx_status (status)`; `KEY idx_period (period_start, period_end)`.

- `file_path` holds only the file's base name. The real path is always rebuilt on the server from `wp_upload_dir()` and never trusted from a client.
- `period_start` and `period_end` define the covered dates; `meta` is JSON.

## 9. `vulopilot_activity_logs`

General audit trail of meaningful site events (scans, changes, alerts). Feeds the Recent activity card and the History tab. Repository: `ActivityLogRepository`.

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | `bigint(20) unsigned` | no |  |
| `event_type` | `varchar(100)` | no |  |
| `object_type` | `varchar(50)` | yes | `NULL` |
| `object_id` | `bigint(20) unsigned` | yes | `NULL` |
| `actor_type` | `varchar(20)` | no | `'system'` |
| `actor_id` | `bigint(20) unsigned` | yes | `NULL` |
| `message` | `text` | no |  |
| `severity` | `varchar(20)` | no | `'info'` |
| `meta` | `longtext` | yes | `NULL` |
| `created_at` | `timestamp` | no | `CURRENT_TIMESTAMP` |

Indexes: `PRIMARY KEY (id)`; `KEY idx_event (event_type)`; `KEY idx_object (object_type, object_id)`; `KEY idx_created (created_at)`.

- `object_type` + `object_id` reference whatever the event was about.
- `actor_type` / `actor_id` say who did it (a user, the system or an automation).

## 10. `vulopilot_snapshots`

Daily rollups used for trend charts. One row per snapshot type per day. Repository: `SnapshotRepository / ScoreSnapshotRepository`.

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | `bigint(20) unsigned` | no |  |
| `snapshot_type` | `varchar(30)` | no |  |
| `snapshot_date` | `date` | no |  |
| `data` | `longtext` | no |  |
| `created_at` | `timestamp` | no | `CURRENT_TIMESTAMP` |

Indexes: `PRIMARY KEY (id)`; `UNIQUE KEY uniq_type_date (snapshot_type, snapshot_date)`.

- `snapshot_type` names the feature (for example a performance or security score). `data` is JSON.
- The unique key `(snapshot_type, snapshot_date)` guarantees one row per type per day.

## 11. `vulopilot_crawler_visits`

Visits by known AI crawlers, detected by user agent. Repository: `CrawlerVisitRepository`.

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | `bigint(20) unsigned` | no |  |
| `bot_name` | `varchar(50)` | no |  |
| `user_agent` | `varchar(255)` | no |  |
| `requested_url` | `varchar(255)` | no |  |
| `is_404` | `tinyint(1) unsigned` | no | `0` |
| `created_at` | `timestamp` | no | `CURRENT_TIMESTAMP` |

Indexes: `PRIMARY KEY (id)`; `KEY idx_bot (bot_name)`; `KEY idx_created (created_at)`.

- Stores the bot name, user agent and requested URL only. No IP address or other visitor data.
- Old rows are pruned according to the `log_retention` setting and the `vulopilot_crawler_log_retention_days` filter.

## 12. `vulopilot_redirects`

Redirect rules used by the redirect manager. Applied by `RedirectManager` at request time. Repository: `RedirectRepository`.

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | `bigint(20) unsigned` | no |  |
| `source_path` | `varchar(255)` | no |  |
| `target_url` | `varchar(255)` | no |  |
| `redirect_type` | `smallint(3) unsigned` | no | `301` |
| `hit_count` | `int(10) unsigned` | no | `0` |
| `is_active` | `tinyint(1)` | no | `1` |
| `created_by` | `bigint(20) unsigned` | yes | `NULL` |
| `created_at` | `timestamp` | no | `CURRENT_TIMESTAMP` |
| `updated_at` | `timestamp` | no | `CURRENT_TIMESTAMP` |
| `last_accessed_at` | `datetime` | yes | `NULL` |

Indexes: `PRIMARY KEY (id)`; `UNIQUE KEY uniq_source_path (source_path)`; `KEY idx_active (is_active)`.

- `redirect_type` is the HTTP status (for example 301).
- `hit_count` and `last_accessed_at` are updated each time a rule fires; `is_active` switches a rule off without deleting it.

## 13. `vulopilot_not_found_logs`

Requests that returned 404, written by `NotFoundLogger` when the `log_404s` setting is on. Repository: `NotFoundLogRepository`.

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | `bigint(20) unsigned` | no |  |
| `requested_path` | `varchar(255)` | no |  |
| `referrer` | `varchar(255)` | yes | `NULL` |
| `hit_count` | `int(10) unsigned` | no | `1` |
| `last_seen_at` | `datetime` | no |  |
| `created_at` | `timestamp` | no | `CURRENT_TIMESTAMP` |
| `is_system` | `tinyint(1)` | no | `0` |

Indexes: `PRIMARY KEY (id)`; `UNIQUE KEY uniq_requested_path (requested_path)`; `KEY idx_last_seen (last_seen_at)`; `KEY idx_is_system (is_system)`.

- One row per requested path, with `hit_count` and `last_seen_at` updated on repeats.
- `is_system` marks theme, plugin and core-asset requests so the UI can separate them from content 404s.

## 14. `vulopilot_performance_samples`

Short-retention samples of speed data. Repository: `PerformanceRequestRepository, CoreWebVitalsRepository`.

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | `bigint(20) unsigned` | no |  |
| `sample_type` | `varchar(10)` | no |  |
| `response_time_ms` | `smallint(5) unsigned` | yes | `NULL` |
| `lcp_ms` | `smallint(5) unsigned` | yes | `NULL` |
| `cls_thousandths` | `smallint(5) unsigned` | yes | `NULL` |
| `inp_ms` | `smallint(5) unsigned` | yes | `NULL` |
| `page_load_ms` | `smallint(5) unsigned` | yes | `NULL` |
| `transfer_bytes` | `int(10) unsigned` | yes | `NULL` |
| `created_at` | `timestamp` | no | `CURRENT_TIMESTAMP` |

Indexes: `PRIMARY KEY (id)`; `KEY idx_type_created (sample_type, created_at)`.

- `sample_type` = `request` is a server response-time sample per front-end request; `vital` is a real-visitor Core Web Vitals report from the browser beacon.
- A metric the browser could not measure is NULL, never a made-up zero. `cls_thousandths` stores CLS times 1000 as an integer.
- No visitor-identifying column exists.

## 15. `vulopilot_page_speed`

Per-page results from Google PageSpeed Insights, shown on the Slow Pages tab. Repository: `PageSpeedRepository`.

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | `bigint(20) unsigned` | no |  |
| `url` | `varchar(500)` | no |  |
| `title` | `varchar(255)` | no | `''` |
| `page_type` | `varchar(40)` | no | `'page'` |
| `load_time_ms` | `int(10) unsigned` | yes | `NULL` |
| `score` | `tinyint(3) unsigned` | yes | `NULL` |
| `status` | `varchar(20)` | yes | `NULL` |
| `mobile_score` | `tinyint(3) unsigned` | yes | `NULL` |
| `desktop_score` | `tinyint(3) unsigned` | yes | `NULL` |
| `main_issue` | `varchar(255)` | yes | `NULL` |
| `page_size_bytes` | `int(10) unsigned` | yes | `NULL` |
| `requests_count` | `smallint(5) unsigned` | yes | `NULL` |
| `lcp_ms` | `int(10) unsigned` | yes | `NULL` |
| `lcp_rating` | `varchar(20)` | yes | `NULL` |
| `inp_ms` | `int(10) unsigned` | yes | `NULL` |
| `inp_rating` | `varchar(20)` | yes | `NULL` |
| `cls_thousandths` | `smallint(5) unsigned` | yes | `NULL` |
| `cls_rating` | `varchar(20)` | yes | `NULL` |
| `scanned_at` | `timestamp` | no | `CURRENT_TIMESTAMP` |

Indexes: `PRIMARY KEY (id)`; `KEY idx_url (url(191))`; `KEY idx_page_type (page_type)`; `KEY idx_score (score)`; `KEY idx_status (status)`.

- One row per page per scan; `scanned_at` orders them.
- `mobile_score` and `desktop_score` are the two PageSpeed strategies; the `*_rating` columns hold Google's good / needs improvement / poor label.

## 16. `vulopilot_security_events`

Login attempts and firewall matches, used by login protection and the firewall log. Repository: `LoginAttemptRepository, FirewallBlockRepository`.

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | `bigint(20) unsigned` | no |  |
| `event_type` | `varchar(20)` | no |  |
| `ip_address` | `varchar(45)` | no |  |
| `username_attempted` | `varchar(60)` | yes | `NULL` |
| `success` | `tinyint(1) unsigned` | yes | `NULL` |
| `request_uri` | `text` | yes | `NULL` |
| `rule_matched` | `varchar(100)` | yes | `NULL` |
| `action` | `varchar(10)` | yes | `NULL` |
| `created_at` | `datetime` | no | `CURRENT_TIMESTAMP` |

Indexes: `PRIMARY KEY (id)`; `KEY idx_type_ip_time (event_type, ip_address, created_at)`; `KEY idx_type_time (event_type, created_at)`.

- `event_type` separates login attempts from firewall events.
- `ip_address` is stored because blocking needs it. `rule_matched` and `action` record what the firewall did (logged or blocked).

## 17. `vulopilot_backups`

One row per backup, including the automatic safety snapshot taken before a restore. Repository: `BackupRepository`.

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | `bigint(20) unsigned` | no |  |
| `status` | `varchar(20)` | no | `'queued'` |
| `trigger_type` | `varchar(20)` | no | `'manual'` |
| `file_path` | `varchar(255)` | yes | `NULL` |
| `file_size` | `bigint(20) unsigned` | yes | `NULL` |
| `destination` | `varchar(20)` | no | `'local'` |
| `destination_status` | `varchar(30)` | yes | `NULL` |
| `destination_error` | `text` | yes | `NULL` |
| `remote_path` | `varchar(500)` | yes | `NULL` |
| `started_at` | `datetime` | yes | `NULL` |
| `finished_at` | `datetime` | yes | `NULL` |
| `error_message` | `text` | yes | `NULL` |
| `created_at` | `timestamp` | no | `CURRENT_TIMESTAMP` |

Indexes: `PRIMARY KEY (id)`; `KEY idx_status (status)`; `KEY idx_created (created_at)`; `KEY idx_destination (destination)`.

- `status` moves through `queued`, `running`, `completed` or `failed`. `trigger_type` is manual, scheduled or a pre-restore snapshot.
- `file_path` is the archive's base name only; the real path is rebuilt from `wp_upload_dir()`.
- `destination*` and `remote_path` track an optional remote copy made by an add-on through the backup actions.

## Other storage

| Data | Where | Key |
|---|---|---|
| All settings | `wp_options` | `vulopilot_settings` (merged over `Utill::VULOPILOT_SETTINGS_DEFAULTS`) |
| Active modules | `wp_options` | `vulopilot_all_active_module_list` |
| Installed schema version | `wp_options` | `vulopilot_version` |
| Dashboard widget layout | user meta | `vulopilot_dashboard_widget_layout` |
| Per-post SEO fields | post meta | `_vulopilot_focus_keyword`, `_vulopilot_canonical_url`, `_vulopilot_robots_noindex`, `_vulopilot_robots_nofollow`, `_vulopilot_social_title` and related `_vulopilot_*` keys |
| Post schema JSON-LD | post meta | `_vulopilot_schema_json` |

Settings are deliberately not a table: they are one option with a defaults array. See [SETTINGS-SYSTEM](SETTINGS-SYSTEM.md).

## Tables that earlier drafts listed

Older versions of this page described more tables. The free plugin does not create them and no free code reads or writes them.

| Former table | Status |
|---|---|
| `vulopilot_rules` | Removed. Rules are defined in code (`RuleRegistry`), so the table had no reader or writer |
| `vulopilot_ai_jobs` | Removed. It was an AI job queue that was never wired up; AI calls are recorded directly in `vulopilot_ai_history` |
| `vulopilot_indexnow_log` | Replaced. IndexNow submission history is stored in `vulopilot_activity_logs` (event type `indexnow.submitted`, trimmed to the last 100) |
| `vulopilot_ai_provider_configs`, `vulopilot_site_health_snapshots`, `vulopilot_geo_visibility_history`, `vulopilot_brand_score_history`, `vulopilot_kg_health_history`, `vulopilot_accessibility_snapshots`, `vulopilot_store_trends_snapshots` | Not part of the current schema |
| `vulopilot_scheduled_jobs`, `vulopilot_entity_relationships`, `vulopilot_file_baselines` | Not created by the free plugin. An add-on may create its own tables with the same prefix |

If you find one of these on an old site it is left over and can be ignored or dropped.

## Retention and cleanup

- Append-only trend and audit data (`snapshots`, `ai_history`, `activity_logs`) is small (about one row per day or per AI call) and should not be pruned aggressively.
- High-volume logs (`crawler_visits`, `performance_samples`, `security_events`, `not_found_logs`) are the ones to prune. Crawler visits follow the `log_retention` setting.
- The IndexNow submission history keeps only the last 100 requests, trimmed in application code.
- **Uninstall:** the Developer Tools setting "Keep VuloPilot data after uninstall" decides whether tables and options are deleted.

## Adding a table

1. Add its key and name to `Utill::TABLES`.
2. Add a `create_*_table()` method to `Install.php` and call it from `install()`.
3. Add a repository extending `RepositoryUtil` and a matching entry in this page.
4. Bump the plugin version so `Install::install()` runs on existing sites.
