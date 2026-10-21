<?php
/**
 * Module class file.
 *
 * @package VuloCart
 */

namespace VuloCart\Mcp;

defined( 'ABSPATH' ) || exit;

/**
 * MCP module: the on/off switch for the store's MCP (Model Context Protocol) server.
 *
 * The server itself is provided by vulocart-pro's McpServer module, which switches on and off with this one. Turning
 * this module on unlocks the "MCP API key" field in Settings → MCP.
 *
 * @class       Module class
 * @version     1.0.0
 * @author      VuloLabs
 */
class Module {

    /**
     * Nothing to construct: this module is only an on/off switch.
     */
    public function __construct() {}
}
