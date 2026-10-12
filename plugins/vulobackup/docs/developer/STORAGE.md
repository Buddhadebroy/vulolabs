# Storage

## 1. The backup folder

`Storage\Vault` owns the folder on this server.

| Method | Does |
|---|---|
| `base()` | The folder in use: `VULOBACKUP_DIR`, else the `backup_dir` setting when usable, else `default_dir()` |
| `default_dir()` | `wp-content/vulobackup-{token}`; the 20-hex-character token is the `vulobackup_dir_token` option |
| `dir_problem( $path )` | Why a folder cannot be used, or null. Refuses relative paths, anything inside plugins, themes, uploads, mu-plugins, wp-admin or wp-includes, and folders that are not writable |
| `ensure()` | Creates the folder and `backups/`, `restores/`, `tmp/`, `logs/`, and the protection files |
| `protect( $dir )` | Writes `.htaccess`, `web.config`, `index.php` and the marker `.vulobackup-private` |
| `is_in_web_root()` | Whether it is under `ABSPATH` or the document root |
| `free_space()` | Bytes free, or null when the host does not say |
| `clean_tmp()` | Removes temporary files older than a day |

Layout of the folder is in [DATABASE](DATABASE.md#2-files).

A file backup never includes a folder holding the marker, so backups are never backed up.

## 2. Destinations

`Storage\Destinations` stores the remote destinations in the `vulobackup_destinations` option: `id`, `provider`, `name`, `enabled`, `config`, `checked_at`, `ok`, `message`. At most five.

| Method | Does |
|---|---|
| `providers()`, `provider( $id )`, `definitions()` | The registered providers |
| `all()`, `get( $id )`, `enabled()` | Destinations with secrets decrypted. Server-side only |
| `for_browser( $destination )` | Without secret values; `has_secret` says which are set |
| `save( $input )` | Sanitizes by field type, runs `Provider::test()`, and saves only if it passes. An empty secret keeps the stored one |
| `retest( $id )`, `mark( $id, $ok, $message )` | Record a connection result |
| `set_enabled()`, `delete()` | |
| `secret_values()` | For `Logger::hide()` |

Fields marked `secret` are encrypted with `Security\Secrets` before `update_option()` and never leave the server.

At a destination a backup's files are `{backup id}/{file name}` under the destination's own folder.

## 3. The provider interface

`Storage\Provider`. The backup engine, the verifier, retention and the restore engine only talk to this.

| Method | Contract |
|---|---|
| `id()`, `label()` | Machine name and display name |
| `fields()` | The settings form: `key`, `label`, `type` (`text`, `number`, `password`, `textarea`, `toggle`), and optionally `secret`, `required`, `placeholder`, `help`, `default` |
| `test( $config )` | Really write, read back and delete. Returns values to merge into the stored config, or `WP_Error` |
| `describe( $config )` | One line saying where it is, with no secret |
| `upload( $config, $local, $remote, &$state, $deadline )` | True when done, false when there is more to do (state updated), or `WP_Error` |
| `verify( $config, $remote, $bytes )` | True when the object exists at that size |
| `download( $config, $remote, $local, $bytes, &$state, $deadline )` | As `upload` |
| `delete( $config, $remote )` | A file already gone is not an error |
| `abort( $config, $remote, $state )` | Release an unfinished upload |

Errors must be safe to show: no credentials, no signed URLs.

## 4. S3

`Storage\Providers\S3` signs requests with AWS Signature Version 4 itself and sends them with `wp_safe_remote_request()`; no SDK is bundled.

- **Addressing.** No endpoint means Amazon (`{bucket}.s3.{region}.amazonaws.com`). With an endpoint, path-style (`{endpoint}/{bucket}/key`) or bucket-in-host.
- **Endpoint rules** (`config_problem()`): `https://`, a bare host, no credentials, path, query or fragment. `http://` only when `vulobackup_allow_insecure_storage` returns true.
- **Uploads.** Up to 8 MiB in one `PUT`. Larger files use multipart upload with 8 MiB parts (larger for very big files, never more than 9000 parts). State is the upload id and the ETags so far. `NoSuchUpload` restarts the upload.
- **Integrity.** Every request carries the SHA-256 of its body in the signature, so the service rejects a damaged part. `verify()` is a `HEAD` and a size comparison.
- **Downloads** use `Range` requests of 8 MiB.
- Redirects are never followed.

## 5. SFTP

`Storage\Providers\Sftp` uses phpseclib 3.

- **Host key.** `test()` returns the server key's SHA-256 fingerprint, which is stored in the config. Every other operation refuses to proceed unless the server presents that key (`vulobackup_storage_hostkey`).
- **Sign-in.** Password, or a private key with the password field as its passphrase.
- **Transfers.** 2 MiB chunks written at an offset, so an upload resumes; the state is the offset.
- **Verify.** `stat()` size only. SFTP has no checksum.

## 6. Adding a provider

```php
add_filter( 'vulobackup_storage_providers', function ( $providers ) {
	$providers[] = new My_Provider(); // implements VuloBackup\Storage\Provider
	return $providers;
} );
```

The admin form is generated from `fields()`; no JavaScript is needed. Mark every credential `secret`. Make `test()` a real round trip, and make `verify()` confirm the object rather than assume it.
