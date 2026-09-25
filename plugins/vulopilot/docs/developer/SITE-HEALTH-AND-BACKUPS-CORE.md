# Site Health and Backups Core

Code reference for `classes/SiteHealth`. User view: [../user/SITE-HEALTH-AND-BACKUPS.md](../user/SITE-HEALTH-AND-BACKUPS.md).

## Site Health scanners

`WordPressHealthScanner`, `UpdatesScanner`, `PluginsScanner`, `ThemesScanner`, `DatabaseScanner`, `DatabaseCleanupScanner`, `CronScanner`, `ServerHealthScanner`, `SiteAvailabilityScanner`, `PhpWarningScanner`, `HeavyPluginsScanner`, `BackupHealthScanner` each implement the scanner contract ([SCANNERS](SCANNERS.md)) and are registered in `Utill\ScannerRegistry`. `CoreUpdateAvailableRule` and `DormantPluginRule` turn findings into recommendations ([RULE-ENGINE](RULE-ENGINE.md)).

## Backups

```
start_backup($trigger_type)   -> inserts a row in vulopilot_backups (status queued), returns the id
process_batch()               -> works the queue in bounded batches (WP-Cron / async); DB dump goes to the system temp dir,
                                 files are added to a zip in uploads/vulopilot-backups/
                              -> do_action('vulopilot_backup_completed', $backup_id) when done
run_queue_synchronously()     -> drains the queue in one request
BackupScheduler               -> cron hook vulopilot_backup_scheduled_run; ensure_scheduled() (init, priority 30) registers
                                 the daily or weekly event; run_scheduled_backup() starts a scheduled backup
BackupStorageManager          -> get_active_destination(), schedule_upload(), upload_to_remote(), delete_remote_copy();
                                 remote copies are made through the actions
                                 vulopilot_backup_upload_to_remote / vulopilot_backup_delete_remote_copy
restore($backup_id)           -> takes a pre-restore safety snapshot first, then overwrites; a failure leaves the site unchanged
```

Storage safety:

- Archives live in `wp_upload_dir()['basedir'] . '/vulopilot-backups/'`, protected with `index.php`, `.htaccess` and `web.config` written by `BackupManager::get_backup_dir()`.
- The raw SQL dump is written to the system temp directory, not the web-accessible uploads folder, and folded into the archive.
- The plugins directory is resolved from the plugin's own path (`get_plugins_dir()`), not the `WP_PLUGIN_DIR` constant.

## Class reference

