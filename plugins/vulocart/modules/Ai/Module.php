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
 * VuloCart Ai module class.
 *
 * Same toggleable-addon shape as VuloCart\Cart\Module/VuloCart\Order\Module
 * (module-architecture.md). AI is served by VuloCloud: the site connects to
 * its VuloCloud account once (Settings → Integrations) and requests run
 * on the connected Organization's key and credits - there is no provider or
 * API key to configure here. This module's real effect:
 *
 * 1. Making "AI" a real, toggleable entry on the Modules page - activating
 *    it is what makes `AiClient` resolvable at all (the same
 *    `VuloCart()->ai_client` magic-property pattern `Shipping\Module`/
 *    `Taxes\Module` use for their own services), so
 *    `Order\Application\OrderService::resolve_optional_service()`'s
 *    "gracefully absent" pattern is how a Pro AI feature module reaches it.
 * 2. Registering the connection routes (Rest.php) and the connect-broker
 *    callback.
 * 3. Owning `vulocart_ai_usage_log` (Install.php).
 *
 * `vulocart-pro`'s CatalogAi/CheckoutAi/SupportAi/VectorSearch modules are
 * the Pro-gated features built on top of this.
 *
 * @class       Module class
 * @version     2.0.0
 * @author      VuloLabs
 */
class Module {

	/**
	 * Module constructor.
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
