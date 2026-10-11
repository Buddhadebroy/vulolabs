# Schedule and Retention

## What it does

The schedule makes backups by themselves. Retention removes the oldest ones so they do not fill the disk.

## Why it matters

- A backup you have to remember to make is a backup that is weeks old when you need it.
- Without a limit, backups grow until the disk is full and the site stops.

## How to use it

1. Go to **VuloBackup → Settings → Schedule**.
2. Choose how often the **Database** and the **Files** are backed up.
3. Choose a **Time of day** when the site is quiet.
4. Under **How many to keep**, set the numbers.

Changes save by themselves.

### Scheduled times are "not before"

WordPress runs scheduled tasks when someone visits the site. A scheduled backup starts at the first visit after the chosen hour, not at the exact minute. On a site with few visitors it also moves forward only when the site is visited.

- A backup that was missed is made at the next opportunity, not skipped.
- When database and files are due together they are made as one full backup.
- Two scheduled backups never run at once.

For exact times, ask your host to call `https://your-site/wp-cron.php` every few minutes.

### What retention never removes

- Anything, when a backup fails. Old backups are removed only after a new one has completed and been verified.
- Imported backups. They are yours to delete.
- The two newest safety backups made before restores.

The screen shows which backups the next successful backup will remove.

## Settings explained

| Setting | Default | What it does | Why you might change it |
|---|---|---|---|
| **Database** | Manual only | Daily, weekly or monthly database backups | Daily suits most sites: the database changes most and is small |
| **Files** | Manual only | Daily, weekly or monthly file backups | Weekly suits most sites |
| **Time of day** | 03:00 | The hour, in the site's timezone | Pick your quietest hour |
| **Day of the week** | Monday | For weekly backups | |
| **Day of the month** | 1 | For monthly backups, 1 to 28 | |
| **On this server** | 5 | Newest backups kept here. 0 keeps all | Lower it when disk space is short |
| **At each remote destination** | 5 | Counted separately for each. 0 keeps all | Raise it for a longer history where storage is cheap |
| **Keep a copy on this server after uploading** | On | Off removes a backup's archives here once every destination has confirmed its copy | To save disk space. A restore then downloads the backup first |

## Related

- [STORAGE](STORAGE.md) - remote destinations.
- [TROUBLESHOOTING](TROUBLESHOOTING.md#scheduled-backups-do-not-run) - when a schedule does not run.
