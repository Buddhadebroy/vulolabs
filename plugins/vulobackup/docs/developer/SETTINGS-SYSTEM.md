# Settings System

## 1. Storage

One option, `vulobackup_settings`, managed by `VuloBackup\Settings\Settings`.

`Settings::DEFAULTS` is the single list of valid keys. Every key has a default and a type, and anything not in it is dropped on save.

| Key | Default | Meaning |
|---|---|---|
| `areas` | all but `core` | Folders a file backup includes |
| `include_wp_config` | `false` | Include `wp-config.php` with the `core` area |
| `exclude_patterns` | `''` | The administrator's exclusions, one per line |
| `max_file_size_mb` | `0` | Skip larger files; 0 for no limit |
| `db_scope` | `prefix` | or `all` |
| `schedule_files`, `schedule_database` | `manual` | `daily`, `weekly`, `monthly` |
| `schedule_hour` | `3` | 0 to 23, site timezone |
| `schedule_weekday` | `1` | 0 (Sunday) to 6 |
| `schedule_monthday` | `1` | 1 to 28 |
| `retention_count`, `retention_remote_count` | `5` | 0 keeps all |
| `keep_local_copy` | `true` | Keep archives here after uploading |
| `safety_backup` | `true` | Restore screen starts with the safety backup on |
| `encrypt` | `false` | Changed only through `POST settings/encryption` |
| `part_size_mb` | `100` | 10 to 2000 |
| `step_seconds` | `20` | 5 to 120 |
| `backup_dir` | `''` | Custom storage folder |
| `notify_failure` | `true` | Email on failure |
| `notify_email` | `''` | Empty uses the site administrator's address |
| `log_retention_days` | `30` | 1 to 365 |
| `keep_data_uninstall` | `keep_data` | or `delete_everything` |

Methods: `all()`, `get( $key )`, `update( array $input )`, `exclusions()`. `update()` merges, sanitizes per key (`sanitize()`, static), saves and returns the full settings.

Sanitization worth knowing: `areas` is intersected with `Utill::AREAS`; exclusion patterns containing `..` are dropped; numbers are clamped to their ranges; every key without a specific rule is cast to bool.

`Settings::DEFAULT_EXCLUSIONS` is the built-in list; `exclusions()` adds the administrator's and applies the `vulobackup_exclusions` filter.

To add a setting: add it to `DEFAULTS`, add a `sanitize()` case unless it is a boolean, add it to `Stored` in `src/services/useSettings.ts`, and add a control to a panel.

## 2. REST

`Rest\Settings`:

| Route | Does |
|---|---|
| `GET settings` | The settings plus read-only context: `encryption_available`, `encryption_has_password`, `backup_dir_in_use`, `backup_dir_default`, `backup_dir_public`, `default_exclusions`, `admin_email` |
| `POST settings` | Merges a flat `{ key: value }` body. Also accepts zyra's `{ setting: … }` form body |
| `POST settings/encryption` | `enabled`, `password`. Requires sodium and a password of at least 12 characters |
| `GET settings/retention` | What retention would remove now |

`validate()` refuses an invalid `notify_email`, and a `backup_dir` that `Vault::dir_problem()` rejects or that is changed while a job runs. `encrypt` in a normal save is ignored. After a save, `Scheduler::settings_changed()` resets the schedule clock when a schedule changed.

## 3. The settings screen

`src/pages/Settings.tsx` is zyra's `NavigatorComponent` (the sub-tab shell), the same shell VuloPilot's Settings uses. Sub-tabs are declared in `src/components/Settings/index.ts`; each has a `PanelComponent`.

| Sub-tab id | Panel | File |
|---|---|---|
| `schedule` | `Schedule` | `components/Settings/Panels.tsx` |
| `contents` | `Contents` | `components/Settings/Panels.tsx` |
| `storage` | `Storage` | `components/Settings/Storage.tsx` |
| `security` | `Security` | `components/Settings/Panels.tsx` |
| `notifications` | `Notifications` | `components/Settings/Panels.tsx` |
| `advanced` | `Advanced` | `components/Settings/Panels.tsx` |

Panels are drawn with `components/Section.tsx` (`Sections`, `Section`, `Row`, `Wide`, `Segmented`) and `components/Switch.tsx`, which use zyra's own settings class names, so they look like the generated forms of the other plugins.

### Autosave

`src/services/useSettings.ts` loads the settings and returns `set( patch )`. A change updates the screen at once and is posted 800 ms later; changes made in between are sent together. The server's answer replaces the local copy unless more has been typed meanwhile. A change pending when the screen is left is still sent.

Three things act on a button instead, because they must not happen half-typed: the backup folder, a storage destination (tested before it is saved), and the encryption password.
