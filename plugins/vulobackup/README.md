# VuloBackup

**Back up your WordPress site. Restore it when it matters.**

VuloBackup is a standalone WordPress plugin: database and file backups, schedules, retention, remote storage (S3-compatible and SFTP), integrity checks, optional encryption, restore and migration. It needs no other VuloLabs product, no account and no paid service, and sends nothing to VuloLabs.

- Product name: **VuloBackup** · slug and text domain `vulobackup` · PHP namespace `VuloBackup\` · accessor `VuloBackup()` · REST namespace `vulobackup/v1`
- Requires WordPress 6.4+, PHP 7.4+, the PHP `zip` and `zlib` extensions; `sodium` for encryption.

## Documentation

| For | Start at |
| --- | --- |
| People using the plugin | [docs/user/README.md](docs/user/README.md) |
| Developers | [docs/developer/README.md](docs/developer/README.md) |
| WordPress.org listing | [readme.txt](readme.txt) |

## Development

```bash
pnpm install                 # from the repository root
composer install             # in this folder
pnpm run build               # build the admin app into assets/
vendor/bin/phpunit           # unit tests (no WordPress needed)
composer run-script phpcs    # coding standards
pnpm run build:zip           # package release/vulobackup-v1.0.0.zip
```

Integration tests run against a real WordPress site with MySQL, an S3 server and an SFTP server; see [docs/developer/TESTING.md](docs/developer/TESTING.md).

## What is deliberately not here

No Pro tabs, upgrade prompts or licensing; no telemetry; no public REST route; no Google Drive (it needs a registered OAuth application, which this version does not have). See [docs/developer/ROADMAP.md](docs/developer/ROADMAP.md).
