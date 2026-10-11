# Overview

## What it does

**Overview** is the first screen: when the site was last backed up, when the next backup is due, where backups are kept, and anything that needs your attention.

## Why it matters

- One look tells you whether the site is protected.
- Problems are stated at the top, so a failed backup or a failing storage destination is not missed.

Every figure is read from your backups and your server. Nothing is estimated.

## How to use it

1. Go to **VuloBackup → Overview**.
2. Read any notices at the top.
3. Select **Back up now** to make a backup straight away.

### Notices

| Notice | What it means |
|---|---|
| This site has no backup yet | Make one |
| The most recent backup is more than 30 days old | Make one, or set a schedule |
| The most recent backup … failed | The reason follows. Fix it and back up again |
| The most recent backup completed with warnings | Open it under **Backups** to read them |
| No schedule is set | Backups are only made when you start one |
| WP-Cron is switched off | Scheduled backups need the server to call `wp-cron.php` |
| Backups are kept on this server only | Add a remote destination |
| Encryption is switched on but cannot work | The password or PHP's sodium extension is missing |

### The four tiles

| Tile | Shows |
|---|---|
| **Last backup** | Date and time of the newest completed backup |
| **Next scheduled backup** | When the next one is due, or "No schedule" |
| **Backups kept** | How many completed backups exist |
| **Used on this server** | Space the backups on this server take |

### Last backup

Name, date, what it contains, whether it is verified and where it is kept. **Restore this backup** opens the restore screen for it.

### Where backups are kept

This server (with free disk space and whether the folder is inside the web root) and each remote destination, marked **Connected**, **Failing** or **Off**.

### Recent activity

The last few things VuloBackup did. The full list is under **Diagnostics**.

### While a backup or restore runs

A bar at the top of every screen shows what it is doing and how far along it is, with **Cancel**.

## Settings explained

Overview has no settings of its own. What it shows comes from:

| Shown here | Set under |
|---|---|
| Next scheduled backup | **Settings → Schedule** |
| Where backups are kept | **Settings → Storage** |
| Encryption warnings | **Settings → Security** |

## Related

- [BACKUPS](BACKUPS.md) - the full list.
- [DIAGNOSTICS](DIAGNOSTICS.md) - server checks and the whole activity log.