| Class | File | What it does |
|---|---|---|
| `BackupHealthScanner` | `classes/SiteHealth/BackupHealthScanner.php` | Turns Services\BackupManager/BackupScheduler's own real backup-run log (`vulopilot_backups`) into a real Finding when automatic backups are enabled but something's actually wrong - the most recent run failed, or nothing has comple |
| `BackupManager` | `classes/SiteHealth/BackupManager.php` | Real DB + file backups - Protect My Site's "Backups"/"Recovery" tiles. |
| `BackupRepository` | `classes/SiteHealth/BackupRepository.php` | Persistence for `vulopilot_backups` (DATABASE.md) - Services\BackupManager/BackupScheduler's own real backup-run log, backing "Backups"/"Recovery", `RestAPI\Controllers\Backups`, and Scanners\Basic\BackupHealthScanner's Finding ro |
| `BackupScheduler` | `classes/SiteHealth/BackupScheduler.php` | Reads `backup_frequency` (`'daily'/'weekly'/'disabled'`); only re-registers `wp_schedule_event()` when the setting's own resolved schedule actually differs from what's currently scheduled (avoids constantly rescheduling on every ` |
| `BackupStorageManager` | `classes/SiteHealth/BackupStorageManager.php` | Real remote-upload orchestration for Backups' own storage destination - hooks `vulopilot_backup_completed` (already fired by `BackupManager::finalize_backup()` for every trigger type, manual/ scheduled/pre-restore-safety alike) an |
| `CoreUpdateAvailableRule` | `classes/SiteHealth/CoreUpdateAvailableRule.php` | Turns Scanners\Basic\UpdatesScanner's WordPress-core-update Finding (object_type 'core') into a recommendation to update now. |
| `CronScanner` | `classes/SiteHealth/CronScanner.php` | Flags scheduled cron events that are overdue - a hook scheduled for the past that still hasn't run means WP-Cron isn't actually firing (no traffic hitting the site, DISABLE_WP_CRON without a real system cron replacing it, a fatal  |
| `DatabaseCleanupScanner` | `classes/SiteHealth/DatabaseCleanupScanner.php` | Flags database bloat relevant to the "Performance" page specifically: expired transients (rows WordPress itself considers stale, safe to delete) plus revisions beyond the most recent 5 per post. |
| `DatabaseScanner` | `classes/SiteHealth/DatabaseScanner.php` | Flags excessive post-revision buildup - a classic, well-understood WordPress database bloat source (every edit of every post/page keeps a full revision row by default) that slows down post-list queries and backups as it grows unbo |
| `DormantPluginRule` | `classes/SiteHealth/DormantPluginRule.php` | Turns Scanners\Basic\PluginsScanner's "inactive plugin installed" Finding into a recommendation to remove or reactivate it. |
| `HeavyPluginsScanner` | `classes/SiteHealth/HeavyPluginsScanner.php` | Flags a high total active-plugin count - a simple, defensible, O(1) heuristic (get_option('active_plugins') is already loaded on every request) rather than measuring each active plugin's on-disk size or asset count, which would me |
| `PhpWarningScanner` | `classes/SiteHealth/PhpWarningScanner.php` | Tails WordPress's own debug.log (when WP_DEBUG_LOG is enabled) for recent PHP warnings/notices/deprecated/fatal messages, deduped by message text. |
| `PluginsScanner` | `classes/SiteHealth/PluginsScanner.php` | Flags plugins that are installed but not active. |
| `ServerHealthScanner` | `classes/SiteHealth/ServerHealthScanner.php` | Same `WP_Site_Health`-wrapping approach WordPressHealthScanner uses, scoped to the 2 tests that are actually about the hosting environment rather than WordPress itself - PHP version and the SQL server version - so "Server" and "Wo |
| `SiteAvailabilityScanner` | `classes/SiteHealth/SiteAvailabilityScanner.php` | Checks whether the site's own front end is actually reachable - a real `wp_remote_get( home_url() )` from the server's own perspective, not a third-party/external uptime probe (this plugin runs ON the site being checked, so it can |
| `ThemesScanner` | `classes/SiteHealth/ThemesScanner.php` | Flags installed-but-inactive themes - the same dormant-code concern PluginsScanner checks for plugins, applied to themes. |
| `UpdatesScanner` | `classes/SiteHealth/UpdatesScanner.php` | Flags any pending WordPress core, plugin, or theme update, using core's own update-check APIs rather than re-implementing version comparison - `get_core_updates()`, `get_plugin_updates()`, and `get_theme_updates()` already do exac |
| `WordPressHealthScanner` | `classes/SiteHealth/WordPressHealthScanner.php` | Wraps 3 of WordPress core's own `WP_Site_Health` tests - the same class and same cached results Tools → Site Health already computes - rather than re-implementing core-version/HTTPS/REST-API checks from scratch, same "wrap core, d |
| `Backups` | `classes/SiteHealth/Rest/Backups.php` | `GET /backups` lists real backup runs; `POST /backups` starts a real manual backup (never runs synchronously - `VuloPilot()->backup_manager` processes it via WP-Cron in small batches, same "GET lists, POST triggers, persistence ha |
| `PluginOverlap` | `classes/SiteHealth/Rest/PluginOverlap.php` | GET /plugin-overlap - backs "Protect My Site" → Files & Plugins' own "VuloPilot already covers this" card. |

Hooks and routes registered by these classes:

- `BackupScheduler` - hooks: `cron_schedules`, `init`
- `BackupStorageManager` - hooks: `vulopilot_backup_completed`
- `Backups` - routes: `/backups`, `/backups/(?P<id>\d+)`, `/backups/(?P<id>\d+)/download`, `/backups/(?P<id>\d+)/restore`
- `PluginOverlap` - routes: `/plugin-overlap`
