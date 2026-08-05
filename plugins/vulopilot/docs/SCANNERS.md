# VuloPilot — scanner architecture

Companion to [`DATABASE.md`](DATABASE.md).
Covers the contracts, the engine, the original 14 built-in scanners, and
how a new scanner gets added — by this codebase, by a Pro module, or by a
third-party developer. Later passes added many more scanners using this
exact same mechanism. As of this pass there are **66 concrete scanners**
registered in Free (`classes/Scanners/Basic/`), kept in their own docs
rather than rewriting this table (to avoid misrepresenting the order these
were actually built in):
[`SEO-MODULE.md`](SEO-MODULE.md) added 13, all category `seo`;
[`AI-CRAWLER-ANALYTICS-MODULE.md`](AI-CRAWLER-ANALYTICS-MODULE.md) added 1
more, also category `seo` (`AiCrawlerBlockedPagesScanner`, "Blocked
Pages") — registered alongside SEO-MODULE.md's 13 in `modules/Seo/Module.php`,
not a separate module home;
[`GEO-MODULE.md`](GEO-MODULE.md) added 9 more, all category `geo` — the
`geo` scanner gap this file originally called out below is now filled (the
current source — `ScannerRegistry::get_default_scanner_classes()`'s own
comment — groups `GeoEntityNamingConsistencyScanner` into this same
9-scanner GEO-MODULE.md batch, one more than that doc's own table of 8
lists; that's a real, small drift between the code comment and
GEO-MODULE.md's own text, noted honestly here rather than silently picking
one);
[`AI-VISIBILITY-MODULE.md`](AI-VISIBILITY-MODULE.md) added 1 more, also
category `geo` (`AeoSchemaScanner`);
[`SECURITY-MODULE.md`](SECURITY-MODULE.md) added 3 more, all category
`security` — Free's first scanners in that category (see the note on
`SecurityScanner`/`RestApiScanner` below for why the table itself isn't
updated to reflect this);
[`ACCESSIBILITY-MODULE.md`](ACCESSIBILITY-MODULE.md) added 1 more,
category `accessibility` (`WcagScanner`) — four of that pass's five spec
bullets were already satisfied by pre-existing scanners spread across
`accessibility`/`images`/`geo`, so only one genuinely new scanner was
needed; see that doc's own audit table;
[`BRAND-INTELLIGENCE-MODULE.md`](BRAND-INTELLIGENCE-MODULE.md) added 3
more, a new category `brand` (`AboutPageAnalysisScanner`,
`AuthorSchemaScanner`, `OrganizationSchemaScanner`);
[`CONTENT-INTELLIGENCE-MODULE.md`](CONTENT-INTELLIGENCE-MODULE.md) added 1
more, a new category `content` (`ReadabilityScanner`) — that pass's other
four requested checks (Thin Content, Duplicate Content, Heading Analysis,
Internal Link Analysis) were already fully built by SEO-MODULE.md's own
scanners, reused rather than duplicated;
[`WOOCOMMERCE-INTELLIGENCE-MODULE.md`](WOOCOMMERCE-INTELLIGENCE-MODULE.md)
added 1 more Free scanner (`ProductSeoScanner`, category `woocommerce`)
and one new Pro scanner (`InventoryIntelligenceScanner`, `modules/WooCommerceIntelligence/`,
same category, tier `pro`) — three of that pass's five Free spec bullets
were already satisfied by pre-existing `Product*` scanners; see that doc's
own audit table.

