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
 * The master free/paid AI gate: `Copilot.php`'s `/copilot/chat` endpoint
 * and every AI-branded card across the plugin (suggestions, "Fix with AI"
 * actions, the AI Assistant Chat tab) check
 * `VuloPilot()->modules->is_active( 'ai-copilot' )` — directly server-side
 * in Copilot.php's own permission callback, and client-side via
 * `active_modules.includes('ai-copilot')` (see `useAiCopilotEnabled()`) —
 * rather than each AI surface inventing its own ad-hoc check. Pro's
 * `one-click-fix` module is unchanged and stays the inner gate for the
 * advanced "one-click auto-apply" tier; this module only controls whether
 * baseline (manual, bring-your-own-key) AI functionality is reachable at
 * all, same as modules/EntityExtraction/Module.php reading
 * `get_active_modules()` directly rather than gating a scanner category.
 *
 * This module ships no behavior of its own beyond existing as a real,
 * toggleable id — same "id is the product, not the code" shape a whole
 * module can have, matching how modules/Geo/Module.php's own docblock
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
     * Intentionally empty — see class docblock.
     */
    public function __construct() {}
}
