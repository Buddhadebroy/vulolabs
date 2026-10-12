<?php
/**
 * VuloForm config file.
 *
 * @package VuloForm
 */

defined( 'ABSPATH' ) || exit;

define( 'VULOFORM_PLUGIN_TEXTDOMAIN', 'vuloform' );
define( 'VULOFORM_PLUGIN_VERSION', '1.0.0' );
define( 'VULOFORM_PLUGIN_SLUG', 'vuloform' );
define( 'VULOFORM_PLUGIN_NAME', 'VuloForm' );

// Version of the stored form schema (Forms\Schema). Bumped when its shape changes; older forms are
// upgraded on read by Forms\Schema::upgrade().
define( 'VULOFORM_SCHEMA_VERSION', 1 );
