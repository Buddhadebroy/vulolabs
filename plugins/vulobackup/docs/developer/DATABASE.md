# Database

VuloBackup adds **no tables**, no post types, no user meta and no post meta. It uses a few options, and keeps everything about backups in files.

## 1. Options

Every option is named `vulobackup_*`. A restore copies all of them from the live database into the restored one before the switch, so settings and credentials survive a restore.

| Option | Autoload | Content |
|---|---|---|
| `vulobackup_settings` | no | Every setting ([SETTINGS-SYSTEM](SETTINGS-SYSTEM.md)) |
| `vulobackup_destinations` | no | Remote destinations; secret fields encrypted |
| `vulobackup_encryption` | no | The archive password, encrypted. Absent when none is set |
| `vulobackup_key_material` | no | Random per-site half of the key that encrypts stored secrets |
| `vulobackup_dir_token` | no | The random part of the default backup folder's name |
| `vulobackup_schedule_state` | no | `last_files`, `last_database`: when a scheduled backup of each kind last started |
| `vulobackup_plugin_db_version` | yes | Installed version |
| `vulobackup_run_installer` | yes | Set on activation, removed after install |

Transient: `vulobackup_daily_tidy` (the watchdog's once-a-day housekeeping).

## 2. Files

```
{storage}/
  .htaccess  web.config  index.php  .vulobackup-private
  run.lock
  backups/{id}/
    job.json            the job record
    log.jsonl           this backup's log
    manifest.json       written last; its presence makes this a backup
    database.sql.gz
    files-001.zip …
  restores/{id}/
    job.json  log.jsonl
    work/               decrypted archives, while a restore runs
    overlay/            staged "others" and "core" files
  logs/activity.jsonl
  tmp/                  uploads in progress
```

Ids are `YYYYMMDD-HHMMSS-xxxxxxxx`. `Security\PathGuard::is_id()` is the only way an id reaches the filesystem.

### Why files and not a table

A restore replaces the database, and a migration brings another site's. Records kept in the database would be replaced with them: the list of backups would be the backup's list, and the restore in progress would lose its own state. In files, both survive.

### job.json

| Field | Content |
|---|---|
| `id`, `kind` | `kind` is `backups` or `restores` |
| `status` | `queued`, `preparing`, `backing_up`, `verifying`, `uploading`, `safety_backup`, `restoring`, `completed`, `failed`, `cancelled` |
| `step`, `cursor` | Where the engine is, and the working state of each step |
| `percent`, `label` | For the progress bar |
| `error`, `warnings` | |
| `stalls`, `crashes`, `running` | The runner's guards |
| `created_at`, `updated_at`, `finished_at` | UTC |
| Backups | `type`, `trigger`, `name`, `options` (`areas`, `encrypt`, `salt`, `destinations`), `site`, `size`, `parts`, `encrypted`, `local`, `verified`, `verified_at`, `verify_problems`, `copies` |
| Restores | `backup_id`, `backup_name`, `token`, `components`, `options`, `changed`, `safety_id`, `result`, `migrated`, `leftovers` |

`Jobs\Store::save()` writes to a temporary name and renames, so a reader never sees half a file.

## 3. Tables a restore creates

While a restore runs, `vbt{token}_{n}` tables hold the loaded data; after the switch, `vbo{token}_{n}` hold the replaced tables until they are dropped. Both are removed by the restore, or by the watchdog if it ran out of time. Diagnostics reports any that remain.

## Uninstall

`Install::uninstall()` clears the scheduled events. Unless `keep_data_uninstall` is `delete_everything`, it does nothing else. With it, the options above are deleted.

**The storage folder is never deleted**, with either choice. Removing a plugin must not destroy the only copies of a site.
