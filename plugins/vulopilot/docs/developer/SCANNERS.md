# Scanners and Findings

Scanners inspect the site and return **findings**. Findings are stored, scored and shown across the admin. This is the core data pipeline of the plugin.

```
ScannerRegistry (default list + filter)  ->  ScanRunner::run*()  ->  Scanner::scan(): Finding[]
      -> ScanResult -> do_action('vulopilot_scan_completed')
      -> ScanPersistenceListener (tables vulopilot_scans, vulopilot_scan_findings) -> do_action('vulopilot_scan_persisted')
      -> RuleEngine (see RULE-ENGINE.md)
```

## Contract

`VuloPilot\Utill\ScannerInterface`:

| Method | Returns |
|---|---|
| `get_id()` | Unique, stable scanner id (kebab-case) |
| `get_label()` | Human-readable label |
| `get_category()` | Category the findings belong to (`seo`, `geo`, `security`, `performance`, ...) |
| `get_tier()` | `'free'` or `'pro'` (the base class returns `'free'`) |
| `scan()` | `Finding[]` |

Extend `Utill\ScannerUtil` to get the tier default. Optional interfaces:

- `SupportsForceRunInterface` - a scanner that caches results can be told to ignore its cache (`ScanRunner::run( $id, true )`).
- `TracksScannedObjectsInterface` - a scanner reports which post ids it looked at (`get_scanned_post_ids()`); use the `ScannedPostsTrait` helper.

## Finding

`VuloPilot\Utill\Finding` is a value object: `title`, `severity`, `category`, `description`, `object_type`, `object_ref`, `meta`, `dedupe_key`. Severity constants (`Utill\Severity`): `critical`, `high`, `medium`, `low`, `info`.

- `object_type` + `object_ref` say what the finding is about (post, URL, file, plugin slug).
- `dedupe_key` lets the persistence layer recognize the same problem across scans and update `last_seen_at` instead of inserting a duplicate.

Storage: [DATABASE](DATABASE.md) tables `vulopilot_scans` and `vulopilot_scan_findings`; repositories `ScanRepository`, `FindingRepository`.

## Registry

`ScannerRegistry` builds the list from `get_default_scanner_classes()`, passes it through the `vulopilot_scanner_sources` filter and instantiates each class that implements `ScannerInterface`. A scanner whose category is disabled is skipped: the setting `enable_accessibility_scanning` disables category `accessibility` and `enable_woocommerce_scanning` disables `woocommerce`.

Modules add their scanners through the same filter in their `Module.php` (see the module docs).

## Runner

`ScanRunner`:

| Method | Runs |
|---|---|
| `run( $scanner_id, $force = false )` | One scanner. Returns a `ScanResult` or `null` if the id is unknown |
| `run_all( $force = false )` | Every registered scanner |
| `run_category( $category, $force = false )` | Every scanner in a category |
| `run_all_except( array $excluded_categories, $force = false )` | Everything except some categories |

A scanner that throws is caught and produces a `ScanResult` with status `failed` and the error message; other scanners are not affected. Every result fires `vulopilot_scan_completed`.

## Add a scanner

```php
namespace MyPlugin;

use VuloPilot\Utill\ScannerUtil;
use VuloPilot\Utill\Finding;
use VuloPilot\Utill\Severity;

class MyScanner extends ScannerUtil {
    public function get_id(): string { return 'my-scanner'; }
    public function get_label(): string { return __( 'My scanner', 'my-plugin' ); }
    public function get_category(): string { return 'seo'; }

    public function scan(): array {
        return array(
            new Finding( 'Something is wrong', Severity::MEDIUM, $this->get_category(), 'Details', 'url', home_url() ),
        );
    }
}

add_filter( 'vulopilot_scanner_sources', fn( array $c ) => array_merge( $c, array( MyScanner::class ) ) );
```

Register it (and a rule, if you want a recommendation) before `init` priority 20, when the registries are built.

## Scanners registered by the core

