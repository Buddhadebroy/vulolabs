# Backup Engine

## 1. Starting a backup

`VuloBackup()->runner->start_backup( array $args )` creates the job. Arguments: `type` (`full`, `database`, `files`), and optionally `areas`, `name`, `trigger` (`manual`, `schedule`, `safety`) and `destinations` (`false` for local only).

It returns a `WP_Error` (`vulobackup_busy`, status 409) while any job is running. The job starts as `queued` and a `vulobackup_run` event is queued.

Areas are `plugins`, `themes`, `uploads`, `mu-plugins`, `others` (the rest of wp-content) and `core` (WordPress itself); see `Utill::AREAS` and `Utill::area_roots()`.

## 2. Steps

`Backup\Engine::tick()` runs the steps in order. `STEPS` maps each to the status shown and its share of the progress bar.

| Step | Status | What it does | Resumes by |
|---|---|---|---|
| `prepare` | `preparing` | Checks the folder and extensions, lists tables, settles the areas, makes the encryption salt | Runs once |
| `database` | `backing_up` | `Database\Exporter` writes `database.sql.gz` | Table index and key or offset |
| `inventory` | `backing_up` | `Files\Inventory` writes `files.list`; then the disk-space check | Folder stack |
| `archive` | `backing_up` | `Files\Archiver` packs `files-NNN.zip` | Byte offset in the list |
| `verify` | `verifying` | Reads the dump end to end; opens each zip with consistency checks | Part index |
| `encrypt` | `verifying` | `Security\Crypto` encrypts each part, then removes the plain one | Skips parts already done |
| `finalize` | `verifying` | SHA-256 of each part; writes `manifest.json` | Hashes so far |
| `upload` | `uploading` | Sends every file to every destination and verifies it | Destination, file, provider state |
| `retention` | `uploading` | Removes local archives if kept remotely only; prunes old backups | Runs once |

Steps a job does not need are skipped (`needs()`).

**Until `finalize` there is no manifest, and a job without a manifest is never offered for restore.** A failure before it removes the partial archives and keeps `job.json` and the log. Any exception fails the job with its message.

## 3. Database export

`Database\Exporter`:

- **Tables:** `SHOW FULL TABLES`, base tables only, starting with `$wpdb->base_prefix` (or all tables when `db_scope` is `all`). Views and names outside `[A-Za-z0-9_$]` are skipped and reported.
- **Paging:** a single integer primary key is walked by key (`WHERE id > last ORDER BY id LIMIT n`), which stays fast and is stable while the table changes. Anything else is paged by offset, ordered by its primary key when it has one.
- **Batch size:** about 4 MB of rows, from `Avg_row_length`, between 25 and 5000 rows.
- **Writing:** each batch is appended as one gzip member. The cursor records the file's size after every batch; on resume the file is truncated to that size, so a torn write is discarded.
- **Errors:** any database error throws with the table's name.

The dialect is in [BACKUP-FORMAT](BACKUP-FORMAT.md#databasesqlgz).

## 4. File inventory

`Files\Inventory` walks each area with an explicit stack kept in the cursor (no recursion), one folder at a time, and writes `size<TAB>area/path` lines.

Left out, and counted in `skipped`:

| Reason | What |
|---|---|
| `excluded` | Matches `Settings::exclusions()` (built-in list plus the administrator's), tested by `Files\Matcher` |
| `symlinks` | Any symbolic link. Never followed |
| `unreadable` | Not readable by the web server |
| `too_large` | Over `max_file_size_mb` |
| `bad_name` | Control characters, a backslash or a colon in the name, or too long |

Never entered: the storage folder, any folder holding `Vault::MARKER`, another area's root, and the `*.vbnew-*` / `*.vbold-*` folders a restore creates. `wp-config.php` is skipped unless `include_wp_config` is on.

More than two million files fails the backup with a message.

## 5. Archiving

`Files\Archiver` adds files in batches (400 files or 32 MB) to the current part and closes the zip after each batch, so an interrupted request loses at most one batch. A part ends at `part_size_mb` of file data.

The zip library reads files when the archive is closed and refuses to close if one has gone. The batch is then added again one file at a time, so only the files that really cannot be read are left out (`missing`).

Already-compressed formats (`Archiver::STORED`) are stored without compression.

## 6. Verification

`step_verify` runs before a backup is declared: the dump must decompress to exactly the bytes written and end with the exporter's closing line; each zip must open with `CHECKCONS` and hold the number of entries added.

`Backup\Verifier` is the on-demand check (`POST backups/{id}/verify`): size and SHA-256 of every local part against the manifest, then `Provider::verify()` for every remote copy. It works in slices and records `verified`, `verified_at` and `verify_problems`.

## 7. Schedule

`Schedule\Scheduler::check()` runs hourly. For files and for the database it compares the most recent scheduled moment (`slot()`, in the site's timezone) with when a scheduled backup of that kind last started (`vulobackup_schedule_state`).

- Due means the slot has passed and nothing started since, so a missed backup runs at the next check.
- The start time is recorded before the backup begins, so repeated cron events start one backup.
- Both due together become one `full` backup.
- Nothing starts while a job is running; it stays due.
- `settings_changed()` resets the clock when a schedule is switched on or its time changes.

## 8. Retention

`Backup\Retention` runs only from the `retention` step, after verification, so a failing backup never deletes anything.

- Completed, non-imported backups are counted newest first: local copies against `retention_count`, each destination's copies against `retention_remote_count` (0 keeps all).
- The backup that is finishing counts as kept.
- Safety backups are kept two deep.
- A record is deleted once no copy is left anywhere.

`plan()` returns what would be removed without removing it (`GET settings/retention`).
