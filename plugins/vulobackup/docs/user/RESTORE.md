# Restore

## What it does

**Restore** puts a backup back: the database, chosen folders, or everything.

## Why it matters

- A restore replaces live data. Everything added since the backup was made is lost.
- VuloBackup does as much as it can before it replaces anything, and tells you plainly what happened if it fails.

## How to use it

### Before you start

- Know a user name and password **from the backup**. The restored database has the backup's users.
- Make sure there is free disk space for the files being restored: the old folders are kept until the restore has succeeded.
- Keep the page open until it finishes.

### Steps

1. Go to **VuloBackup → Backups**, find the backup and select **Restore**. Or go to **VuloBackup → Restore** and choose one.
2. Read **The backup**: when it was made, on which site, and what it contains.
3. Under **What to restore**, tick what should be replaced.
4. Leave **Back up the current site first** on.
5. If the backup is encrypted and was made elsewhere, enter its password.
6. Read **This will replace**, type the word shown, and select **Restore this backup**.

### What to restore

| Choice | How it is restored |
|---|---|
| **Database** | Loaded into temporary tables, then switched in one step at the very end |
| **Plugins, Themes, Uploads, Must-use plugins** | Replaced as whole folders, and switched back if the restore fails |
| **Other wp-content files**, **WordPress itself** | Copied over the existing files one by one. Not ticked to begin with: this cannot be undone if the restore is interrupted, and files that are not in the backup stay |

### What happens, in order

| Step | What VuloBackup does | Site changed? |
|---|---|---|
| Verify | Checks every archive against its checksum | No |
| Safety backup | Backs up what is about to be replaced | No |
| Check the server | Folder permissions, database rights, disk space | No |
| Unpack | Unpacks files into staging folders, checking every entry | No |
| Load | Loads the database into temporary tables, checking every statement | No |
| Replace address | Only when the backup is from another address | No |
| Copy | "Other wp-content files" and "WordPress itself", if ticked | **Yes, partly** |
| Switch | Switches the folders, then the database | **Yes** |

You can cancel at any time before the last two steps and nothing will have changed.

### Afterwards

- You may be asked to sign in again. Use a user name and password from the backup. If the same user exists in the backup, you stay signed in.
- VuloBackup's own settings, destinations and list of backups are kept as they were.
- The site keeps its current address.
- `wp-config.php` is never replaced.
- Tables that are in the database but not in the backup are left alone.

**Past restores**, at the bottom of the Restore screen, lists each restore with its result.

### If a restore fails

The message says how much of the site was changed.

| Message ends with | What happened | What to do |
|---|---|---|
| "Nothing on your site was changed." | It failed before anything was replaced | Fix what the message names and try again |
| "Some files … had already been replaced." | Only when "Other wp-content files" or "WordPress itself" was ticked. The database was not changed | Restore again, or restore the safety backup |

After a completed restore, the way back is to restore the **Safety backup before restore** listed under Backups.

A restore cannot be made fully reversible: creating and renaming database tables cannot be undone as one transaction. The safety backup is the way back.

### Restoring without VuloBackup

If the site is too broken to open the admin, unpack a downloaded backup. Import `database.sql.gz` with phpMyAdmin or the mysql client, and unpack the `files-*.zip` archives over `wp-content`. Their folders are `plugins/`, `themes/`, `uploads/`, `mu-plugins/`, `others/` (the rest of wp-content) and `core/` (WordPress itself).

## Settings explained

| Setting | Where | Default | What it does |
|---|---|---|---|
| **Back up the current site first** | The restore screen | On | Makes a safety backup before anything is replaced. The restore does not start if it fails |
| **Suggest a safety backup before every restore** | **Settings → Advanced** | On | Whether the switch above starts on |

## Related

- [MIGRATION](MIGRATION.md) - restoring on another site.
- [TROUBLESHOOTING](TROUBLESHOOTING.md#a-restore-failed) - when it fails.
