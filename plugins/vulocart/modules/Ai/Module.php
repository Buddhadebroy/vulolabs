<?php
/**
 * Module class file.
 *
 * @package VuloCart
 */

namespace VuloCart\Ai;

use VuloCart\AI\AiClient;
use VuloCart\AI\AiUsageLogUtil;
use VuloCart\AI\ConnectBrokerCallbackHandler;
use VuloCart\AI\VuloCloudConnection;

defined( 'ABSPATH' ) || exit;

/**
 * AI module: connects the store to VuloCloud AI and records AI usage.
 *
 * AI requests run on the VuloCloud account the site is connected to (Settings → Integrations); there is no provider or
 * API key to enter in the store. Turning the module on:
 *
 * 1. makes `VuloCart()->ai_client` available to the AI features of vulocart-pro (Catalog AI, Checkout AI, Support AI, Vector Search);
 * 2. registers the connection routes and the connect callback;
 * 3. creates the `vulocart_ai_usage_log` table (see Install.php).
 *
 * @class       Module class
 * @version     2.0.0
 * @author      VuloLabs
 */
class Module {

	/**
	 * Creates the usage log table, the VuloCloud connection and its callback handler, the AI routes and
	 * `VuloCart()->ai_client`.
	 */
	public function __construct() {
		new Install();
		new ConnectBrokerCallbackHandler();

		$connection = new VuloCloudConnection();
		$usage_log  = new AiUsageLogUtil();

		new Rest( $connection, $usage_log );

		VuloCart()->ai_client = new AiClient( $connection, $usage_log );
	}
}
