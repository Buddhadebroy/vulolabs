<?php
/**
 * ScannerRegistry class file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\Utill;

use VuloPilot\GeoAnalysis\Scanners as GeoScanners;
use VuloPilot\Utill as UtillHelper;

defined( 'ABSPATH' ) || exit;

/**
 * VuloPilot ScannerRegistry class.
 *
 * @class       ScannerRegistry class
 * @version     1.0.0
 * @author      VuloLabs
 */
class ScannerRegistry {

    /**
     * Instantiated scanners, keyed by their own get_id().
     *
     * @var array<string, ScannerInterface>
     */
    private array $scanners = array();

    /**
     * ScannerRegistry constructor.
     */
    public function __construct() {
        add_action( 'init', array( $this, 'register_scanners' ), 20 );
    }

    /**
     * Instantiates every registered scanner class and indexes it by id.
     * A scanner class that doesn't exist, or doesn't implement
     * ScannerInterface, is silently skipped rather than fataling the
     * whole registry - one broken third-party registration shouldn't take
     * every other scanner down with it.
     *
     * @return void
     */
    public function register_scanners(): void {
        $scanner_classes     = apply_filters( 'vulopilot_scanner_sources', $this->get_default_scanner_classes() );
        $disabled_categories = $this->get_disabled_categories();

        foreach ( $scanner_classes as $scanner_class ) {
            if ( ! is_string( $scanner_class ) || ! class_exists( $scanner_class ) ) {
                continue;
            }

            $scanner = new $scanner_class();

            if ( ! $scanner instanceof ScannerInterface ) {
                continue;
            }

            if ( in_array( $scanner->get_category(), $disabled_categories, true ) ) {
                continue;
            }

            $this->scanners[ $scanner->get_id() ] = $scanner;
        }
    }

    /**
     * @return string[] Category strings currently disabled via settings.
     */
    private function get_disabled_categories(): array {
        $settings = wp_parse_args( get_option( UtillHelper::VULOPILOT_SETTINGS_KEY, array() ), UtillHelper::VULOPILOT_SETTINGS_DEFAULTS );

        $toggle_to_category = array(
            'enable_accessibility_scanning' => 'accessibility',
            'enable_woocommerce_scanning'   => 'woocommerce',
        );

        $disabled = array();

        foreach ( $toggle_to_category as $setting_key => $category ) {
            if ( empty( $settings[ $setting_key ] ) ) {
                $disabled[] = $category;
            }
        }

        return $disabled;
    }

