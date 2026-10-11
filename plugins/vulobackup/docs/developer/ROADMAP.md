# Deferred and future work

## Deferred from 1.0

| Feature | Why it is not in 1.0 |
| --- | --- |
| Google Drive | Needs a registered Google OAuth application and its verification. It will not be built on undocumented endpoints |
| Multisite | The code limits itself to network administrators and uses the base prefix, but it has not been tested, so it is not claimed |
| Uploading an older backup again after a failed upload | A new backup uploads; there is no "retry upload" for an existing one |
| Restoring from a destination that is not listed on this site | Download the backup there and import it |
| Partial restore of single tables or files | Whole database, whole folders |
| Database views, triggers, stored routines | Skipped and reported |
| Exact-time scheduling | Depends on WP-Cron; documented |

## Possible VuloBackup Pro capabilities

These would build on the seams in [EXTENDING.md](EXTENDING.md) without changing Free: central management of many sites, fleet-wide policies and reporting, event-triggered backups, more storage providers, storage lifecycle tiers, managed monitoring and alerting, team roles. Free must stay fully useful, and every backup must stay restorable, with Pro absent.
