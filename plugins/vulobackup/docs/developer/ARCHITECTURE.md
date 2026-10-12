# Architecture

## 1. Layout

```
vulobackup.php, config.php   bootstrap, constants
classes/
  VuloBackup.php             singleton container
  Install.php                version option, uninstall routine
  Utill.php                  constants, areas, dates, sizes, atomic write, delete tree
  Admin.php                  menu, enqueue
  FrontendScripts.php        asset registration, localized data
  Rest.php                   controller registry
  Jobs/                      Store (job.json files, the lock), Runner (slices)
  Backup/                    Engine, Manifest, Verifier, Retention, Bundle
  Database/                  Exporter, Importer, SqlGuard
  Files/                     Inventory, Archiver, Matcher
  Restore/                   Engine, FilesRestorer, Migrator, SerializedReplacer
  Storage/                   Vault, Destinations, Provider, Providers/S3, Providers/Sftp
  Security/                  Secrets, Crypto, PathGuard, Redactor
  Schedule/                  Scheduler (schedules, watchdog)
  Logging/                   Logger
  Settings/                  Settings (the one settings option)
  Rest/                      vulobackup/v1 controllers
src/                         React admin, built to assets/
tests/php/                   PHPUnit (Brain\Monkey)
tests/integration/           scripts run inside a real site
```

## 2. Bootstrap

`vulobackup.php` loads Composer's autoloader and calls `VuloBackup()`, which lazily creates the singleton (`classes/VuloBackup.php`): a plain-array container with magic `__get`/`__set`.

| When | What |
|---|---|
| Constructor | Activation, deactivation and uninstall hooks; the `cron_schedules` filter (needed before WordPress reads the schedule) |
| `plugins_loaded` | Runs `Install` on first run or version change |
| `init` (priority 0) | `init_classes()` builds the services, then fires `vulobackup_loaded` |

Container keys: `secrets`, `settings`, `vault`, `logger`, `jobs`, `destinations`, `runner`, `scheduler`, `admin`, `rest`, plus `plugin_url`, `plugin_path`, `plugin_base`, `version`, `rest_namespace`, `plugin_slug`.

Deactivation clears the scheduled events and nothing else. Uninstall is `Install::uninstall()`; it never deletes a backup ([DATABASE](DATABASE.md#uninstall)).

## 3. Jobs and slices

A job is a backup or a restore. Its record is a `job.json` in its own folder inside the storage folder; `Jobs\Store` reads and writes it atomically.

No work depends on one long request. `Jobs\Runner::tick()`:

1. takes the lock (`flock` on `run.lock`); if another request holds it, returns `busy`,
2. finds the running job,
3. runs its engine until a deadline (`step_seconds`),
4. saves and releases.

Each step keeps a cursor in the job record and can stop after any unit of work (a batch of rows, a folder, a batch of files, a part of an upload).

| Who asks for a slice | How |
|---|---|
| The admin screen | `POST jobs/run` in a loop (`src/services/JobContext.tsx`) |
| WP-Cron | `vulobackup_run`, queued again after every slice of a backup |
| The watchdog | `vulobackup_watchdog` every five minutes re-queues a backup that has no event |

A restore only moves on an administrator's request, never on cron.

Two guards stop a job looping for ever:

| Guard | Meaning | Limit |
|---|---|---|
| Stall | A slice ended and the job had not moved | 8 in a row fail the job |
| Crash | A slice never reported back: PHP was killed | 4 at the same point fail the job, and the message names the step |

Only one job exists at a time. There is no queue.

## 4. Backup and restore

Each is a state machine of named steps:

- `Backup\Engine`: `prepare → database → inventory → archive → verify → encrypt → finalize → upload → retention`. See [BACKUP-ENGINE](BACKUP-ENGINE.md).
- `Restore\Engine`: `check → fetch → verify → safety → preflight → decrypt → extract → import → migrate → overlay → commit`. See [RESTORE-AND-MIGRATION](RESTORE-AND-MIGRATION.md).

## 5. Hooks

Scheduled: `vulobackup_run` (single events), `vulobackup_schedule_check` (hourly), `vulobackup_watchdog` (every five minutes, interval `vulobackup_five_minutes`).

Public actions and filters are in [HOOKS](HOOKS.md).

## 6. REST

`classes/Rest.php` registers the controllers in `classes/Rest/` on `rest_api_init`, under `VuloBackup()->rest_namespace` (`vulobackup/v1`). All extend `Rest\Controller`, whose `check_permission()` requires an administrator, and whose `view()` shapes a job for the browser. Routes are in [REST-API](REST-API.md).

## 7. React

`src/index.tsx` mounts `<App>` on `#admin-main-wrapper`. The screen is chosen by the URL hash. See [ADMIN-UI](ADMIN-UI.md).
