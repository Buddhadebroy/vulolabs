<?php
/**
 * Module class file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\TechnicalSeo;

defined( 'ABSPATH' ) || exit;

/**
 * VuloPilot TechnicalSeo module.
 *
 * Same Module.php shape module-architecture.md documents, discovered by
 * VuloPilot's own free-plugin `modules/` source (Modules::get_all_modules()'s
 * default, self-registered `VuloPilot` namespace) - no filter registration
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
                Scanners\SeoScanner::class,
                Scanners\SchemaScanner::class,
                Scanners\ImagesScanner::class,
                Scanners\BrokenLinksScanner::class,
                Scanners\BrokenImagesScanner::class,
                Scanners\MetaDescriptionScanner::class,
                Scanners\CanonicalUrlScanner::class,
                Scanners\InternalLinkingScanner::class,
                Scanners\HeadingStructureScanner::class,
                Scanners\ThinContentScanner::class,
                Scanners\DuplicateContentScanner::class,
                Scanners\SitemapScanner::class,
                Scanners\RobotsTxtScanner::class,
                Scanners\OpenGraphScanner::class,
                Scanners\TwitterCardScanner::class,
                Scanners\OrphanPageScanner::class,
                Scanners\SeoImagesScanner::class,
                Scanners\StructuredDataValidationScanner::class,
                // AI Crawler Analytics (AI-CRAWLER-ANALYTICS-MODULE.md) -
                // "Blocked Pages," the one genuinely new Free scanner that
                // pass adds. Registered here (not ScannerRegistry's core
                // list) since it's a real robots.txt/SEO check, same
                // category and module home as RobotsTxtScanner above.
                Scanners\AiCrawlerBlockedPagesScanner::class,
            )
        );
    }
}
