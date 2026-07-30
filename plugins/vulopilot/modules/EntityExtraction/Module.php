<?php
/**
 * Module class file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\EntityExtraction;

use VuloPilot\Services\EntityExtractor;

defined( 'ABSPATH' ) || exit;

/**
 * VuloPilot EntityExtraction module.
 *
 * Unlike modules/Seo/Module.php (which genuinely gates scanner
 * registration) or modules/Geo/Module.php (a thin automation layer over
 * always-on core scanning), this module's own job is to make deactivating
 * it actually change EntityExtractor's output — that class has no
 * scanner/finding to gate through ScannerRegistry's usual category
 * mechanism, so it checks `VuloPilot()->modules->get_active_modules()`
 * directly instead (see its own docblock).
 *
 * This module's real, concrete job: bust EntityExtractor's 1-hour
 * transient cache on the real content-change events that would actually
 * affect its output (a post publishing/unpublishing changes People/
 * Services/Locations; a term being created/edited/deleted changes
 * Categories) — same "don't leave a stale cache up to an hour after a
 * real, known change" care `RobotsTxtBotAccess`'s own cache doesn't
 * bother with (robots.txt changes are rare and external), but here the
 * triggering WordPress hooks are cheap and well-known.
 *
 * @class       Module class
 * @version     1.0.0
 * @author      VuloLabs
 */
class Module {

    /**
     * @var EntityExtractor
     */
    private EntityExtractor $extractor;

    /**
     * Module constructor.
     */
    public function __construct() {
        $this->extractor = new EntityExtractor();

        add_action( 'save_post', array( $this, 'clear_cache' ) );
        add_action( 'deleted_post', array( $this, 'clear_cache' ) );
        add_action( 'created_term', array( $this, 'clear_cache' ) );
        add_action( 'edited_term', array( $this, 'clear_cache' ) );
        add_action( 'delete_term', array( $this, 'clear_cache' ) );
    }

    /**
     * @return void
     */
    public function clear_cache(): void {
        $this->extractor->clear_cache();
    }
}