| Category | Scanner id | Class | Label | File |
|---|---|---|---|---|
| `accessibility` | `accessibility` | `AccessibilityScanner` | Accessibility | `classes/Accessibility/AccessibilityScanner.php` |
| `accessibility` | `aria-attributes` | `AriaAttributesScanner` | ARIA Attributes | `classes/Accessibility/AriaAttributesScanner.php` |
| `accessibility` | `form-labels` | `FormLabelsScanner` | Form Labels | `classes/Accessibility/FormLabelsScanner.php` |
| `accessibility` | `keyboard-accessibility` | `KeyboardAccessibilityScanner` | Keyboard Accessibility | `classes/Accessibility/KeyboardAccessibilityScanner.php` |
| `accessibility` | `wcag-scanner` | `WcagScanner` | WCAG Scanner | `classes/Accessibility/WcagScanner.php` |
| `availability` | `site-availability` | `SiteAvailabilityScanner` | Website Availability | `classes/SiteHealth/SiteAvailabilityScanner.php` |
| `cron` | `cron` | `CronScanner` | Cron | `classes/SiteHealth/CronScanner.php` |
| `database` | `database` | `DatabaseScanner` | Database | `classes/SiteHealth/DatabaseScanner.php` |
| `geo` | `aeo-schema` | `AeoSchemaScanner` | AEO Schema Coverage | `classes/SeoVisibility/AeoSchemaScanner.php` |
| `geo` | `geo-author-info` | `GeoAuthorInfoScanner` | Author Information | `modules/GeoAnalysis/Scanners/GeoAuthorInfoScanner.php` |
| `geo` | `geo-chunking` | `GeoChunkingScanner` | Chunking | `modules/GeoAnalysis/Scanners/GeoChunkingScanner.php` |
| `geo` | `geo-citation-opportunities` | `GeoCitationOpportunityScanner` | Citation Opportunities | `modules/GeoAnalysis/Scanners/GeoCitationOpportunityScanner.php` |
| `geo` | `geo-eeat-signals` | `GeoEeatSignalsScanner` | EEAT Signals | `modules/GeoAnalysis/Scanners/GeoEeatSignalsScanner.php` |
| `geo` | `geo-entity-naming-consistency` | `GeoEntityNamingConsistencyScanner` | Entity Naming Consistency | `modules/GeoAnalysis/Scanners/GeoEntityNamingConsistencyScanner.php` |
| `geo` | `geo-faq-opportunity` | `GeoFaqOpportunityScanner` | FAQ Opportunities | `modules/GeoAnalysis/Scanners/GeoFaqOpportunityScanner.php` |
| `geo` | `geo-semantic-structure` | `GeoSemanticStructureScanner` | Semantic Structure | `modules/GeoAnalysis/Scanners/GeoSemanticStructureScanner.php` |
| `geo` | `geo-summary-block` | `GeoSummaryBlockScanner` | Summary Blocks | `modules/GeoAnalysis/Scanners/GeoSummaryBlockScanner.php` |
| `geo` | `geo-trust-signals` | `GeoTrustSignalsScanner` | Trust Signals | `modules/GeoAnalysis/Scanners/GeoTrustSignalsScanner.php` |
| `not-found` | `not-found` | `NotFoundScanner` | 404 Detection | `classes/Content/NotFoundScanner.php` |
| `performance` | `cache-detection` | `CacheDetectionScanner` | Cache Issues | `classes/Performance/CacheDetectionScanner.php` |
| `performance` | `cdn` | `CdnScanner` | CDN | `classes/Performance/CdnScanner.php` |
| `performance` | `css-optimization` | `CssOptimizationScanner` | CSS Optimization | `classes/Performance/CssOptimizationScanner.php` |
| `performance` | `database-cleanup` | `DatabaseCleanupScanner` | Database Cleanup | `classes/SiteHealth/DatabaseCleanupScanner.php` |
| `performance` | `fonts` | `FontsScanner` | Fonts | `classes/Performance/FontsScanner.php` |
| `performance` | `heavy-plugins` | `HeavyPluginsScanner` | Heavy Plugins | `classes/SiteHealth/HeavyPluginsScanner.php` |
| `performance` | `image-cleanup` | `ImageCleanupScanner` | Image Cleanup | `classes/Performance/ImageCleanupScanner.php` |
| `performance` | `javascript-optimization` | `JavaScriptOptimizationScanner` | JavaScript | `classes/Performance/JavaScriptOptimizationScanner.php` |
| `performance` | `large-images` | `LargeImagesScanner` | Large Images | `classes/Performance/LargeImagesScanner.php` |
| `performance` | `lazy-loading` | `LazyLoadingScanner` | Lazy Loading | `classes/Performance/LazyLoadingScanner.php` |
| `performance` | `performance` | `PerformanceScanner` | Performance | `classes/Performance/PerformanceScanner.php` |
| `performance` | `slow-pages` | `SlowPageScanner` | Slow Pages | `classes/Performance/SlowPageScanner.php` |
| `php-warnings` | `php-warnings` | `PhpWarningScanner` | PHP Warning Detection | `classes/SiteHealth/PhpWarningScanner.php` |
| `plugins` | `plugins` | `PluginsScanner` | Plugins | `classes/SiteHealth/PluginsScanner.php` |
| `redirects` | `redirect-analysis` | `RedirectAnalysisScanner` | Redirect Analysis | `classes/Content/RedirectAnalysisScanner.php` |
| `security` | `backup-health` | `BackupHealthScanner` | Backup Health | `classes/SiteHealth/BackupHealthScanner.php` |
| `security` | `basic-vulnerabilities` | `BasicVulnerabilitiesScanner` | Basic Vulnerabilities | `classes/Security/BasicVulnerabilitiesScanner.php` |
| `security` | `core-file-integrity` | `CoreFileIntegrityScanner` | File Changes | `classes/Security/CoreFileIntegrityScanner.php` |
| `security` | `firewall` | `FirewallScanner` | Firewall | `classes/Security/FirewallScanner.php` |
| `security` | `login-protection` | `LoginProtectionScanner` | Login Protection | `classes/Security/LoginProtectionScanner.php` |
| `security` | `malware` | `MalwareScanner` | Malware & Infection Detection | `classes/Security/MalwareScanner.php` |
| `security` | `weak-passwords` | `WeakPasswordScanner` | Weak Password Detection | `classes/Security/WeakPasswordScanner.php` |
| `server` | `server-health` | `ServerHealthScanner` | Server | `classes/SiteHealth/ServerHealthScanner.php` |
| `ssl` | `ssl-monitoring` | `SslMonitoringScanner` | SSL Monitoring | `classes/Security/SslMonitoringScanner.php` |
| `themes` | `themes` | `ThemesScanner` | Themes | `classes/SiteHealth/ThemesScanner.php` |
| `updates` | `updates` | `UpdatesScanner` | Updates | `classes/SiteHealth/UpdatesScanner.php` |
| `wordpress` | `wordpress-health` | `WordPressHealthScanner` | WordPress | `classes/SiteHealth/WordPressHealthScanner.php` |

