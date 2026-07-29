# Environment setup & new-plugin bootstrap recipe

## Scaffolding a new plugin's composer.json

```
1. composer init \
  --name="vulolabs/plugin_name" \
  --description="..." \
  --author="VuloLabs <contact@vulolabs.com>" \
  --type="wordpress-plugin" \
  --homepage="https://vulolabs.com" \
  --stability="dev" \
  --license="GPL-2.0-or-later"

2. Add the autoloader manually:
   "autoload": {
       "psr-4": {
           "PluginNamespace\\": "classes/"
       }
   }

3. composer dump-autoload
4. composer config platform.php 8.0
5. composer require php

6. composer require --dev wp-coding-standards/wpcs:dev-develop
7. composer require --dev dealerdirect/phpcodesniffer-composer-installer:^1.0
8. composer require --dev phpcompatibility/phpcompatibility-wp:dev-master

   Add to composer.json:
   "scripts": {
       "phpcs":  "vendor/bin/phpcs . --standard=../../phpcs.xml.dist -p -s",
       "phpfix": "vendor/bin/phpcbf . --standard=../../phpcs.xml.dist -p"
   }

9.  composer require --dev phpunit/phpunit:9.6.x-dev
10. composer require --dev wp-phpunit/wp-phpunit:dev-master
11. composer require --dev yoast/phpunit-polyfills:^4.0@dev
12. composer require --dev brain/monkey:^2.0@dev

13. wp scaffold plugin-tests <slug>
    (generates bin/install-wp-tests.sh, tests/bootstrap.php, tests/test-sample.php)

14. bash bin/install-wp-tests.sh wordpress_test root '' localhost latest
15. ./vendor/bin/phpunit   (or: pnpm run test)
```

This covers only the Composer/PHPUnit side. Wiring the new plugin into `pnpm-workspace.yaml` (already covered — it's `plugins/*`), the release workflow's choice list, and the `package.json` script set is easiest by copying an existing plugin's `package.json`/`webpack.config.js`/`.wp-env.json` as a template rather than hand-rolling it.

## PHPUnit bootstrap template

`tests/php/bootstrap.php` (adjust the constant names/text domain/main file per plugin):

```php
<?php
/**
 * PHPUnit bootstrap file.
 *
 * @package PluginNamespace
 */

define( 'PLUGIN_DIR', dirname( __DIR__, 2 ) );
define( 'TEST_WC_DIR', dirname( PLUGIN_DIR, 3 ) . '/woocommerce' );

$_tests_dir = getenv( 'WP_TESTS_DIR' );

if ( ! $_tests_dir ) {
	$_tests_dir = rtrim( sys_get_temp_dir(), '/\\' ) . '/wordpress-tests-lib';
}

$_phpunit_polyfills_path = getenv( 'WP_TESTS_PHPUNIT_POLYFILLS_PATH' );
if ( false !== $_phpunit_polyfills_path ) {
	define( 'WP_TESTS_PHPUNIT_POLYFILLS_PATH', $_phpunit_polyfills_path );
}

if ( ! file_exists( "{$_tests_dir}/includes/functions.php" ) ) {
	echo "Could not find {$_tests_dir}/includes/functions.php, have you run bin/install-wp-tests.sh ?" . PHP_EOL;
	exit( 1 );
}

require_once "{$_tests_dir}/includes/functions.php";

function _manually_load_plugin() {
	require PLUGIN_DIR . '/plugin-main-file.php';
}
tests_add_filter( 'muplugins_loaded', '_manually_load_plugin' );

require "{$_tests_dir}/includes/bootstrap.php";
```

`tests/php/phpunit-wp-config.php`:

```php
<?php

$wordpress_dir = dirname( __DIR__, 2 ) . '/wordpress/';
if ( ! is_dir( $wordpress_dir ) ) {
	$wordpress_dir = dirname( __DIR__, 5 ) . '/';
}

define( 'ABSPATH', $wordpress_dir );
define( 'WP_DEFAULT_THEME', 'default' );
define( 'WP_DEBUG', true );
define( 'WP_DEBUG_LOG', true );

define( 'DB_NAME', getenv( 'WP_DB_NAME' ) ?: 'wordpress_test' );
define( 'DB_USER', getenv( 'WP_DB_USER' ) ?: 'root' );
define( 'DB_PASSWORD', getenv( 'WP_DB_PASS' ) ?: '' );
define( 'DB_HOST', 'localhost' );
define( 'DB_CHARSET', 'utf8' );
define( 'DB_COLLATE', '' );

$table_prefix = 'unit_';

define( 'WP_TESTS_DOMAIN', 'example.org' );
define( 'WP_TESTS_EMAIL', 'admin@example.org' );
define( 'WP_TESTS_TITLE', 'Test Blog' );
define( 'WP_PHP_BINARY', 'php' );
define( 'WPLANG', '' );
```
