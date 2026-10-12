# Diagnostics

## 1. What it is

`Rest\Overview::diagnostics()` (`GET diagnostics`) runs the checks when the screen opens and returns `checks` and `system`. Nothing is cached.

## 2. Checks

Each check is `label`, `status` (`ok`, `info`, `warning`, `error`) and `detail`.

| Check | Source | Not OK means |
|---|---|---|
| Backup folder | `Vault::ensure()` | error |
| Backup folder location | `Vault::is_in_web_root()` | info |
| Backup folder is closed to the web | `is_exposed()` | error |
| PHP zip extension | `class_exists( 'ZipArchive' )` | error |
| PHP zlib extension | `function_exists( 'gzopen' )` | error |
| PHP sodium extension | `Crypto::is_available()` | info |
| Free disk space | `Vault::free_space()` under 200 MB | warning |
| PHP time limit | `max_execution_time` under `step_seconds` + 10 | warning |
| PHP memory limit | shown only | |
| WP-Cron | `DISABLE_WP_CRON` | info |
| Schedule check | `wp_next_scheduled()` | error |
| Tables left by a restore | `vbt…`/`vbo…` tables while no job runs | info |

### The exposure probe

`is_exposed()` writes a file with a random name and random content into the storage folder, requests it through the site's own address with `wp_remote_get()`, and deletes it. Served with the content means the web server ignores the protection files. It returns null when the folder is outside the WordPress folder or the request could not be made, and the check then says it could not be tested.

## 3. System

Versions of VuloBackup, the backup format, WordPress, PHP and the database server; the database character set and table prefix; the storage folder (as a path relative to the site, never absolute); the space backups use.

## 4. Overview warnings

`Rest\Overview::overview()` computes the notices on the Overview screen from the job records and settings: no backup yet, the last one older than 30 days, the last one failed or had warnings, no schedule, WP-Cron off, no remote destination, encryption switched on but unusable.

## 5. Adding a check

Add a `$check( $label, $ok, $detail, $severity )` call in `diagnostics()`. Keep the detail a full sentence that says what to do, and never include an absolute path or a credential.
