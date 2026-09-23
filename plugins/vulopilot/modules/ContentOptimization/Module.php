<?php
/**
 * Module class file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\ContentOptimization;

defined( 'ABSPATH' ) || exit;

/**
 * VuloPilot ContentOptimization module.
 *
 * Same genuinely-gated shape TechnicalSeo\Module already uses (not GeoAnalysis\Module's
 * always-on shape) - Content Intelligence's own new scanner
 * (ReadabilityScanner) is registered here via `vulopilot_scanner_sources`,
 * not in ScannerRegistry::get_default_scanner_classes(); deactivating this
 * module (Settings → Modules) stops it from producing new findings, the
 * same posture TechnicalSeo\Module's own docblock documents.
 *
 * This module deliberately does NOT re-register the existing `seo`-category
 * scanners (ThinContentScanner/DuplicateContentScanner/HeadingStructureScanner/
 * InternalLinkingScanner/OrphanPageScanner) it reads from
 * (CONTENT-INTELLIGENCE-MODULE.md's audit) - those already run under
 * TechnicalSeo\Module's own gate and stay there; recategorizing or re-registering
 * them here would be exactly the kind of duplicated-registration this
 * pass avoids.
 *
 * Same Module.php shape module-architecture.md documents, discovered by
 * VuloPilot's own free-plugin `modules/` source - no filter registration
 * needed since this module ships in Free itself.
 *
 * @class       Module class
 * @version     1.0.0
 * @author      VuloLabs
 */
class Module {

    /**
     * Module constructor.
     */
    public function __construct() {
        add_filter( 'vulopilot_scanner_sources', array( $this, 'register_scanners' ) );
    }

    /**
     * @param string[] $scanners Already-registered scanner classes.
     * @return string[]
     */
    public function register_scanners( array $scanners ): array {
        return array_merge(
            $scanners,
            array(
                Scanners\ReadabilityScanner::class,
            )
        );
    }
}
