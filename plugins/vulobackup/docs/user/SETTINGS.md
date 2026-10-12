# Settings

## What it does

**VuloBackup → Settings** holds everything you configure. It is split into sub-tabs along the top.

## Why it matters

Most sites only need a schedule and one remote destination. The rest lets you decide what is backed up, how it is protected and what you are told.

## How to use it

1. Go to **VuloBackup → Settings**.
2. Pick a sub-tab.
3. Change what you need.

**There is no Save button.** A change saves by itself a moment after you make it, and a "Settings saved" notice appears. The exceptions act when you select their button: adding or changing a storage destination, moving the backup folder, and the encryption password.

To find a settings page quickly, type its name in the search box at the top of the screen.

## Sub-tabs

| Sub-tab | What is there | Guide |
|---|---|---|
| **Schedule** | How often backups are made, how many are kept | [SCHEDULE-AND-RETENTION](SCHEDULE-AND-RETENTION.md) |
| **What to back up** | Folders, exclusions, database tables | [BACKUPS](BACKUPS.md#settings-explained) |
| **Storage** | The backup folder and remote destinations | [STORAGE](STORAGE.md) |
| **Security** | Encrypting backups with a password | [ENCRYPTION](ENCRYPTION.md) |
| **Notifications** | Failure emails, how long the activity log is kept | [DIAGNOSTICS](DIAGNOSTICS.md#settings-explained) |
| **Advanced** | Safety backups, server limits, uninstall | below |

## Settings explained

### Advanced

| Setting | Default | What it does | Why you might change it |
|---|---|---|---|
| **Suggest a safety backup before every restore** | On | The restore screen starts with the safety backup switched on | Leave it on |
| **Seconds per step** | 20 | How long each step of a backup works before it saves and stops | Lower it (try 10) if backups keep stopping at the same point |
| **Archive size** | 100 MB | Files are packed into archives of about this size | Lower it on servers with little memory or slow uploads |
| **When VuloBackup is deleted → Settings** | Keep settings | Or delete settings and stored credentials | Choose delete when you are removing the plugin for good |

**Your backups are never deleted with the plugin.** The backup folder and everything in it stays on the server, and copies at remote destinations stay there. Delete them yourself if you no longer want them.

## Related

- [GETTING-STARTED](GETTING-STARTED.md) - the settings most sites need.
- [TROUBLESHOOTING](TROUBLESHOOTING.md) - when to change the server limits.
