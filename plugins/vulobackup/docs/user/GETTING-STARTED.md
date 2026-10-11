# Getting Started with VuloBackup

## What VuloBackup does

VuloBackup makes copies of your WordPress site, keeps them on your server and in storage you choose, checks that every copy is intact, and puts a copy back when you need it.

## Why use it

- Updates go wrong, sites get hacked, servers fail and people delete things by mistake. A backup is the only way back.
- Backups run by themselves on a schedule, and old ones are tidied away for you.
- A copy kept away from the server survives the server.
- You can move a site to a new address or host with the same tool.
- You do not need a VuloLabs account, a subscription or any other plugin. Nothing is sent to VuloLabs.

## About this page

This page covers what you only need once: requirements, installing, a first backup, a schedule, a copy off the server and a map of the menu. The other guides do not repeat it.

**In this guide**

1. [How it works](#1-how-it-works)
2. [Requirements](#2-requirements)
3. [Install and activate](#3-install-and-activate)
4. [Make your first backup](#4-make-your-first-backup)
5. [Set a schedule](#5-set-a-schedule)
6. [Keep a copy somewhere else](#6-keep-a-copy-somewhere-else)
7. [Find your way around](#7-find-your-way-around)
8. [Ideas you will see everywhere](#8-ideas-you-will-see-everywhere)
9. [Where to go next](#9-where-to-go-next)

## 1. How it works

```
Your site  ->  VuloBackup  ->  a backup on your server  ->  checked (verified)
                                         │
                                         └─►  copied to your S3 bucket or SFTP server  ->  confirmed
```

A backup is made in short steps, so it works on ordinary hosting, and it carries on by itself if a step is interrupted.

**Nothing on your site changes when you make a backup.** Only a restore replaces anything, and a restore asks you to confirm first.

## 2. Requirements

| Requirement | Minimum |
|---|---|
| WordPress | 6.4 or greater |
| PHP | 7.4 or greater, with the `zip` and `zlib` extensions |
| Encryption (optional) | PHP's `sodium` extension |
| Who can use it | Site administrators |
| Free disk space | Roughly the size of your uploads, plugins and themes |
| Remote storage (optional) | An S3-compatible bucket or an SFTP account |

**Diagnostics** shows what your server has.

## 3. Install and activate

1. In WordPress, go to **Plugins → Add New** and install **VuloBackup**, or upload its zip file.
2. Select **Activate**.
3. **VuloBackup** appears in the admin menu.

## 4. Make your first backup

1. Open **VuloBackup → Overview** and select **Back up now**.
2. Leave **Database and files** selected and the ticked folders as they are.
3. Select **Start backup**.

A progress bar shows what the backup is doing. You can leave the page; the backup carries on whenever the site is visited. When it finishes it is listed under **Backups** as **Completed** and **Verified**.

## 5. Set a schedule

1. Open **Settings → Schedule**.
2. Set **Database** to **Daily** and **Files** to **Weekly**. That suits most sites.
3. Choose a quiet **Time of day**.

Changes save by themselves. See [SCHEDULE-AND-RETENTION](SCHEDULE-AND-RETENTION.md).

## 6. Keep a copy somewhere else

A backup that only exists on the server is lost with the server.

1. Open **Settings → Storage** and select **Add destination**.
2. Choose **Amazon S3 or S3-compatible** or **SFTP server** and fill in the form.
3. Select **Test and save**.

From now on every backup is also uploaded there. See [STORAGE](STORAGE.md).

## 7. Find your way around

| Menu item | What it is for | Guide |
|---|---|---|
| **Overview** | The last backup, the next one, storage, warnings | [OVERVIEW](OVERVIEW.md) |
| **Backups** | Every backup, and what you can do with one | [BACKUPS](BACKUPS.md) |
| **Restore** | Put a backup back | [RESTORE](RESTORE.md) |
| **Diagnostics** | Server checks and the activity log | [DIAGNOSTICS](DIAGNOSTICS.md) |
| **Settings** | Schedule, contents, storage, security, notifications, advanced | [SETTINGS](SETTINGS.md) |

The search box at the top of every screen finds a tab or a settings page by name.

## 8. Ideas you will see everywhere

| Word | Meaning |
|---|---|
| **Full / Database / Files** | What a backup contains |
| **Completed** | Every archive was written, checked and listed |
| **Verified** | The archives match their recorded checksums |
| **Warnings** | The backup completed, but something was left out or a remote copy failed |
| **Kept at** | Where copies of a backup are: this server, and each destination |
| **Safety backup** | A backup of the current site made just before a restore |
| **No Save button** | Settings save by themselves a moment after you change them |

Dates use the date format, time format and timezone from WordPress's **Settings → General**.

## 9. Where to go next

- [BACKUPS](BACKUPS.md) - what a backup holds and what you can do with it.
- [RESTORE](RESTORE.md) - read this before you need it.
- Try a restore on a test site. It is the only proof that a backup works. See [MIGRATION](MIGRATION.md).