## Scanners registered by modules

### `TechnicalSeo`

| Category | Scanner id | Class | Label | File |
|---|---|---|---|---|
| `images` | `broken-images` | `BrokenImagesScanner` | Broken Images | `modules/TechnicalSeo/Scanners/BrokenImagesScanner.php` |
| `images` | `images` | `ImagesScanner` | Images | `modules/TechnicalSeo/Scanners/ImagesScanner.php` |
| `links` | `broken-links` | `BrokenLinksScanner` | Broken Links | `modules/TechnicalSeo/Scanners/BrokenLinksScanner.php` |
| `schema` | `schema` | `SchemaScanner` | Schema | `modules/TechnicalSeo/Scanners/SchemaScanner.php` |
| `seo` | `ai-crawler-blocked-pages` | `AiCrawlerBlockedPagesScanner` | AI Crawler Blocked Pages | `modules/TechnicalSeo/Scanners/AiCrawlerBlockedPagesScanner.php` |
| `seo` | `canonical-url` | `CanonicalUrlScanner` | Canonical URLs | `modules/TechnicalSeo/Scanners/CanonicalUrlScanner.php` |
| `seo` | `duplicate-content` | `DuplicateContentScanner` | Duplicate Content | `modules/TechnicalSeo/Scanners/DuplicateContentScanner.php` |
| `seo` | `heading-structure` | `HeadingStructureScanner` | Heading Structure | `modules/TechnicalSeo/Scanners/HeadingStructureScanner.php` |
| `seo` | `internal-linking` | `InternalLinkingScanner` | Internal Linking | `modules/TechnicalSeo/Scanners/InternalLinkingScanner.php` |
| `seo` | `meta-description` | `MetaDescriptionScanner` | Meta Descriptions | `modules/TechnicalSeo/Scanners/MetaDescriptionScanner.php` |
| `seo` | `open-graph` | `OpenGraphScanner` | Open Graph | `modules/TechnicalSeo/Scanners/OpenGraphScanner.php` |
| `seo` | `orphan-pages` | `OrphanPageScanner` | Orphan Pages | `modules/TechnicalSeo/Scanners/OrphanPageScanner.php` |
| `seo` | `robots-txt` | `RobotsTxtScanner` | Robots.txt | `modules/TechnicalSeo/Scanners/RobotsTxtScanner.php` |
| `seo` | `seo` | `SeoScanner` | SEO | `modules/TechnicalSeo/Scanners/SeoScanner.php` |
| `seo` | `seo-images` | `SeoImagesScanner` | Featured Images | `modules/TechnicalSeo/Scanners/SeoImagesScanner.php` |
| `seo` | `sitemap` | `SitemapScanner` | Sitemap | `modules/TechnicalSeo/Scanners/SitemapScanner.php` |
| `seo` | `structured-data` | `StructuredDataValidationScanner` | Structured Data | `modules/TechnicalSeo/Scanners/StructuredDataValidationScanner.php` |
| `seo` | `thin-content` | `ThinContentScanner` | Thin Content | `modules/TechnicalSeo/Scanners/ThinContentScanner.php` |
| `seo` | `twitter-card` | `TwitterCardScanner` | Twitter Cards | `modules/TechnicalSeo/Scanners/TwitterCardScanner.php` |

### `BrandVisibility`

| Category | Scanner id | Class | Label | File |
|---|---|---|---|---|
| `brand` | `about-page-analysis` | `AboutPageAnalysisScanner` | About Page Analysis | `modules/BrandVisibility/Scanners/AboutPageAnalysisScanner.php` |
| `brand` | `author-schema` | `AuthorSchemaScanner` | Author Schema | `modules/BrandVisibility/Scanners/AuthorSchemaScanner.php` |
| `brand` | `organization-schema` | `OrganizationSchemaScanner` | Organization Schema | `modules/BrandVisibility/Scanners/OrganizationSchemaScanner.php` |

### `ContentOptimization`

| Category | Scanner id | Class | Label | File |
|---|---|---|---|---|
| `content` | `readability` | `ReadabilityScanner` | Readability | `modules/ContentOptimization/Scanners/ReadabilityScanner.php` |