    /**
     * @return string[] Fully-qualified class names implementing ScannerInterface.
     */
    private function get_default_scanner_classes(): array {
        return array(
            \VuloPilot\Performance\PerformanceScanner::class,
            \VuloPilot\SiteHealth\DatabaseScanner::class,
            \VuloPilot\Accessibility\AccessibilityScanner::class,
            \VuloPilot\SiteHealth\PluginsScanner::class,
            \VuloPilot\SiteHealth\ThemesScanner::class,
            \VuloPilot\SiteHealth\UpdatesScanner::class,
            \VuloPilot\SiteHealth\CronScanner::class,
            \VuloPilot\Security\WeakPasswordScanner::class,
            \VuloPilot\Security\BasicVulnerabilitiesScanner::class,
            \VuloPilot\Security\CoreFileIntegrityScanner::class,
            // Protect My Site's Malware/Login Protection/Firewall/Backups
            // tiles - real, always-on core features (Services\*Guard/
            // BackupManager), each with its own lightweight companion
            // Scanner here so it slots into the same real findings/scans/
            // SecurityMetricsGrid machinery every other tile above already
            // uses. Same category 'security', same granular per-scanner
            // toggle posture.
            \VuloPilot\Security\MalwareScanner::class,
            \VuloPilot\Security\LoginProtectionScanner::class,
            \VuloPilot\Security\FirewallScanner::class,
            \VuloPilot\SiteHealth\BackupHealthScanner::class,
            // GEO module (GEO-MODULE.md) - 9 deterministic checks, category 'geo'.
            GeoScanners\GeoAuthorInfoScanner::class,
            GeoScanners\GeoEeatSignalsScanner::class,
            GeoScanners\GeoTrustSignalsScanner::class,
            GeoScanners\GeoCitationOpportunityScanner::class,
            GeoScanners\GeoSummaryBlockScanner::class,
            GeoScanners\GeoFaqOpportunityScanner::class,
            GeoScanners\GeoChunkingScanner::class,
            GeoScanners\GeoSemanticStructureScanner::class,
            GeoScanners\GeoEntityNamingConsistencyScanner::class,
            // AEO (Answer Engine Optimization) - AI-VISIBILITY-MODULE.md's
            // one new deterministic check: FAQ/HowTo-shaped content missing
            // its matching schema.org markup. Same 'geo' category, no
            // separate category/kill switch, same as the 9 above.
            \VuloPilot\SeoVisibility\AeoSchemaScanner::class,
            \VuloPilot\Security\SslMonitoringScanner::class,
            \VuloPilot\Content\RedirectAnalysisScanner::class,
            \VuloPilot\Content\NotFoundScanner::class,
            \VuloPilot\SiteHealth\PhpWarningScanner::class,
            \VuloPilot\SiteHealth\SiteAvailabilityScanner::class,
            // Website Performance (readme) - category 'performance', joins
            // the original PerformanceScanner (autoload bloat).
            \VuloPilot\Performance\SlowPageScanner::class,
            \VuloPilot\Performance\LargeImagesScanner::class,
            \VuloPilot\SiteHealth\HeavyPluginsScanner::class,
            \VuloPilot\Performance\CacheDetectionScanner::class,
            // "Performance" Overview's MetricsGrid tiles - CSS/JavaScript
            // Optimization, Fonts, Lazy Loading, CDN, Database Cleanup.
            \VuloPilot\Performance\CssOptimizationScanner::class,
            \VuloPilot\Performance\JavaScriptOptimizationScanner::class,
            \VuloPilot\Performance\FontsScanner::class,
            \VuloPilot\Performance\LazyLoadingScanner::class,
            \VuloPilot\Performance\CdnScanner::class,
            \VuloPilot\SiteHealth\DatabaseCleanupScanner::class,
            \VuloPilot\Performance\ImageCleanupScanner::class,
            // Accessibility Scanner (readme) - category 'accessibility',
            // joins the original AccessibilityScanner (duplicate <h1>).
            \VuloPilot\Accessibility\FormLabelsScanner::class,
            \VuloPilot\Accessibility\AriaAttributesScanner::class,
            // "WCAG Scanner" (ACCESSIBILITY-MODULE.md) - category
            // 'accessibility', joins the four above. Phase 8's other four
            // Free bullets (Missing Alt, Labels, Heading Hierarchy, ARIA
            // Detection) are already fully satisfied by pre-existing
            // scanners (ImagesScanner/category 'images',
            // FormLabelsScanner, GeoSemanticStructureScanner/category
            // 'geo', AriaAttributesScanner respectively) - see
            // ACCESSIBILITY-MODULE.md's audit table for why none of those
            // four needed new code.
            \VuloPilot\Accessibility\WcagScanner::class,
            // "Keyboard & Assistive Technology" (PROTECT-MY-SITE.md) -
            // category 'accessibility', joins the five above. Positive
            // tabindex is the one keyboard/focus-order issue a static
            // content scan can actually detect - see this scanner's own
            // docblock for why a fuller keyboard-trap/focus-visible audit
            // isn't attempted.
            \VuloPilot\Accessibility\KeyboardAccessibilityScanner::class,
            // "Site Health"'s WordPress/Server sections (PROTECT-MY-SITE.md)
            // - two new categories ('wordpress', 'server'), both thin
            // wrappers around WordPress core's own WP_Site_Health tests
            // rather than new checks - see each scanner's own docblock.
            \VuloPilot\SiteHealth\WordPressHealthScanner::class,
            \VuloPilot\SiteHealth\ServerHealthScanner::class,
        );
    }

    /**
     * @param string $scanner_id A scanner's get_id().
     * @return ScannerInterface|null
     */
    public function get_scanner( string $scanner_id ): ?ScannerInterface {
        return $this->scanners[ $scanner_id ] ?? null;
    }

    /**
     * @return array<string, ScannerInterface>
     */
    public function get_all_scanners(): array {
        return $this->scanners;
    }

    /**
     * @param string $category e.g. 'seo', 'security'.
     * @return array<string, ScannerInterface>
     */
    public function get_scanners_by_category( string $category ): array {
        return array_filter(
            $this->scanners,
            static fn( ScannerInterface $scanner ) => $scanner->get_category() === $category
        );
    }

    /**
     * Every registered scanner except those in the given categories -
     * lets a caller that already covers some categories on their own
     * (e.g. Automations\Scheduler's global tick deferring to
     * SecurityScanScheduler/AccessibilityAuditScheduler's own independent
     * cadence, see that class's own docblock) skip re-running them.
     *
     * @param string[] $excluded_categories Category strings to leave out.
     * @return array<string, ScannerInterface>
     */
    public function get_all_scanners_except( array $excluded_categories ): array {
        return array_filter(
            $this->scanners,
            static fn( ScannerInterface $scanner ) => ! in_array( $scanner->get_category(), $excluded_categories, true )
        );
    }
}
