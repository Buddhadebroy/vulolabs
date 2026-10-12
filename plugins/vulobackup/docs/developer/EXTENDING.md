# Extending

## 1. What is supported

| To | Use | Document |
|---|---|---|
| React to a backup or restore | The completed and failed actions | [HOOKS](HOOKS.md#actions) |
| Start a backup | `VuloBackup()->runner->start_backup()` | [HOOKS](HOOKS.md#starting-a-backup-from-code) |
| Read the backups | `VuloBackup()->jobs->all( 'backups' )`, `->get( 'backups', $id )` | [DATABASE](DATABASE.md#jobjson) |
| Add a storage provider | `vulobackup_storage_providers` and `Storage\Provider` | [STORAGE](STORAGE.md#6-adding-a-provider) |
| Change what is left out | `vulobackup_exclusions` | [HOOKS](HOOKS.md#filters) |
| Add REST routes | `vulobackup_rest_controllers` | [HOOKS](HOOKS.md#filters) |

Anything else is internal and may change.

## 2. Rules for an add-on

- **Backups made by Free must stay restorable by Free.** Do not change the backup format without raising `VULOBACKUP_FORMAT_VERSION`, and store nothing that a restore would need.
- **No public routes.** Every route added must require an administrator.
- **No long requests.** Work that can be long must be resumable, like the engine's own steps.
- **Never log a credential.** Register secrets with `VuloBackup()->logger->hide()` before using them.
- **Nothing from a backup is trusted.** Use `Security\PathGuard`, `Database\SqlGuard` and `Backup\Manifest::validate()`; do not `unserialize()` backup data.

## 3. VuloBackup Pro

Free is complete on its own. It has no Pro screens, no upgrade prompts and no licence check, and it must stay that way.

A future Pro add-on would build on the seams above: central management of many sites, fleet-wide policies and reporting, event-triggered backups, more storage providers, storage lifecycle tiers, managed monitoring and alerting, team roles. See [ROADMAP](ROADMAP.md).

With Pro deactivated, or its licence expired, every backup must still list, verify, download and restore with Free alone.
