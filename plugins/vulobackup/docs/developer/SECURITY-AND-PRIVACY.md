# Security

A backup holds the whole site, and a restore can replace it. This is what VuloBackup defends against, how, and what it cannot.

## Who can do what

Every screen and REST route requires `manage_options` (`manage_network` on multisite); see `Rest\Controller::check_permission()`. There is no public route, no `nopriv` AJAX action and no token-based endpoint. REST cookie authentication verifies the `wp_rest` nonce, which is the CSRF protection for state-changing requests. Starting a restore additionally requires the typed confirmation word in the request body.

## Threats and protections

| Threat | Protection |
| --- | --- |
| A visitor downloads a backup by guessing its address | The folder name has 80 random bits; the folder carries `.htaccess`, `web.config` and `index.php`; no URL to a backup is ever produced; downloads are streamed by an authenticated route. Diagnostics requests a probe file and reports if the server serves it. The folder can be moved outside the web root. |
| Unauthorized backup, restore, delete | Capability check on every route; nonce; confirmation word for restore |
| Path traversal through ids or names | Ids must match `PathGuard::is_id()`; part names must match `Manifest::PART_PATTERN`; deletes check the target is inside the storage folder |
| Zip-slip, absolute paths, backslashes, drive letters | `PathGuard::is_safe_relative()` on every archive entry; extraction by stream into a staging folder, never `extractTo()` on the live site; `would_be_within()` on the target |
| Symbolic links in an archive | Entries with a Unix link file type are refused. On backup, links are never followed |
| Zip bombs, oversized archives | Running totals of files and bytes are compared with the manifest; each entry is copied with a byte limit of its declared size |
| Forged or edited SQL | `SqlGuard`: one statement per line, only the exporter's statement shapes, only literal values. The dump's own closing counts must match what was loaded. Character sets in which a quote byte can hide inside a character are refused |
| SQL injection in the plugin's own queries | Values go through `$wpdb->prepare()`; identifiers are validated against `[A-Za-z0-9_$]` and backtick-quoted |
| Objects created from backup data | `unserialize()` is not used on backup data. Address replacement parses the serialized text itself. (`active_plugins` is read with `allowed_classes => false`.) |
| Corrupted or swapped archives | SHA-256 of every part, checked before every restore and on demand |
| Arbitrary file write through settings | The backup folder must be writable, absolute, and not inside plugins, themes, uploads, wp-admin or wp-includes. Exclusion patterns are matched against in-site paths and cannot contain `..`. No setting runs a command |
| Credential disclosure | Storage secrets are encrypted at rest (`Security\Secrets`, libsodium secretbox, key from `wp_salt` plus a per-site random value), never returned by the API, and scrubbed from logs and error messages (`Redactor`) |
| SSRF through storage settings | S3 endpoints must be `https://` with a bare host; requests use `wp_safe_remote_request()` (which refuses private and loopback addresses) and never follow redirects. SFTP connects to the host the administrator enters |
| A changed SFTP server | The host key fingerprint is pinned on test; a different key stops transfers |
| Two destructive operations at once | One job at a time, guarded by a file lock; a restore cannot start while anything runs |
| Secrets in backups | `wp-config.php` is excluded unless switched on, and never restored. The manifest and logs hold no secrets |
| Data sent to the vendor | None. No telemetry, no licence check, no remote assets |

## Remaining risks

- **nginx and other servers that ignore `.htaccess`.** Protection then rests on the unguessable folder name. Diagnostics detects this; the fix is a folder outside the web root or a server rule.
- **An administrator account that is compromised** can download, delete and restore backups. That is inherent to an in-site backup plugin. Off-site copies with object lock or versioning limit the damage.
- **Storage credentials can be decrypted by anyone with both the database and `wp-config.php`.** They have to be usable by the site without a person present.
- **The encryption password is stored on the site** for scheduled backups. Encryption protects copies elsewhere, not from someone who controls the site.
- **A restore is not transactional.** DDL cannot be rolled back; the safety backup is the recovery path. A power loss between the folder switch and the database switch leaves new folders with the old database, with the old folders still beside them (`*.vbold-*`).
- **"Other wp-content files" and "WordPress itself" are restored by overwriting**, which cannot be undone if interrupted.
- **SFTP has no checksum**; a finished upload is confirmed by size only.
- **An SFTP destination may be on a private network** by design, so the SSRF restrictions for HTTP do not apply to it. Only administrators can configure one.
- **Backups contain personal data.** Who may download them, and where they are stored, is the site owner's responsibility.
- **Multisite is untested.**
