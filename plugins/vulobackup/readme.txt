=== VuloBackup – Backup, Restore & Migration ===
Contributors: vulolabs
Tags: backup, restore, migration, database backup, s3
Requires at least: 6.4
Tested up to: 7.1
Requires PHP: 7.4
Stable tag: 1.0.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Back up your WordPress site. Restore it when it matters. Database and file backups, schedules, remote storage, integrity checks, restore and migration.

== Description ==

VuloBackup backs up your WordPress database and files, keeps copies on your server and in your own remote storage, checks that every backup is intact, and restores a backup through a guided, careful process.

Everything on this page is in the free plugin. No VuloLabs account, subscription or other plugin is needed, and nothing is sent to VuloLabs: your backups go only where you tell them to.

= Back up =

* **Full, database-only or files-only backups**, started by hand or on a schedule.
* **Choose what is included:** plugins, themes, uploads, must-use plugins, the rest of wp-content and, optionally, WordPress itself. Leave out folders or file patterns of your own.
* **Works on ordinary hosting.** A backup is made in short steps that fit within PHP's time limit, never in one long request, and carries on where it stopped if a step is interrupted.
* **Never silently incomplete.** If a database table cannot be read the backup fails and says which one. Files that had to be left out (unreadable files, symbolic links) are listed on the backup.

= Schedule and keep =

* **Daily, weekly or monthly schedules**, set separately for the database and for files.
* **Keep the newest N backups**, counted separately on the server and at each remote destination. Old backups are removed only after a new one has completed and been verified, never because one failed.

= Store =

* **On your server**, in a folder with an unguessable name that refuses web requests. Backups are only ever downloaded through WordPress, by an administrator.
* **Amazon S3 and S3-compatible storage** (for example Cloudflare R2, Backblaze B2, Wasabi, DigitalOcean Spaces, MinIO), with large files uploaded in parts and interrupted uploads resumed.
* **SFTP** to any server of your own.
* A destination is only saved after a real write, read and delete there has worked, and an upload is only marked done after the file has been confirmed at the far end.

= Verify =

* Every backup has a **manifest** listing what it holds and the **SHA-256 checksum** of each archive.
* **Verify integrity** re-checks a backup on the server and at each remote destination at any time.
* Checksums are checked again before every restore.

= Encrypt (optional) =

* Password-encrypt backup archives with libsodium (Argon2id key derivation, XChaCha20-Poly1305). Requires PHP's sodium extension.
* **If you lose the password, an encrypted backup cannot be restored by anyone.** VuloLabs never receives it.

= Restore =

* Restore the database, chosen folders, or everything.
* Before anything is replaced the backup is verified, a **safety backup** of the current site is made (optional), and the server is checked.
* The database is loaded into temporary tables and switched in one step at the very end. Plugins, themes and uploads are switched as whole folders, and switched back if the restore fails.
* A restore must be confirmed by typing a word, and cannot be started by anyone but an administrator.

= Migrate =

* **Download** a backup as one file and **import** it on another site.
* When the address is different, the old address is replaced throughout the database **without breaking serialized data**, and the table prefix is adapted.

= What VuloBackup does not promise =

A backup plugin runs inside the site it protects, on the hosting it has. VuloBackup cannot guarantee that a restore will succeed on every server, and it does not migrate every third-party plugin's configuration automatically. Keep at least one copy of your backups somewhere other than the server, and try a restore on a test site before you need one.

== Installation ==

1. Upload the plugin and activate it, or install it from Plugins → Add New.
2. Open **VuloBackup** in the admin menu and select **Back up now**.
3. Under **Settings → Schedule**, choose how often backups are made and how many are kept.
4. Under **Settings → Storage**, add a remote destination so a copy is kept off the server.
5. Open **Diagnostics** to see what your server supports.

== Frequently Asked Questions ==

= Where are backups kept? =

In `wp-content/vulobackup-` followed by twenty random characters, protected against web access, and at any remote destinations you add. You can move the local folder, ideally outside the web root, under Settings → Storage. Diagnostics checks whether your web server really refuses requests to the folder; on nginx it may not, and Diagnostics tells you if so.

= Are scheduled backups made at an exact time? =

No. WordPress runs scheduled tasks when someone visits the site, so a backup starts at the first visit after the chosen hour, and on a quiet site it also continues at each visit. For exact times, have your host call `wp-cron.php` on a timer.

= Can I restore a backup without VuloBackup? =

Yes. A downloaded backup is a zip holding `database.sql.gz` (ordinary SQL, importable with phpMyAdmin or the mysql client) and `files-001.zip`, `files-002.zip`… (ordinary zips of your folders). Encrypted backups are the exception: they need VuloBackup and the password.

= What happens to my backups if I delete the plugin? =

They stay on the server and at your remote destinations. Deleting the plugin never deletes a backup.

= Does a restore log me out? =

It can. The restored database has the users and passwords of the backup. VuloBackup keeps your current session when the same user exists in the backup.

= Is my wp-config.php backed up? =

Only if you include "WordPress itself" and switch on "Include wp-config.php". It is never put back by a restore.

= Does it work on multisite? =

This version has only been tested on single sites. On a multisite network VuloBackup is limited to network administrators and backs up the whole network, but that has not been tested, so do not rely on it there yet.

= Is Google Drive supported? =

Not in this version.

== External services ==

VuloBackup contacts an external service only when you configure one as a storage destination:

* **Amazon S3 or an S3-compatible service you choose.** Your backup archives, their manifest and a small test file are sent to the endpoint and bucket you enter, authenticated with the keys you enter. Amazon's terms: https://aws.amazon.com/service-terms/ and privacy notice: https://aws.amazon.com/privacy/. For another provider, that provider's terms apply.
* **An SFTP server you choose.** The same files are sent to the server you enter.

No data is sent to VuloLabs. There is no telemetry.

== Third-party libraries ==

* phpseclib 3 (MIT) for SFTP.
* paragonie/constant_time_encoding (MIT) and paragonie/random_compat (MIT), required by phpseclib.

== Privacy ==

A backup contains whatever your site contains, including personal data of your users and customers. Store backups, and choose who may download them, accordingly. Only administrators can use VuloBackup. Its activity log records what was done and when; it never records passwords, keys or database contents.

== Changelog ==

= 1.0.0 =
* First release.

== Upgrade Notice ==

= 1.0.0 =
First release.
