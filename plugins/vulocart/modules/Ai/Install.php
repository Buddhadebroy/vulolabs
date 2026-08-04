<?php
/**
 * Install class file.
 *
 * @package VuloCart
 */

namespace VuloCart\Ai;

defined( 'ABSPATH' ) || exit;

/**
 * VuloCart Ai module Install class — owns `vulocart_ai_provider_configs`
 * (one row per BYOK provider, `credentials` always encrypted,
 * classes/AI/Services/CredentialEncryption.php) and `vulocart_ai_usage_log`
 * (insert-only call log, classes/AI/AiUsageLogUtil.php). Same
 * version-gated dbDelta shape as vulocart-pro's own module Install
 * classes (ShippingEngine\Install's own docblock).
 *
 * @class       Install class
 * @version     1.0.0
 * @author      VuloLabs
 */
class Install {

	const TABLE_SCHEMA_VERSION_OPTION = 'vulocart_ai_table_version';

	const TABLE_SCHEMA_VERSION = '1.0.0';

	public function __construct() {
		add_action( 'vulocart_activated_module_ai', array( $this, 'maybe_create_tables' ) );
	}

	/**
	 * @return void
	 */
	public function maybe_create_tables(): void {
		if ( get_option( self::TABLE_SCHEMA_VERSION_OPTION ) === self::TABLE_SCHEMA_VERSION ) {
			return;
		}

		global $wpdb;

		if ( ! function_exists( 'dbDelta' ) ) {
			require_once ABSPATH . 'wp-admin/includes/upgrade.php';
		}

		$collate = $wpdb->get_charset_collate();

		dbDelta(
			"CREATE TABLE `{$wpdb->prefix}vulocart_ai_provider_configs` (
				`id`          bigint(20) unsigned NOT NULL AUTO_INCREMENT,
				`provider`    varchar(50) NOT NULL,
				`credentials` longtext NOT NULL,
				`model`       varchar(100) NOT NULL DEFAULT '',
				`is_active`   tinyint(1) NOT NULL DEFAULT 0,
				`created_at`  timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
				`updated_at`  timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
				PRIMARY KEY (`id`),
				UNIQUE KEY `idx_provider` (`provider`)
			) $collate;"
		);

		dbDelta(
			"CREATE TABLE `{$wpdb->prefix}vulocart_ai_usage_log` (
				`id`                 bigint(20) unsigned NOT NULL AUTO_INCREMENT,
				`provider`           varchar(50) NOT NULL,
				`model`              varchar(100) NOT NULL DEFAULT '',
				`feature`            varchar(100) NOT NULL,
				`prompt_tokens`      int(11) NOT NULL DEFAULT 0,
				`completion_tokens`  int(11) NOT NULL DEFAULT 0,
				`success`            tinyint(1) NOT NULL DEFAULT 1,
				`error_message`      text DEFAULT NULL,
				`created_at`         timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
				PRIMARY KEY (`id`),
				KEY `idx_feature` (`feature`)
			) $collate;"
		);

		update_option( self::TABLE_SCHEMA_VERSION_OPTION, self::TABLE_SCHEMA_VERSION );
	}
}
