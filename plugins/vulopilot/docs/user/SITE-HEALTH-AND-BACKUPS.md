# Site Health and Backups

This page checks the technical health of WordPress itself and lets you back up and restore your site. It has two tabs: **Site Health** and **Backups**.

> Install and the first scan are in [GETTING-STARTED](GETTING-STARTED.md).

**In this guide**

1. [Run a Site Health scan](#1-run-a-site-health-scan)
2. [Understand the Site Health checks](#2-understand-the-site-health-checks)
3. [Create a backup](#3-create-a-backup)
4. [Restore, download or delete a backup](#4-restore-download-or-delete-a-backup)
5. [Set up automatic backups](#5-set-up-automatic-backups)

## 1. Run a Site Health scan

1. Open **VuloPilot → Site Health**.
2. Click **Run Site Health Scan** in the header.
3. Read the results on the **Site Health** tab.

## 2. Understand the Site Health checks

| Group | What it checks |
|---|---|
| **WordPress** | Core version, HTTPS setup and REST API availability |
| **Updates** | Pending WordPress core, plugin and theme updates |
| **Background Tasks** | Overdue scheduled events - a sign WP-Cron is not firing |
| **Database** | Table integrity, size and cleanup opportunities |
| **Server** | PHP and server configuration |

Other checks in this area cover plugins, themes, PHP warnings, site availability and heavy or dormant plugins. Fix each finding by following its recommendation, then re-scan.

**Plugin overlap.** The **Plugin Overlap** card lists active plugins that duplicate a feature already built into VuloPilot, so you can simplify your plugin list.

**Backup protection notice.** A banner tells you whether your site is being backed up automatically ("Backup protection: Enabled") or not ("Not enabled"), with a **View Backups** link.

## 3. Create a backup

1. Open the **Backups** tab, or click **Create Backup Now** in the header.
2. The backup starts in the background ("Backup started - this runs in the background and will appear below as it progresses").
3. Watch its status change: **Queued → Running → Completed** (or **Failed**). Completed backups show "Finished in ..." and failed ones "Failed after ...".

A backup is a database plus file archive stored on your own server. Manual backups always work, whether or not automatic backups are on.

## 4. Restore, download or delete a backup

The backup list shows each backup's trigger (**Manual**, **Scheduled** or **Pre-restore safety snapshot**), where it is stored and its status. Use the search box and the trigger filter to find one.

| Action | What happens |
|---|---|
| **Download** | Saves the backup archive to your computer |
| **Restore** | Overwrites the live site with that backup. **This is real and destructive.** A safety snapshot of the current state is taken automatically first |
| **Delete** | Removes the backup ("Backup deleted.") |

Restore steps:

1. Click **Restore** on the backup you want.
2. Read the warning and confirm.
3. Wait for "Restore complete. A safety snapshot of the previous state was taken automatically before this restore ran."

If a restore fails you will see "Restore failed - the site was not changed", with the error above. Nothing is overwritten in that case.

## 5. Set up automatic backups

1. Go to **Settings → Backups**.
2. Turn on **Enable automatic backups**.
3. Choose the **Backup frequency**: **Daily** or **Weekly**.
4. Set **Backups to keep**. The oldest completed backups beyond this number are deleted after each new one finishes, so disk use stays bounded.
5. Save.

## Related guides

- [SECURITY](SECURITY.md) - malware and integrity checks
- [PERFORMANCE](PERFORMANCE.md) - database and caching
- [SETTINGS](SETTINGS.md#backups)
