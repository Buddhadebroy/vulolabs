# Diagnostics

## What it does

**Diagnostics** checks what your server can and cannot do, and keeps the record of everything VuloBackup did.

## Why it matters

- Most backup problems come from the hosting: a missing PHP extension, a low time limit, a full disk. Diagnostics names them before they cost you a backup.
- The activity log answers "did last night's backup run, and was it uploaded?"

## How to use it

1. Go to **VuloBackup → Diagnostics**.
2. Read **Server checks**. Anything not marked **OK** says what to do.
3. Select **Check again** after changing something.

### Server checks

| Check | What it tells you |
|---|---|
| **Backup folder** | Whether it exists and is writable |
| **Backup folder location** | Inside or outside the web root |
| **Backup folder is closed to the web** | A test file is requested through your web server. **Problem** means the server served it: move the folder or block it |
| **PHP zip / zlib extension** | Needed for file backups / database backups |
| **PHP sodium extension** | Needed for encryption |
| **Free disk space** | What is left on the backup folder's disk |
| **PHP time limit**, **memory limit** | The limits each backup step has to fit in |
| **WP-Cron**, **Schedule check** | Whether scheduled backups can start |
| **Tables left by a restore** | Shown only when a restore left temporary tables; they are removed automatically |

| Badge | Meaning |
|---|---|
| **OK** | Fine |
| **Note** | Worth knowing, nothing to fix |
| **Check** | May cause trouble |
| **Problem** | Fix this |

### System

Versions of VuloBackup, WordPress, PHP and the database, the table prefix, the backup folder and the space backups use. Include this when you ask for help.

### Activity log

Every backup, upload, restore, verification, deletion and settings change, newest first. Filter by **Errors** or **Warnings**. **Clear log** empties it; your backups are not affected.

The log never holds passwords, keys or the contents of your database.

## Settings explained

**Settings → Notifications**

| Setting | Default | What it does |
|---|---|---|
| **Email me when a backup fails** | On | One email per failed backup, and when a backup cannot be copied to remote storage |
| **Send to** | The site administrator | Another address for those emails |
| **Keep activity for** | 30 days | How long the activity log is kept |

Emails are sent with your site's own email. Whether one arrives depends on how the site sends email.

## Related

- [TROUBLESHOOTING](TROUBLESHOOTING.md) - what to do about each problem.
- [STORAGE](STORAGE.md) - moving the backup folder.
