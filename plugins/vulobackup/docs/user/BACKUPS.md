# Backups

## What it does

**Backups** lists every backup of the site with where it is kept and whether it is verified, and lets you make, inspect, check, download, import and delete backups.

## Why it matters

- A backup you have not looked at may not be the backup you think it is. The details say exactly what is inside.
- **Verify integrity** tells you a backup is still intact before the day you need it.
- A downloaded backup is a copy that depends on nothing but the file.

## How to use it

### Make a backup

1. Go to **VuloBackup → Backups** and select **Back up now**.
2. Choose what to back up: **Database and files**, **Database only** or **Files only**.
3. Tick the folders to include.
4. Optionally give it a name, for example "Before the redesign".
5. Select **Start backup**.

Only one backup or restore runs at a time.

### What a backup can hold

| Part | What it is |
|---|---|
| Database | Every table of this WordPress site: posts, pages, users, orders, settings |
| Plugins | Every installed plugin |
| Themes | Every installed theme |
| Uploads | The media library |
| Must-use plugins | `wp-content/mu-plugins` |
| Other wp-content files | Everything else in `wp-content`, such as languages |
| WordPress itself | `wp-admin`, `wp-includes` and the files beside them. Optional, off by default |

### What is always left out

- Caches, temporary files and other backup plugins' folders.
- VuloBackup's own backup folder.
- Symbolic links. They are never followed, so a link cannot pull in files from outside the site.
- `wp-config.php`, unless you switch it on.
- Database views, and tables whose names contain unusual characters.

Anything left out because it could not be read is listed in the backup's warnings. If a database table cannot be read, the backup fails and names the table; it is never finished with a table missing.

### Reading a row

| Column | Shows |
|---|---|
| **Backup** | Name, date, and whether it was started by hand, scheduled, imported or a safety backup |
| **Contains** | Full, Database or Files, and the size |
| **Kept at** | **This Server** and each remote destination. Red means the copy there failed |
| **Status** | **Completed**, **Failed**, **Cancelled** or what it is doing now; **Verified** or **Not verified**; **Warnings** |

Narrow the list with **All / Completed / Failed** and the search box.

### Details

**Details** shows what the backup contains, the site and versions it was made on, each archive with its SHA-256 checksum, and the backup's own log.

| Button | What it does |
|---|---|
| **Verify integrity** | Re-checks every archive on the server against its checksum and confirms each remote copy is still there |
| **Download** | Saves the backup as one zip file |
| **Restore** | Opens the restore screen for this backup |
| **Delete** | Removes it, after you confirm. When it is also at a remote destination you can delete it from this server only |
| **Cancel this backup** | Stops a running backup and removes what it had written |

### Import a backup

1. Select **Import a backup**.
2. Choose a file downloaded from VuloBackup, from this site or another.
3. When it is listed, open it and select **Verify integrity**.

Large files are uploaded in pieces, so your server's upload limit does not matter. An imported backup changes nothing on the site until you restore it.

### Inside a downloaded backup

A zip containing `manifest.json`, `database.sql.gz` and `files-001.zip`, `files-002.zip`… The SQL file and the file archives are ordinary formats, so a backup can be restored by hand in an emergency. Encrypted backups end in `.enc` and need VuloBackup and the password.

## Settings explained

**Settings → What to back up**

| Setting | Default | What it does | Why you might change it |
|---|---|---|---|
| **Files** | All but "WordPress itself" | The folders ticked when you start a backup, and used for scheduled backups | Untick large folders you keep elsewhere |
| **Include wp-config.php** | Off | Adds the file to backups that include WordPress itself | It holds your database password, so leave it off unless you need it. It is never restored |
| **Also leave out** | Empty | Your own exclusions, one per line. `*` matches within a name, `**` across folders | `uploads/videos/**`, `*.zip` |
| **Skip files larger than** | 0 (no limit) | Leaves out files above this size | To keep huge files out of backups |
| **Tables** | This site's tables | Or every table in the database | When other software shares the database |

## Related

- [SCHEDULE-AND-RETENTION](SCHEDULE-AND-RETENTION.md) - backups by themselves.
- [RESTORE](RESTORE.md) - putting one back.
- [ENCRYPTION](ENCRYPTION.md) - protecting them with a password.
