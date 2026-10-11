# VuloBackup Developer Documentation

Code-level documentation for developers who extend or maintain VuloBackup. End-user guides are in [../user](../user/README.md).

## Start here

1. [ARCHITECTURE](ARCHITECTURE.md) - bootstrap, container, jobs and slices, hooks, REST, React.
2. [BACKUP-ENGINE](BACKUP-ENGINE.md) - how a backup is made, step by step.
3. [RESTORE-AND-MIGRATION](RESTORE-AND-MIGRATION.md) - how a backup is put back.
4. [BACKUP-FORMAT](BACKUP-FORMAT.md) - the manifest, the SQL dialect, the archives.

## By area

| Area | Document | Covers |
|---|---|---|
| Backup | [BACKUP-ENGINE](BACKUP-ENGINE.md) | Job runner, the steps, database export, file inventory, archiving, verification, schedule, retention |
| Restore | [RESTORE-AND-MIGRATION](RESTORE-AND-MIGRATION.md) | The steps, staged files, load-then-swap database, address replacement, rollback |
| Format | [BACKUP-FORMAT](BACKUP-FORMAT.md) | `manifest.json`, the dump dialect, zip layout, encrypted files, the download bundle |
| Storage | [STORAGE](STORAGE.md) | The backup folder, destinations, the provider interface, S3 and SFTP, adding a provider |
| Security | [SECURITY-AND-PRIVACY](SECURITY-AND-PRIVACY.md) | Threat model, every protection, remaining risks |
| Data | [DATABASE](DATABASE.md) | No tables: the options, and the files that hold job state |
| Settings | [SETTINGS-SYSTEM](SETTINGS-SYSTEM.md) | The settings option, validation, the auto-saving panels |
| Admin app | [ADMIN-UI](ADMIN-UI.md) | React structure, routing, screens, the job context, zyra usage |
| Logging | [LOGGING](LOGGING.md) | Activity log, job logs, redaction, failure email |
| Diagnostics | [DIAGNOSTICS](DIAGNOSTICS.md) | The checks and how to add one |
| REST | [REST-API](REST-API.md) | Every route |
| Extending | [HOOKS](HOOKS.md), [EXTENDING](EXTENDING.md) | Actions, filters, constants; adding a provider; what an add-on can build on |
| Quality | [TESTING](TESTING.md) | Unit tests, integration tests, linters, release |
| Plans | [ROADMAP](ROADMAP.md) | Deferred features and why |

## Working on the code

```bash
pnpm install                  # once, in the repository root
composer install              # once, in plugins/vulobackup
pnpm run build                # from plugins/vulobackup: rebuild assets/
pnpm run watch                # rebuild on change
pnpm run test:php             # PHPUnit
composer run-script phpcs     # coding standards
composer dump-autoload -o     # after moving or renaming a PHP class
pnpm run build:zip            # release/vulobackup-v<version>.zip
```

Checklist before a release: PHPUnit green, the integration scripts green on a throwaway site, `phpcs` clean apart from the house doc-comment style, ESLint clean, `pnpm run build`, `make-pot` with no warnings, and the zip installed on a clean site with `WP_DEBUG` on.

## Conventions

- Namespace `VuloBackup\`, PSR-4 from `classes/`. Global accessor `VuloBackup()`.
- PHP 7.4 syntax. No union types, constructor promotion, `match` or named arguments.
- Hooks are prefixed `vulobackup_`. Text domain `vulobackup`. Every option is named `vulobackup_*`.
- VuloBackup contains no code for any other VuloLabs plugin and needs none of them.
- No custom database tables. Job state lives in files beside the backups ([DATABASE](DATABASE.md)).
- Nothing may assume one long request. Every step keeps a cursor and can stop after any unit of work ([ARCHITECTURE](ARCHITECTURE.md#3-jobs-and-slices)).
- Nothing read from a backup is trusted ([SECURITY-AND-PRIVACY](SECURITY-AND-PRIVACY.md)).
- Anything not listed in [HOOKS](HOOKS.md) or [EXTENDING](EXTENDING.md) is internal and may change.
