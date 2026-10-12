# Restore and Migration

## 1. Principle

A restore is ordered so the site is only changed at the very end. Everything from a backup is checked on the way in, and the job's `changed` field (`nothing`, `partial`, `all`) records how much of the site was really replaced. Every message to the administrator is written from that field.

## 2. Steps

`Restore\Engine::tick()`:

| Step | What it does | Site changed? |
|---|---|---|
| `check` | Manifest valid, multisite matches, components exist, sodium and password present for an encrypted backup | No |
| `fetch` | Downloads missing parts from the first destination that has the backup | No |
| `verify` | SHA-256 of every part used | No |
| `safety` | Starts a `safety` backup and runs it to completion | No |
| `preflight` | Folders renameable, disk space, `CREATE`/`RENAME`/`DROP` rights (throwaway table) | No |
| `decrypt` | Decrypts parts into `restores/{id}/work` | No |
| `extract` | `FilesRestorer::extract()` into staging folders | No |
| `import` | `Database\Importer::run()` into temporary tables | No |
| `migrate` | `Migrator`: table-prefix names, then the site address | No |
| `overlay` | Copies `others` and `core` over the live files | **Partly** |
| `commit` | Switches folders, then tables, in one request | **Yes** |

Failure or cancel before `overlay` drops the temporary tables and deletes the staging folders.

`commit` is not time-boxed: once the database is switched, the administrator's session may no longer exist to ask for another slice.

## 3. Files

`Restore\FilesRestorer`:

- **Extract.** Each entry is read by stream into a staging folder. `PathGuard::is_safe_relative()` must pass, the first segment must be a known area, the entry must not be a symbolic link, and running totals of files and bytes may not exceed the manifest. One bad entry stops the restore.
- **Staging.** `plugins`, `themes`, `uploads` and `mu-plugins` unpack to `{root}.vbnew-{token}` beside the live folder; `others` and `core` unpack to `restores/{id}/overlay`.
- **Keep the plugin.** `keep_plugin()` puts the running copy of VuloBackup into the staged plugins folder, so the restore can finish whatever version the backup held.
- **Swap.** `swap()` renames live to `{root}.vbold-{token}` and staging to live. `rollback()` renames back.
- **Overlay.** `overlay()` moves files one by one (rename, falling back to copy), so an interrupted copy carries on. It deletes nothing that is not in the backup.

`wp-config.php` in a backup is never restored.

## 4. Database

`Database\Importer`:

- **Load.** Every line passes `SqlGuard::classify()`. `CREATE TABLE` is rewritten to a temporary name (`vbt{token}_{n}`); `INSERT` lines go to that table; `SET` and `DROP` lines are ignored. The dump's header gives its prefix and character set; a character set outside `SqlGuard::SAFE_CHARSETS` is refused.
- **Resume.** The cursor is the uncompressed offset. The first `INSERT` after resuming is `INSERT IGNORE`, in case the previous request was cut off between running a statement and recording it.
- **Complete.** The closing line's table and row counts are compared with `COUNT(*)` of what was loaded.
- **Foreign keys** are taken out of `CREATE TABLE` (their names are unique per database) and added back after the swap.
- **Collations** unknown to this server (`utf8mb4_0900_*`, `uca1400`) are retried as `utf8mb4_unicode_520_ci`, and noted.
- **Swap.** One `RENAME TABLE live TO vbo…, vbt… TO live, …` for every table: all or nothing. Then the replaced tables are dropped.

`Restore\Engine::carry_over()` prepares the loaded tables just before the swap: this site's `siteurl` and `home`, every `vulobackup_*` option, the plugin in `active_plugins`, and the current administrator's session when the same user exists in the backup.

Tables that are live but not in the backup are left alone.

This is not a transaction. DDL cannot be rolled back; after the swap, the way back is the safety backup.

## 5. Migration

`Restore\Migrator` runs on the temporary tables.

- **Prefix.** `fix_prefix()` renames `{old}user_roles` in options and `{old}*` keys in usermeta to the new prefix.
- **Address.** For each text column (`char`, `varchar`, `*text`, `json`; not `posts.guid`), rows containing the old host are read in batches and each value goes through `SerializedReplacer`.

`Restore\SerializedReplacer`:

- Matches every written form of the old address: `http://`, `https://`, protocol-relative, JSON-escaped (`\/`) and URL-encoded.
- One pass with one pattern, so a new address that contains the old one is not replaced twice.
- A boundary check stops `old.example` matching inside `old.example.org` or `old.example-shop.com`.
- Serialized data is parsed as text (`s:`, `a:`, `O:`, scalars, references) and rewritten with new lengths. It recurses into strings that are themselves serialized. `unserialize()` is never called, so no object is created from backup data.
- Data it cannot fully parse is returned unchanged and counted in `skipped`.

## 6. Tidying up

`tidy()` drops leftover tables and deletes staging, replaced and working folders as far as time allows; what is left is recorded in `leftovers`. `Restore\Engine::sweep()`, called by the watchdog, finishes it. Only folders this restore created are ever deleted: inside its own job folder, or named `*.vbnew-*` / `*.vbold-*`.