That accounts for 14 (original) − 2 (moved to Pro) + 13 + 1 + 9 + 1 + 3 + 1
+ 3 + 1 + 1 = 46 scanners with a documented origin. The remaining **19**
have no dedicated `docs/*.md` pass at all — `ScannerRegistry`'s own source
comments attribute them directly to the plugin's readme.txt feature list
instead ("WooCommerce Optimization", "Website Health Monitoring",
"Website Performance", "Accessibility Scanner"), not a numbered
architecture pass: the 11 pre-existing `Product*` scanners (`ProductMissingImagesScanner`
and 10 siblings, category `woocommerce`, predating even
WOOCOMMERCE-INTELLIGENCE-MODULE.md's own pass), `SslMonitoringScanner`/
`RedirectAnalysisScanner`/`NotFoundScanner`/`PhpWarningScanner` (each its
own single-scanner category — `ssl`/`redirects`/`not-found`/`php-warnings`),
`SlowPageScanner`/`LargeImagesScanner`/`HeavyPluginsScanner`/`CacheDetectionScanner`
(category `performance`, joining the original `PerformanceScanner`), and
`FormLabelsScanner`/`AriaAttributesScanner` (category `accessibility`,
predating `ACCESSIBILITY-MODULE.md`'s own pass). This doc is the accurate
record for those 19 since no sibling doc claims them; the category rundown
above is exactly what each one checks.

**Scanners never call an AI provider.** A scanner's job is narrow and
deterministic: inspect real WordPress/site state and report structured
`Finding`s. Anything AI-assisted (summarizing findings in plain English,
suggesting a fix, drafting an automation) reads a scanner's *output*
afterwards — it's a separate concern (`AIProviders/`, see
[`AI-ARCHITECTURE.md`](AI-ARCHITECTURE.md)), not something a scanner does
itself. Keeping this boundary hard is what makes scan results
reproducible, fast, and free of API cost/latency/failure modes.

## Contracts (`vulolabs/plugins/vulopilot/classes/`)

These value objects and the `ScannerInterface` contract used to live in a
separate Composer path package, `vulolabs/packages/php/vulopilot-core`
(`namespace VuloPilotCore\...`) — that package no longer exists. It was
folded directly into the plugin itself, under the `VuloPilot\` namespace,
which is where every class below actually lives today:

```
classes/
├── Contracts/Scanner/
│   └── ScannerInterface.php   get_id()/get_label()/get_category()/get_tier()/scan(): Finding[]
└── ValueObjects/
    ├── Severity.php            critical|high|medium|low|info — closed vocabulary
    ├── Finding.php              one issue: title, severity, category, description, object_type/ref, meta
    └── ScanResult.php           the outcome of running one scanner once (status, findings[], duration, summary)
```

- **`ScannerInterface` is the only interface.** There's deliberately no
  `ScanResultInterface` — `ScanResult` only ever has one shape/implementation
  (produced by `ScanRunner`, never by a scanner), so an interface for it
  would have exactly one implementer and add nothing. `ScannerInterface`
  earns its interface status because it genuinely has 66 different
  implementations today (up from 14 at this doc's first pass) and is the
  actual swap point for Free/Pro/third-party scanners.
- **Zero WordPress dependency in `ValueObjects/`** — `Finding`/`Severity`/
  `ScanResult` are plain PHP, unit-testable with no WP bootstrap.
  `ScannerInterface` only references these, never a WP function. Real
  scanner *implementations* are WP-heavy; the *contract* they satisfy is
  not.
- **`Finding`'s constructor is not validated against `Severity`.** An
  earlier draft of this doc claimed `Finding` throws on an invalid
  severity — checking the actual constructor, that isn't (and doesn't
  appear to have ever been) true: `Finding::__construct()` just assigns
  every argument to a property, with no call to `Severity::is_valid()`
  and no exception path. `Severity::is_valid()` exists as a static helper
  a *caller* can use, but nothing inside `Finding` itself calls it. A
  scanner passing an invalid severity string produces a `Finding` that
  silently carries it — worth knowing if you're debugging why an
  obviously-wrong severity value made it all the way to the database.
- **`Finding`'s constructor args map 1:1 to `vulopilot_scan_findings`
  columns**, minus `scan_id`/`status` — those get attached when a Finding
  is persisted against a specific scan run, which is
  `Services\ScanPersistenceListener`'s job (see "What's not here yet"
  below — this is one of the things that *was* "not built yet" when this
  doc was first written and has since shipped).

## Engine (`vulolabs/plugins/vulopilot/classes/Scanners`)

```
classes/Scanners/
├── ScannerRegistry.php   Instantiates every registered scanner class, indexed by get_id(), applies category kill switches
├── ScanRunner.php         Runs one/many/all scanners, times them, catches failures
└── Basic/
    ├── AbstractBasicScanner.php   shared get_tier() = 'free'
    └── (66 concrete scanners)
```

- **`ScannerRegistry` collects class names via a filter, not folders.**
  `module-architecture.md` describes `Modules.php` discovering whole
  packages by `scandir()`-ing for a `Module.php` file — that mechanism
  exists because a module is a *package* (`Module.php` + `Rest.php` +
  `Frontend.php` + …). A scanner is a single class implementing one small
  interface, so forcing it into its own directory would add a
  folder-per-scanner for no benefit. `ScannerRegistry::register_scanners()`
  instead does: `apply_filters( 'vulopilot_scanner_sources', $free_defaults )`
  → for each class name, skip if it doesn't exist or doesn't implement
  `ScannerInterface`, otherwise instantiate and index by `get_id()`. Same
  "register a source, get discovered — never instantiated directly by the
  consumer" spirit as the module system, simpler mechanics for a simpler
  unit.
- **Not every scanner is in the hardcoded default list — 18 of them are
  module-gated instead.** `ScannerRegistry::get_default_scanner_classes()`
  no longer includes `SeoScanner`, `SchemaScanner`, `ImagesScanner`, or
  `BrokenLinksScanner` — the four "original 14" rows below that are
  category `seo`/`schema`/`images`/`links`. They, plus SEO-MODULE.md's 13
  and AI-CRAWLER-ANALYTICS-MODULE.md's 1, are all registered instead by
  `modules/Seo/Module.php`'s own `add_filter( 'vulopilot_scanner_sources', ... )`
  callback (18 classes total). This is a real architectural change since
  this doc's first pass: if the Seo module is deactivated (Settings →
  Modules), `Modules::load_active_modules()` never constructs
  `Seo\Module`, its filter callback never registers, and none of those 18
  scanners run on the next scan — not just the 13+1 "SEO-MODULE.md era"
  ones, but the 4 originally-hardcoded ones too. `Geo\Module` does **not**
  do this for GEO's own scanners (they stay in the hardcoded default list
  below, unconditionally) — see that module's own docblock for why GEO
  has no whole-category kill switch the way SEO now does.
- **Settings-driven category kill switches, new since this doc's first
  pass.** `ScannerRegistry::register_scanners()` also calls a private
  `get_disabled_categories()` that reads `enable_accessibility_scanning`/
  `enable_woocommerce_scanning` from `Utill::VULOPILOT_SETTINGS_KEY` and
  skips registering any scanner whose `get_category()` matches a disabled
  one. Only `accessibility` and `woocommerce` have a whole-category
  toggle this way; every other category (`security`, `performance`,
  `links`, `geo`, `seo`, …) always runs, with individual scanners reading
  their own granular `flag_*` setting instead where that's needed.
- **`ScanRunner` owns timing and failure handling**, not scanners — every
  `run()` wraps the scanner's `scan()` call in a timer and a `try/catch`,
  producing a `ScanResult` either way (`STATUS_COMPLETED` with findings, or
  `STATUS_FAILED` with the exception message and an empty findings array).
  A scanner author never writes their own timing/error boilerplate; a bug in
  one third-party scanner can't take the rest of a `run_all()` down with it.
- **`ScanRunner` fires `vulopilot_scan_completed` and stops** — it does not
  write to `vulopilot_scans`/`vulopilot_scan_findings` itself. Persistence
  is a separate listener's job — see "What's not here yet" for what
  actually does it now. This keeps `ScanRunner`'s only dependency
  direction Free → `ValueObjects`, never Free → a persistence layer.

## The 14 original scanners (`classes/Scanners/Basic/`)

Every one of these does exactly one real, bounded, deterministic check
today — not because that's the ceiling, but because one honest check beats
several fake ones, and each is independently extendable later (see
"Extension strategy"). All are `tier = 'free'` (that's what "Basic" means).

| Scanner | `id` | `category` | What it actually checks |
|---|---|---|---|
| `BrokenLinksScanner` | `broken-links` | `links` | HTTP HEAD on links found in the 20 most recently published posts/pages (capped at 40 links/run), flags non-2xx/3xx |
| `ImagesScanner` | `images` | `images` | The 100 most recent image attachments missing `_wp_attachment_image_alt` |
| `SeoScanner` | `seo` | `seo` | The 50 most recently modified published posts/pages with a title under 10 or over 60 characters |
| `SchemaScanner` | `schema` | `schema` | Whether the homepage response contains any `application/ld+json` at all |
| `PerformanceScanner` | `performance` | `performance` | `SUM(LENGTH(option_value))` for autoloaded `wp_options` rows, flagged over 1MB |
| `DatabaseScanner` | `database` | `database` | `COUNT(*)` of `post_type = 'revision'` rows, flagged over 500 |
| `SecurityScanner` | `security` | `security` | Whether a user named `admin` exists (`username_exists()`) |
| `WooCommerceScanner` | `woocommerce` | `woocommerce` | Whether a published WooCommerce checkout page is configured (no-op if WooCommerce isn't active) |
| `AccessibilityScanner` | `accessibility` | `accessibility` | The 50 most recently modified published posts/pages whose content contains its own `<h1>` |
| `PluginsScanner` | `plugins` | `plugins` | Installed plugins not in `active_plugins` |
| `ThemesScanner` | `themes` | `themes` | Installed themes that aren't the active theme or its parent |
| `UpdatesScanner` | `updates` | `updates` | `get_core_updates()`/`get_plugin_updates()`/`get_theme_updates()` |
| `CronScanner` | `cron` | `cron` | `_get_cron_array()` entries more than an hour overdue |
| `RestApiScanner` | `rest-api` | `rest-api` | An unauthenticated `GET /wp/v2/users` request — flags if it returns user data |

Categories are chosen to line up with the admin UI already built: the
`FindingsTable`-based Health/SEO/GEO/WooCommerce pages filter
`vulopilot_scan_findings` by exactly these category strings (`seo`,
`woocommerce`; Health shows every category unfiltered). There was no
`geo` scanner in this original list — [`GEO-MODULE.md`](GEO-MODULE.md)
later filled that gap with (per the code, not that doc's own table — see
the intro above) 9 scanners.

**`SecurityScanner`/`RestApiScanner` have since moved to `vulopilot-pro`,
unchanged in name.** Both rows above describe what was true when this
table was first written; neither class lives under `classes/Scanners/Basic/`
anymore — `vulopilot-pro`'s `SecurityMonitoring` module now owns both
(`modules/SecurityMonitoring/Scanners/SecurityScanner.php`/`RestApiScanner.php`,
same class names, `get_tier()` now `'pro'`), alongside **7** more hardening
scanners added since (`DebugModeScanner`, `AdvancedVulnerabilitiesScanner`,
`ExposedFilesScanner`, `IntegrityMonitoringScanner`,
`SecurityHeadersScanner`, `XmlrpcExposureScanner`, `FileEditorScanner` — 9
scanners in that module total, not the 5 an earlier pass of this doc
claimed). Free's own `security`-category scanners today are the 3
[`SECURITY-MODULE.md`](SECURITY-MODULE.md) added
(`WeakPasswordScanner`/`BasicVulnerabilitiesScanner`/`CoreFileIntegrityScanner`)
— genuinely new Free scanners, not a restoration of these two.

**`AccessibilityScanner`'s row above is still accurate, but no longer the
whole `accessibility`-category picture.** `FormLabelsScanner`/
`AriaAttributesScanner` (added alongside a prior WooCommerce AI pass,
undocumented by any sibling doc — see the intro above) and `WcagScanner`
([`ACCESSIBILITY-MODULE.md`](ACCESSIBILITY-MODULE.md)) all share the same
category string (4 scanners total). See that doc's own audit table for
why "Missing Alt"/"Labels"/"Heading Hierarchy"/"ARIA Detection" needed no
new scanner despite being named as Phase 8 bullets — each was already
covered, just under a different category (`images`/`accessibility`/`geo`/
`accessibility` respectively).

**`WooCommerceScanner`'s row above is also no longer the whole story.**
It grew from one check (checkout page) to five (cart/My Account pages,
store base location, an enabled payment gateway) in
[`WOOCOMMERCE-INTELLIGENCE-MODULE.md`](WOOCOMMERCE-INTELLIGENCE-MODULE.md)'s
"Store Health" pass. The `woocommerce` category itself now totals 13
scanners: `WooCommerceScanner` + 11 pre-existing `Product*` scanners
(`ProductMissingImagesScanner`, `ProductMissingCategoriesScanner`,
`ProductMissingTagsScanner`, `ProductMissingDescriptionScanner`,
`ProductMissingShortDescriptionScanner`, `ProductSkuIssuesScanner`,
`ProductAttributesScanner`, `ProductInventoryHealthScanner`,
`ProductPricingScanner`, `ProductDuplicateScanner`,
`ProductCompletenessScanner`) + `ProductSeoScanner` (that pass's one
genuinely new Free scanner) — plus its first Pro scanner
(`InventoryIntelligenceScanner`, `modules/WooCommerceIntelligence/Scanners/`).

Every scanner that runs a network request (`SchemaScanner`,
`RestApiScanner`, `BrokenLinksScanner`) or a `$wpdb` query
(`PerformanceScanner`, `DatabaseScanner`) is deliberately bounded — capped
batch sizes, short timeouts — per `performance.md`'s guidance against
unbounded operations; none of them do an unbounded full-site crawl.

## Extension strategy

Three ways to add a scanner, in increasing order of "how far from this
codebase":

1. **A new Free built-in scanner.** Add a class under `classes/Scanners/Basic/`
   extending `AbstractBasicScanner`, implement `get_id()`/`get_label()`/
   `get_category()`/`scan()`, add its `::class` reference to
   `ScannerRegistry::get_default_scanner_classes()` (or, if it's an SEO
   check, to `modules/Seo/Module.php`'s own `register_scanners()` instead —
   see the module-gating note above). Runs for every install, no license
   check (subject to whichever module/category toggle its category is
   gated by, if any).
2. **A Pro premium scanner.** A Pro module (e.g. `SecurityMonitoring`,
   `AdvancedSeo`, `WooCommerceIntelligence`) puts its scanner class inside
   its own module folder, extending `vulopilot-pro`'s own
   `VuloPilotPro\Scanners\AbstractBasicScanner` — a separate class from
   Free's, whose `get_tier()` hardcodes `'pro'` (not `'premium'` — an
   earlier pass of this doc had that wrong). Both implement the same
   `VuloPilot\Contracts\Scanner\ScannerInterface`. The module's
   `Module.php` hooks `add_filter( 'vulopilot_scanner_sources', ... )` and
   appends its own class name to the list — the exact same filter Free's
   own scanners are discovered through, gated on license the same way
   `VuloLabsPro` gates `vulopilot_module_sources` (`plugin-families.md`).
3. **A third-party scanner**, from any other plugin or a site's
   `functions.php`: implement `ScannerInterface`, hook the same
   `vulopilot_scanner_sources` filter, append the class name. No different
   from step 2 mechanically — Pro doesn't get a special, more-privileged
   registration path than a third party would.

In all three cases `ScannerRegistry` treats the class identically: it
doesn't know or care whether a scanner came from Free, Pro, or a
third-party plugin — only `get_tier()`'s return value distinguishes free
from pro, and that's read from the instance, not from where the class
lives on disk.

## What's not here yet

Two of the three gaps this section originally called out are now closed:

- ~~**Persistence.**~~ **Built.** `Services\ScanPersistenceListener`
  self-hooks `vulopilot_scan_completed` and writes both the
  `vulopilot_scans` row and every `vulopilot_scan_findings` row, logs a
  `scan.completed` activity-log entry, optionally emails critical findings
  (`notify_on_critical_findings` setting), and fires its own
  `vulopilot_scan_persisted` hook afterward — the seam
  `vulopilot-pro`'s `AdvancedReports` module uses to recalculate a
  site-health snapshot without `ScanPersistenceListener` knowing that
  module exists.
- ~~**REST endpoints** (`vulopilot/v1/scans`, `/findings`)~~ **Built.**
  `RestAPI\Controllers\Scans`/`Findings` (`rest_base` = `scans`/`findings`)
  back the admin UI pages this doc originally said "correctly show their
  error state until the REST layer lands." `Findings` also has a `/bulk`
  sub-route and a `/{id}/actions/{action_id}` sub-route — the latter is
  what wires a Finding to [`AI-ACTIONS.md`](AI-ACTIONS.md)'s `propose()`.
- **Scheduling — built, but in Pro, not Free.** Nothing in `classes/Scanners/`
  itself calls `ScanRunner::run_all()` on a cron tick; `VuloPilot.php`'s
  own bootstrap comment is explicit that a `Scheduler` class doing that is
  "Pro business logic now" — "Scheduled Website Scans" per the readme —
  and lives in `vulopilot-pro`'s `Automation` module, constructed against
  this same `scan_runner` instance via `VuloPilot()->scan_runner`. Free's
  own automation surface is deliberately smaller: `Automation\ManualActionRunner`
  (`classes/Automation/`) runs one registered action against one specific,
  already-known Finding, by hand, with no trigger/schedule/cooldown at
  all — see that class's own docblock.
