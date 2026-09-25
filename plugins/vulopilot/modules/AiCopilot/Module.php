<?php
/**
 * Module class file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\AiCopilot;

defined( 'ABSPATH' ) || exit;

/**
 * VuloPilot AiCopilot module.
 *
 * This module ships no behavior of its own beyond existing as a real,
 * toggleable id - same "id is the product, not the code" shape a whole
 * module can have, matching how modules/GeoAnalysis/Module.php's own docblock
 * describes GEO scanning staying core/always-on and the module itself
 * only governing one narrow piece of optional behavior; here even that
 * narrow piece lives in Copilot.php/the React gate, not in this class.
 *
 * @class       Module class
 * @version     1.0.0
 * @author      VuloLabs
 */
class Module {

    /**
     * Module constructor.
     *
     * Intentionally empty - see class docblock.
     */
    public function __construct() {}
}
