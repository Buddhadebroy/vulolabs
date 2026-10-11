# Backup format (version 1)

`VULOBACKUP_FORMAT_VERSION` is 1. A backup with a higher number is refused on import and restore.

## Files

| File | Content |
| --- | --- |
| `manifest.json` | What the backup holds |
| `database.sql.gz` | The database, as gzip-compressed SQL |
| `files-001.zip`, `files-002.zip`, … | The files |
| `*.enc` | The same files, encrypted, when the backup is encrypted |

A manifest may only name files matching `Manifest::PART_PATTERN`.

## manifest.json

```json
{
  "format": 1,
  "id": "20261010-203347-0bf95491",
  "name": "Full backup",
  "type": "full",
  "trigger": "manual",
  "created_at": "2026-10-10 20:33:47",
  "completed_at": "2026-10-10 20:33:52",
  "plugin_version": "1.0.0",
  "site": { "home": "", "siteurl": "", "name": "", "multisite": false, "prefix": "wp_", "charset": "utf8mb4", "wp_version": "", "php": "", "db": "", "locale": "" },
  "database": { "tables": 17, "rows": 471, "bytes": 123456, "names": ["wp_posts"], "skipped": [] },
  "files": { "count": 507, "bytes": 43700000, "by_area": { "uploads": { "files": 63, "bytes": 0 } }, "skipped": { "excluded": 0, "symlinks": 0, "unreadable": 0, "too_large": 0, "bad_name": 0, "missing": 0 } },
  "parts": [ { "name": "database.sql.gz", "bytes": 0, "sha256": "…", "entries": 0 } ],
  "encrypted": false,
  "salt": "",
  "warnings": []
}
```

Times are UTC. The manifest holds no password, key, cookie or salt from `wp-config.php`. `Manifest::validate()` is the only reader and returns a cleaned copy; unknown keys are dropped.

## database.sql.gz

Ordinary SQL, importable by phpMyAdmin or the mysql client, written as concatenated gzip members. Every statement is exactly one line:

```
-- VuloBackup SQL dump
-- vulobackup-format: 1
-- vulobackup-prefix: wp_
-- vulobackup-charset: utf8mb4
-- vulobackup-created: 2026-10-10 20:33:47 UTC
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;
SET SQL_MODE = 'NO_AUTO_VALUE_ON_ZERO';

-- Table: wp_posts
DROP TABLE IF EXISTS `wp_posts`;
CREATE TABLE `wp_posts` ( … ) ENGINE=InnoDB …;
INSERT INTO `wp_posts` VALUES (…),(…);

SET FOREIGN_KEY_CHECKS = 1;
-- vulobackup-complete: tables=17 rows=471
```

- Values are quoted strings with backslash escapes (`\\ \' \n \r \0 \Z`), `NULL`, or hex literals (`0x…`) for binary columns.
- Table names are limited to `[A-Za-z0-9_$]{1,64}`; others are skipped and reported.
- The last line states the table and row counts. A dump without it is incomplete.

`Database\SqlGuard::classify()` accepts exactly these line shapes and nothing else. VuloBackup's restore ignores the `SET` and `DROP` lines (it sets the session itself and replaces tables by renaming).

## files-NNN.zip

Standard zip. Entry names are `area/relative/path` where area is `plugins`, `themes`, `uploads`, `mu-plugins`, `others` or `core`. No directory entries, no symbolic links. Already-compressed formats are stored without compression.

## Encrypted files

`VULOBACKUP-ENC-1\n` + 16-byte salt + 24-byte secretstream header + chunks of up to 1 MiB plaintext, each with a 17-byte tag; the last chunk carries the FINAL tag. Key: `sodium_crypto_pwhash` (Argon2id, interactive limits) of the password and salt. One salt per backup, also in the manifest.

## Download bundle

`Backup\Bundle` wraps the manifest and parts, stored uncompressed, in one zip written straight to the response (zip64 records when a size or offset needs them). `Bundle::import()` accepts a zip holding a valid manifest and exactly the parts it names at exactly their sizes.
