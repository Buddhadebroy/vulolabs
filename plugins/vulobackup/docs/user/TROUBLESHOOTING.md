# Troubleshooting and FAQ

Find what is going wrong, then follow the steps. Each answer points to the guide with more detail.

**Start with these two, whatever the problem:**

1. **Diagnostics → Server checks.** It finds most hosting problems and says what to do.
2. **Backups → Details → Log of this backup.** It shows what the backup was doing when it stopped.

**Jump to**

- [A backup stops and starts again, or fails with "stopped the work several times"](#a-backup-stops-and-starts-again-or-fails-with-stopped-the-work-several-times)
- [A backup stays at the same point for a long time](#a-backup-stays-at-the-same-point-for-a-long-time)
- [There is not enough disk space](#there-is-not-enough-disk-space)
- [A table could not be read](#a-table-could-not-be-read)
- [Files were left out](#files-were-left-out)
- [An upload to remote storage fails](#an-upload-to-remote-storage-fails)
- [Scheduled backups do not run](#scheduled-backups-do-not-run)
- [Diagnostics says the backup folder is open to the web](#diagnostics-says-the-backup-folder-is-open-to-the-web)
- [A restore failed](#a-restore-failed)
- [I am locked out after a restore](#i-am-locked-out-after-a-restore)
- [Reset or remove VuloBackup](#reset-or-remove-vulobackup)
- [FAQ](#faq)

## A backup stops and starts again, or fails with "stopped the work several times"

PHP is ending the step before it finishes, usually because of a time or memory limit.

1. Lower **Settings → Advanced → Seconds per step** (try 10).
2. Lower **Archive size** (try 25 MB).
3. Exclude very large folders under **Settings → What to back up**, or set **Skip files larger than**.
4. Ask your host to raise PHP's `max_execution_time` and `memory_limit`.

## A backup stays at the same point for a long time

A backup moves forward when the VuloBackup screen is open, or when the site is visited. On a site with no visitors, keep the screen open, or have your host call `wp-cron.php` on a timer.

## There is not enough disk space

1. Delete old backups, or lower **Settings → Schedule → On this server**.
2. Exclude large folders.
3. Switch off **Keep a copy on this server after uploading** to keep backups remotely only.
4. Move the backup folder to a bigger disk under **Settings → Storage**.

## A table could not be read

The backup failed rather than leave that table out. Repair the table with your host's database tool, then back up again.

## Files were left out

The backup's warnings list them.

- Symbolic links are never followed. That is deliberate.
- Unreadable files need their permissions fixed so the web server can read them.
- Files that changed or disappeared while the backup ran are in the next backup.

## An upload to remote storage fails

The backup is safe on the server; only the copy failed.

- **Access denied or signature errors (S3):** check the keys, the region, and that the key may write and delete in the bucket.
- **"identity key is not the one saved" (SFTP):** the server's key changed. If you changed the server, open the destination and select **Test connection** to accept the new key.
- Then make a new backup. There is no separate "upload again" for an old one.

See [STORAGE](STORAGE.md).

## Scheduled backups do not run

1. Check **Diagnostics → Schedule check** and **WP-Cron**.
2. If `DISABLE_WP_CRON` is set in `wp-config.php`, the server must call `wp-cron.php` itself.
3. A quiet site runs scheduled tasks only when visited.

See [SCHEDULE-AND-RETENTION](SCHEDULE-AND-RETENTION.md).

## Diagnostics says the backup folder is open to the web

Your web server ignores the protection files. This is usual on nginx.

- Move the folder outside the web root under **Settings → Storage**, or
- add a rule to the server configuration that denies access to `wp-content/vulobackup-*`.

## A restore failed

Read the message: it says whether anything was changed. See [RESTORE](RESTORE.md#if-a-restore-fails).

## I am locked out after a restore

Sign in with a user from the backup. If you do not know one, reset a password with your host's database tool or WP-CLI: `wp user update admin --user_pass=…`.

## Reset or remove VuloBackup

- **Deactivating** stops scheduled backups. Settings and backups are kept.
- **Deleting** the plugin keeps settings by default; choose **Delete settings and stored credentials** under **Settings → Advanced** first to remove them.
- **Backups are never deleted with the plugin.** Remove the backup folder yourself if you no longer want them. Its path is shown under **Diagnostics → System**.

## FAQ

**Can I restore a backup without VuloBackup?**
Yes, unless it is encrypted. See [RESTORE](RESTORE.md#restoring-without-vulobackup).

**Is my `wp-config.php` backed up?**
Only if you include "WordPress itself" and switch on "Include wp-config.php". It is never put back by a restore.

**Are scheduled backups made at an exact time?**
No. They start at the first visit after the chosen hour.

**Does a restore log me out?**
It can. VuloBackup keeps your session when the same user exists in the backup.

**Does it work on multisite?**
This version has only been tested on single sites.

**Is Google Drive supported?**
Not in this version.

**How large a site can it back up?**
VuloBackup runs inside WordPress, on your hosting. Very large sites (tens of gigabytes, millions of files) can take many hours on shared hosting or hit limits the plugin cannot work around. Sites of that size are better served by backups at the hosting level, with VuloBackup for the database and the folders that change.

**Does VuloBackup send anything to VuloLabs?**
No. Your backups go only to the destinations you add.
