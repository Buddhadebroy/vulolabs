# Integration tests

These scripts run inside a real WordPress site. They change and restore that site's database and files, so **only run them on a throwaway site**.

```bash
docker compose -f services.compose.yml up -d                    # MariaDB :33077, MinIO :9077, SFTP :2277
# Create a WordPress site that uses the database, activate VuloBackup, then:
wp eval-file seed.php
wp eval-file 1-backup.php
wp eval-file 2-restore.php
wp eval-file 3-slices-corruption-encryption.php
wp eval-file 5-forged-archives.php
wp eval-file 6-remote-storage.php          # needs the bucket "vb-test" and the mu-plugin below
wp eval-file 7-permissions-schedule-lifecycle.php
wp eval-file 4a-export-bundle.php          # then, on a second site with another URL and prefix:
wp eval-file 4b-migrate-on-second-site.php
wp eval-file 8-packaged-plugin.php         # on a site where the release zip is installed (not a symlink)
```

Each check prints `PASS` or `FAIL`.

For `6-remote-storage.php` the site must be allowed to reach the local containers. Add this as a must-use plugin on the test site only:

```php
add_filter( 'vulobackup_allow_insecure_storage', '__return_true' );
add_filter( 'http_request_host_is_external', fn( $external, $host ) => '127.0.0.1' === $host ? true : $external, 10, 2 );
add_filter( 'http_allowed_safe_ports', fn( $ports ) => array_merge( $ports, array( 9077 ) ) );
```
