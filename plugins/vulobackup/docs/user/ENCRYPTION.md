# Encryption

## What it does

Encryption locks your backup archives with a password. Without the password the archives cannot be read.

## Why it matters

- A backup holds your whole site: customers, orders, user accounts. Encryption protects it in the places it is copied to, such as a downloaded file, a storage bucket or an SFTP server.
- **If you lose the password, an encrypted backup cannot be restored by anyone.** VuloLabs never receives the password and cannot recover it.

## How to use it

1. Go to **VuloBackup → Settings → Security**.
2. Enter a password of at least 12 characters. A long phrase is best.
3. Select **Encrypt new backups**.
4. Write the password down and keep it somewhere that is not this website.

Encryption needs PHP's sodium extension. If your server does not have it, the screen says so and encryption stays off.

### What the password does and does not protect

The password is stored on this site, encrypted, so scheduled backups can run. That means:

- backups are protected wherever they are copied to,
- they are not protected from someone who already controls this WordPress site.

### Restoring an encrypted backup

On the site that made it, the stored password is used. On another site, or after the password was changed, the restore screen asks for it.

## Settings explained

| Control | What it does |
|---|---|
| **Password** / **New password** | The password for new backups. Leave empty to keep the current one |
| **Encrypt new backups** | Switches encryption on |
| **Change password** | Applies to new backups. Earlier backups still need the password they were made with |
| **Stop encrypting new backups** | Switches it off. Existing encrypted backups stay encrypted |

### How it works

The key is derived from your password with Argon2id. Archives are encrypted with XChaCha20-Poly1305 through PHP's libsodium, which also detects any change to an archive. The manifest is not encrypted; it holds names, sizes and checksums but no site content.

## Related

- [RESTORE](RESTORE.md) - restoring, including encrypted backups.
- [STORAGE](STORAGE.md) - where copies go.
