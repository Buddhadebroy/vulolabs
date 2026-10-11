# Testing and Release

## 1. Unit tests

```bash
composer install
pnpm run test:php        # or vendor/bin/phpunit
```

PHPUnit with Brain\Monkey. The tests run without WordPress: `tests/php/bootstrap.php` defines the constants and a minimal `WP_Error`, and `TestCase` supplies working stand-ins for the WordPress functions the code calls, plus a real temporary folder per test. 72 tests.

| File | Covers |
| --- | --- |
| `test-sql-guard.php` | The dump dialect: literals round-trip; 28 kinds of statement an attacker might add are refused |
| `test-serialized-replacer.php` | Address replacement in plain text, JSON, URL-encoded text, serialized arrays and objects, nested serialized data; look-alike host names; damaged data left alone |
| `test-security.php` | Relative-path and id checks, containment with symbolic links, manifest validation (13 bad manifests), encryption round trip and 6 kinds of tampering, log redaction, settings sanitization |
| `test-files.php` | Exclusion patterns; inventory with symlinks, exclusions, size limit and VuloBackup's own folders; archiving in slices with a file that vanished; staged extraction, swap and rollback; 10 hostile archive entries |

## 2. Integration tests

`tests/integration` holds scripts that run inside a real WordPress site with `wp eval-file`. They need MySQL or MariaDB, and for `6-remote-storage.php` an S3-compatible server and an SFTP server; `services.compose.yml` there starts all three. See `tests/integration/README.md`.

| Script | Checks | Covers |
| --- | --- | --- |
| `1-backup.php` | (prints) | A full backup of seeded data: emoji, quotes, NUL bytes, binary columns, a table without a key, foreign keys, a view, a symlink, an excluded folder |
| `2-restore.php` | 14 | Wreck the site, restore, compare `CHECKSUM TABLE` and file hashes with the original; settings carried over; foreign key restored; nothing left behind; safety backup made |
| `3-slices-corruption-encryption.php` | 12 | Backup and restore in the smallest possible slices; a flipped byte refused; encrypted backup, wrong password, no plain data or password on disk |
| `4a-export-bundle.php`, `4b-migrate-on-second-site.php` | 3 + 14 | Download bundle (also in zip64 form), import on a site with another address and table prefix, restore, addresses and serialized data |
| `5-forged-archives.php` | 28 | Seven hostile archives, twelve hostile dumps, seven bad bundles: all refused with the site byte-for-byte unchanged |
| `6-remote-storage.php` | 24 | Wrong credentials, S3 multipart and SFTP uploads in tiny slices, verification, restore from remote only, a failing destination, a changed SFTP host key, retention local and remote, a failing backup deletes nothing |
| `7-permissions-schedule-lifecycle.php` | 26 | Every route as a visitor and as an editor; schedule slots and timezones; one backup from three cron events; the lock; cancel; crash detection; deactivation and uninstall |
| `8-packaged-plugin.php` | 9 | The release zip installed on a clean site: full backup, and a restore that replaces the plugins folder while VuloBackup stays installed and active |

## 3. Admin app

The admin app was exercised in headless Chrome: starting a backup and watching it complete, details, verify, every settings sub-tab, diagnostics, and a full restore through the wizard.

## 4. What these results are from

PHP 8.3, WordPress 7.1, MariaDB 11.8, on macOS with PHP's built-in web server; storage tests against MinIO and an OpenSSH SFTP container.

## 5. Not tested

- PHP 7.4 to 8.2 (the code passes PHPCompatibility for 7.4+, but was only run on 8.3).
- MySQL (only MariaDB), Apache, nginx, Windows hosts.
- Real Amazon S3 and other real providers (only MinIO).
- Multisite.
- Sites larger than a few dozen megabytes; real shared-hosting time and memory limits.
- A real browser download of a multi-gigabyte bundle.
- Delivery of the failure email (only that it is handed to `wp_mail()`).

## 6. Linters

```bash
composer run-script phpcs                       # WordPress-Extra + PHPCompatibility 7.4+
pnpm exec eslint plugins/vulobackup/src --ext .ts,.tsx    # from the repository root
```

phpcs reports only `Generic.Commenting.DocComment` notices for doc blocks that start with a tag, the same house style as the sibling plugins. There is no TypeScript type-check step; ESLint and the webpack build are the gates.

## 7. Release

```bash
pnpm run build:zip        # readme, build, make-pot, make-json, then release/vulobackup-v<version>.zip
```

`tools/scripts/release.mjs` copies `assets`, `classes`, `languages`, `vendor`, `readme.txt`, `config.php`, `composer.json`, `composer.lock` and `vulobackup.php`, then runs `composer install --no-dev`, so the zip holds phpseclib and its two dependencies and no development package. Tests, docs and `src/` are not in the zip.

Before shipping: install the zip on a clean site and run `tests/integration/8-packaged-plugin.php`.

The version is in `vulobackup.php`, `config.php`, `package.json` and `readme.txt` (`pnpm run version` updates them).
