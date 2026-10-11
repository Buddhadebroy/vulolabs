# Hooks and constants

Wait for `vulobackup_loaded` before using any of this.

## Actions

| Action | Arguments | When |
|---|---|---|
| `vulobackup_loaded` | none | Services are ready |
| `vulobackup_after_installed` | none | First run, or the version changed |
| `vulobackup_backup_completed` | `$job` | A backup completed and was verified |
| `vulobackup_backup_failed` | `$job` | A backup failed |
| `vulobackup_restore_completed` | `$job` | A restore completed |
| `vulobackup_restore_failed` | `$job` | A restore failed |

```php
add_action( 'vulobackup_backup_failed', function ( $job ) {
	my_alerting_send( 'Backup failed: ' . $job['error'] );
} );
```

`$job` is the job record ([DATABASE](DATABASE.md#jobjson)). Treat it as read-only.

## Filters

| Filter | Value | Use |
|---|---|---|
| `vulobackup_storage_providers` | `Storage\Provider[]` | Add a remote storage provider ([STORAGE](STORAGE.md#6-adding-a-provider)) |
| `vulobackup_exclusions` | `string[]` | Change the paths left out of file backups |
| `vulobackup_rest_controllers` | `WP_REST_Controller[]` | Add REST controllers. Give every route a `permission_callback` |
| `vulobackup_submenus` | array | Add an entry to the admin menu. The screen behind it needs its own script |
| `vulobackup_http_timeout` | seconds | Timeout of storage HTTP requests (120) |
| `vulobackup_sftp_timeout` | seconds | SFTP connection timeout (20) |
| `vulobackup_allow_insecure_storage` | bool | Accept `http://` storage endpoints. For local testing only |

```php
add_filter( 'vulobackup_exclusions', function ( $patterns ) {
	$patterns[] = 'uploads/private-exports/**';
	return $patterns;
} );
```

## Scheduled hooks

| Hook | Schedule | Does |
|---|---|---|
| `vulobackup_run` | single events | One slice of the running backup |
| `vulobackup_schedule_check` | hourly | Starts a scheduled backup when one is due |
| `vulobackup_watchdog` | every five minutes | Re-queues a backup with no event; tidies up after restores; daily housekeeping |

## Constants

| Constant | Where | Use |
|---|---|---|
| `VULOBACKUP_DIR` | `wp-config.php` | The backup folder. Overrides the setting |
| `VULOBACKUP_ENCRYPTION_KEY` | `wp-config.php` | Replaces `wp_salt( 'auth' )` as the secret half of the key that encrypts stored credentials |
| `VULOBACKUP_PLUGIN_VERSION`, `VULOBACKUP_FORMAT_VERSION` | `config.php` | Plugin and backup format versions |

## Starting a backup from code

```php
$job = VuloBackup()->runner->start_backup( array( 'type' => 'database', 'name' => 'Before import' ) );

if ( is_wp_error( $job ) ) {
	// 'vulobackup_busy' when a backup or restore is already running.
}
```

The backup then proceeds on WP-Cron. There is no supported way to start a restore from code: a restore needs an administrator's confirmation.
