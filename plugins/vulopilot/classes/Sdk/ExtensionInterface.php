<?php
/**
 * ExtensionInterface file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\Sdk;

defined( 'ABSPATH' ) || exit;

/**
 * @class       ExtensionInterface interface
 * @version     1.0.0
 * @author      VuloLabs
 */
interface ExtensionInterface {

	/**
	 * @return string Unique, stable extension id.
	 */
	public function get_id(): string;

	/**
	 * @return string Human-readable name.
	 */
	public function get_name(): string;

	/**
	 * @return string This extension's own version, e.g. '1.2.0'.
	 */
	public function get_version(): string;

	/**
	 * @return string Lowest core VuloPilot version this extension is known to work against, e.g. '1.1.0'.
	 */
	public function get_minimum_vulopilot_version(): string;

	/**
	 * Called once, only after ExtensionManager has confirmed
	 * get_minimum_vulopilot_version() is satisfied by the running core
	 * version - everything this extension does (registering scanners,
	 * rules, automation triggers/actions, report types/exporters,
	 * REST controllers, CLI commands) happens here or in
	 * classes this method wires up.
	 *
	 * @return void
	 */
	public function register(): void;
}
