# Migration

## What it does

Moves a site to another address, another server or both: download a backup from the old site, import it on the new one, restore it there.

## Why it matters

- The same backup you already make is your migration tool. There is nothing extra to buy or set up.
- WordPress stores the site address in thousands of places, many of them in a format that breaks if the address is simply replaced. VuloBackup changes them correctly.

## How to use it

1. **On the old site:** make a full backup, open its **Details** and select **Download**.
2. **On the new site:** install WordPress and VuloBackup. The address and the database table prefix can be different.
3. Go to **Backups → Import a backup** and choose the downloaded file.
4. Open the imported backup and select **Verify integrity**.
5. Select **Restore** and follow [RESTORE](RESTORE.md).

The restore screen shows where the backup is from and says that its address will be replaced by this site's.

### What is adapted for you

| What | How |
|---|---|
| The site address | Every form of the old address (`http://`, `https://`, without a scheme, inside JSON, inside URL parameters) is replaced throughout the database |
| Serialized data | WordPress records the length of each piece of text in many settings. Those lengths are rewritten, including in data nested inside other data, so settings are not corrupted |
| The table prefix | Tables are restored under the new site's prefix, and the settings named after the prefix (user roles and capabilities) are renamed |
| WordPress's own address settings | Set to the new site |

### What is not changed

- The `guid` of posts. WordPress asks that it never change.
- Addresses of other sites.
- A different host name that merely starts the same (`old.example.com.au` is not `old.example.com`).

### What may need doing by hand

- Plugin licences tied to the old domain.
- Addresses a plugin stores in its own format that VuloBackup cannot read. The number of values left alone is shown on the restore.
- Addresses written without the domain, hard-coded paths, and settings in `wp-config.php` or the server configuration.
- A `www.` variant of the old address, if the content used both.
- Permalinks: open **Settings → Permalinks** in WordPress and save once if links do not work.

VuloBackup does not claim to migrate every plugin's configuration automatically.

### Checks made first

The restore screen warns when the backup's WordPress or PHP version is newer than the new server's. It refuses a backup made by a newer VuloBackup, and a multisite backup on a single site (or the reverse).

## Settings explained

Migration has no settings of its own. It uses the import under **Backups** and the restore screen.

## Related

- [BACKUPS](BACKUPS.md#import-a-backup) - importing.
- [RESTORE](RESTORE.md) - the restore steps.
