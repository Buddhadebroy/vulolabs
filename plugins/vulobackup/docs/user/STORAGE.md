# Storage

## What it does

**Settings → Storage** decides where backups are kept: the folder on this server, and remote destinations that receive a copy of every backup.

## Why it matters

- A backup that only exists on the server is lost with the server.
- A backup that a visitor can download is a copy of your whole site in a stranger's hands. The folder is protected, and this screen tells you how.

## How to use it

### The backup folder

Every backup is made on the server first, in `wp-content/vulobackup-` followed by twenty random characters. The folder:

- has a name that cannot be guessed,
- contains files telling Apache and IIS to refuse every request,
- is never linked to. Downloads go through WordPress and need an administrator.

To move it:

1. Enter the full path of a folder under **Backup folder**.
2. Select **Use this folder**.

The folder must be writable by the web server and cannot be inside the plugins, themes or uploads folder. A folder outside the web root is best. Backups in the previous folder stay there and are no longer listed; move them by hand if you want them listed.

**Diagnostics** fetches a test file from the folder to check that your web server really refuses. nginx ignores the protection files; if Diagnostics reports the folder is open, move it outside the web root or block it in the server configuration.

### Add a remote destination

1. Select **Add destination**.
2. Choose **Amazon S3 or S3-compatible** or **SFTP server**.
3. Fill in the form (tables below).
4. Select **Test and save**.

A small file is written, read back and deleted at the destination. Nothing is saved unless that works. Up to five destinations can be added.

### Manage a destination

| Control | What it does |
|---|---|
| Switch | On: new backups are uploaded here. Off: kept, not used |
| **Test connection** | Checks it again, and for SFTP accepts the server's current key |
| **Change** | Edit it. Leave a password or key empty to keep the saved one |
| **Remove** | Forgets it. Backups already there are left where they are |

### How uploads are confirmed

A remote copy is marked done only after the destination confirms the file is there at the right size. S3 also checks a SHA-256 of every part as it arrives. SFTP has no checksum, so size is what is confirmed.

Large archives are uploaded in parts, and an interrupted upload continues where it stopped. If an upload fails three times the backup is kept on the server, the destination is shown as **Failing**, and you are emailed if notifications are on.

## Settings explained

### This server

| Setting | Default | What it does | Why you might change it |
|---|---|---|---|
| **Backup folder** | `wp-content/vulobackup-…` | Where backups are made and kept | Move it outside the web root, or to a bigger disk |

### Amazon S3 or S3-compatible

Works with Amazon S3, Cloudflare R2, Backblaze B2, Wasabi, DigitalOcean Spaces, MinIO and other services with an S3-compatible API.

| Field | What to enter |
|---|---|
| **Endpoint** | Empty for Amazon S3. Otherwise the `https://` address your provider gives you |
| **Region** | The bucket's region, for example `us-east-1`. Providers without regions usually accept `auto` |
| **Bucket** | The bucket's name. Create the bucket with your provider first |
| **Access key ID**, **Secret access key** | A key that may read, write and delete in this bucket only |
| **Folder** | Optional folder inside the bucket |
| **Path-style addresses** | On for most compatible services, off for Amazon-style host names |

If your provider offers versioning or object lock, switching it on protects backups from being deleted by someone who obtains the key.

### SFTP server

| Field | What to enter |
|---|---|
| **Server**, **Port** | The host name and port (22 unless told otherwise) |
| **Username** | The account to sign in as |
| **Password** | The account's password, or the passphrase of the private key |
| **Private key** | Optional. Paste the whole key, including the BEGIN and END lines |
| **Folder** | Where to keep backups. Created if missing |

The server's key fingerprint is remembered when the connection is tested and shown on the destination. If the server later presents a different key, nothing is sent until you select **Test connection** and so accept the new key.

### Credentials

Secret keys, passwords and private keys are encrypted before they are saved, never shown again, never sent back to your browser and never written to a log.

## Related

- [SCHEDULE-AND-RETENTION](SCHEDULE-AND-RETENTION.md) - how many backups each destination keeps.
- [ENCRYPTION](ENCRYPTION.md) - protect what is stored elsewhere.
- [TROUBLESHOOTING](TROUBLESHOOTING.md#an-upload-to-remote-storage-fails) - when an upload fails.
