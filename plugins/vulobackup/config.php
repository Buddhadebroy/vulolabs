<?php
/**
 * VuloBackup config file.
 *
 * @package VuloBackup
 */

defined( 'ABSPATH' ) || exit;

define( 'VULOBACKUP_PLUGIN_TEXTDOMAIN', 'vulobackup' );
define( 'VULOBACKUP_PLUGIN_VERSION', '1.0.0' );
define( 'VULOBACKUP_PLUGIN_SLUG', 'vulobackup' );
define( 'VULOBACKUP_PLUGIN_NAME', 'VuloBackup' );

// Version of the backup format (manifest, SQL dump dialect, archive layout). A backup made by a
// newer format than this is refused on restore; see docs/developer/BACKUP-FORMAT.md.
define( 'VULOBACKUP_FORMAT_VERSION', 1 );
