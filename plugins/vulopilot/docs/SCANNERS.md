# VuloPilot - scanner architecture

**Scanners never call an AI provider.** A scanner's job is narrow and
deterministic: inspect real WordPress/site state and report structured
`Finding`s. Anything AI-assisted (summarizing findings in plain English,
suggesting a fix, drafting an automation) reads a scanner's *output*
afterwards - it's a separate concern (`AIProviders/`, see
[`AI-ARCHITECTURE.md`](AI-ARCHITECTURE.md)), not something a scanner does
itself. Keeping this boundary hard is what makes scan results
reproducible, fast, and free of API cost/latency/failure modes.

## Contracts (`vulolabs/plugins/vulopilot/classes/`)

These value objects and the `ScannerInterface` contract used to live in a
separate Composer path package, `vulolabs/packages/php/vulopilot-core`
(`namespace VuloPilotCore\...`) - that package no longer exists. It was
folded directly into the plugin itself, under the `VuloPilot\` namespace,
which is where every class below actually lives today:

```
classes/Utill/
├── ScannerInterface.php   get_id()/get_label()/get_category()/get_tier()/scan(): Finding[]
├── Severity.php            critical|high|medium|low|info - closed vocabulary
├── Finding.php              one issue: title, severity, category, description, object_type/ref, meta
└── ScanResult.php           the outcome of running one scanner once (status, findings[], duration, summary)
```

These used to live under `classes/Contracts/Scanner/` and `classes/ValueObjects/`
respectively - both flat folders were retired in a later reorganization pass
that moved every genuinely cross-tab/shared class into one `classes/Utill/`
folder (per-tab classes moved into their owning `classes/<Tab>/` folder
instead; see the repo's own `CLAUDE.md` for the current folder shape).

- **Zero WordPress dependency in `Utill/`'s value objects** - `Finding`/`Severity`/
  `ScanResult` are plain PHP, unit-testable with no WP bootstrap.
  `ScannerInterface` only references these, never a WP function. Real
  scanner *implementations* are WP-heavy; the *contract* they satisfy is
  not.
- **`Finding`'s constructor is not validated against `Severity`.** An
  earlier draft of this doc claimed `Finding` throws on an invalid
  severity - checking the actual constructor, that isn't (and doesn't
  appear to have ever been) true: `Finding::__construct()` just assigns
  every argument to a property, with no call to `Severity::is_valid()`
  and no exception path. `Severity::is_valid()` exists as a static helper
  a *caller* can use, but nothing inside `Finding` itself calls it. A
  scanner passing an invalid severity string produces a `Finding` that
  silently carries it - worth knowing if you're debugging why an
  obviously-wrong severity value made it all the way to the database.
- **`Finding`'s constructor args map 1:1 to `vulopilot_scan_findings`
  columns**, minus `scan_id`/`status` - those get attached when a Finding
  is persisted against a specific scan run, which is
  `Utill\ScanPersistenceListener`'s job (see "What's not here yet"
  below - this is one of the things that *was* "not built yet" when this
  doc was first written and has since shipped).

## Engine (`vulolabs/plugins/vulopilot/classes/Utill`)

```
classes/Utill/
├── ScannerRegistry.php   Instantiates every registered scanner class, indexed by get_id(), applies category kill switches
├── ScanRunner.php         Runs one/many/all scanners, times them, catches failures
└── ScannerUtil.php        shared abstract base, get_tier() = 'free'
```

The 66 concrete scanner classes themselves no longer live in one flat
folder - each lives in the `classes/<Tab>/` folder (or `modules/<Module>/Scanners/`)
that actually owns it, matching `classes/Admin.php`'s menu-tab structure
(e.g. `classes/Security/`, `classes/SeoVisibility/`, `modules/TechnicalSeo/Scanners/`).
`ScannerRegistry`/`ScannerUtil` are the only genuinely shared, cross-tab
pieces, which is why they live in `classes/Utill/` rather than any one tab
folder.

- **`ScannerRegistry` collects class names via a filter, not folders.**
  `module-architecture.md` describes `Modules.php` discovering whole
  packages by `scandir()`-ing for a `Module.php` file - that mechanism
  exists because a module is a *package* (`Module.php` + `Rest.php` +
  `Frontend.php` + …). A scanner is a single class implementing one small
  interface, so forcing it into its own directory would add a
  folder-per-scanner for no benefit. `ScannerRegistry::register_scanners()`
  instead does: `apply_filters( 'vulopilot_scanner_sources', $free_defaults )`
  → for each class name, skip if it doesn't exist or doesn't implement
  `ScannerInterface`, otherwise instantiate and index by `get_id()`. Same
  "register a source, get discovered - never instantiated directly by the
  consumer" spirit as the module system, simpler mechanics for a simpler
  unit.
- **Not every scanner is in the hardcoded default list - 18 of them are
  module-gated instead.** `ScannerRegistry::get_default_scanner_classes()`
  no longer includes `SeoScanner`, `SchemaScanner`, `ImagesScanner`, or
  `BrokenLinksScanner` - the four "original 14" rows below that are
  category `seo`/`schema`/`images`/`links`. They, plus SEO-MODULE.md's 13
  and AI-CRAWLER-ANALYTICS-MODULE.md's 1, are all registered instead by
  `modules/TechnicalSeo/Module.php`'s own `add_filter( 'vulopilot_scanner_sources', ... )`
  callback (18 classes total). This is a real architectural change since
  this doc's first pass: if the Seo module is deactivated (Settings →
  Modules), `Modules::load_active_modules()` never constructs
  `TechnicalSeo\Module`, its filter callback never registers, and none of those 18
  scanners run on the next scan - not just the 13+1 "SEO-MODULE.md era"
  ones, but the 4 originally-hardcoded ones too. `GeoAnalysis\Module` does **not**
  do this for GEO's own scanners (they stay in the hardcoded default list
  below, unconditionally) - see that module's own docblock for why GEO
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
- **`ScanRunner` owns timing and failure handling**, not scanners - every
  `run()` wraps the scanner's `scan()` call in a timer and a `try/catch`,
  producing a `ScanResult` either way (`STATUS_COMPLETED` with findings, or
  `STATUS_FAILED` with the exception message and an empty findings array).
  A scanner author never writes their own timing/error boilerplate; a bug in
  one third-party scanner can't take the rest of a `run_all()` down with it.
- **`ScanRunner` fires `vulopilot_scan_completed` and stops** - it does not
  write to `vulopilot_scans`/`vulopilot_scan_findings` itself. Persistence
  is a separate listener's job - see "What's not here yet" for what
  actually does it now. This keeps `ScanRunner`'s only dependency
  direction Free → `ValueObjects`, never Free → a persistence layer.

## The 14 original scanners ((each tab's/module's own folder under `classes/`/`modules/`))

Every one of these does exactly one real, bounded, deterministic check
today - not because that's the ceiling, but because one honest check beats
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
| `WooCommerceScanner` | `woocommerce` | `woocommerce` | Whether a published checkout page is configured for the store platform (no-op if the store platform isn't active) |
| `AccessibilityScanner` | `accessibility` | `accessibility` | The 50 most recently modified published posts/pages whose content contains its own `<h1>` |
| `PluginsScanner` | `plugins` | `plugins` | Installed plugins not in `active_plugins` |
| `ThemesScanner` | `themes` | `themes` | Installed themes that aren't the active theme or its parent |
| `UpdatesScanner` | `updates` | `updates` | `get_core_updates()`/`get_plugin_updates()`/`get_theme_updates()` |
| `CronScanner` | `cron` | `cron` | `_get_cron_array()` entries more than an hour overdue |
| `RestApiScanner` | `rest-api` | `rest-api` | An unauthenticated `GET /wp/v2/users` request - flags if it returns user data |

Categories are chosen to line up with the admin UI already built: the
`FindingsTable`-based Health/SEO/GEO/Commerce pages filter
`vulopilot_scan_findings` by exactly these category strings (`seo`,
`woocommerce`; Health shows every category unfiltered). There was no
`geo` scanner in this original list - [`GEO-MODULE.md`](GEO-MODULE.md)
later filled that gap with (per the code, not that doc's own table - see
the intro above) 9 scanners.

**`AccessibilityScanner`'s row above is still accurate, but no longer the
whole `accessibility`-category picture.** `FormLabelsScanner`/
`AriaAttributesScanner` (added alongside a prior store AI pass,
undocumented by any sibling doc - see the intro above) and `WcagScanner`
([`ACCESSIBILITY-MODULE.md`](ACCESSIBILITY-MODULE.md)) all share the same
category string (4 scanners total). See that doc's own audit table for
why "Missing Alt"/"Labels"/"Heading Hierarchy"/"ARIA Detection" needed no
new scanner despite being named as Phase 8 bullets - each was already
covered, just under a different category (`images`/`accessibility`/`geo`/
`accessibility` respectively).

Every scanner that runs a network request (`SchemaScanner`,
`RestApiScanner`, `BrokenLinksScanner`) or a `$wpdb` query
(`PerformanceScanner`, `DatabaseScanner`) is deliberately bounded - capped
batch sizes, short timeouts - per `performance.md`'s guidance against
unbounded operations; none of them do an unbounded full-site crawl.

## Extension strategy

Three ways to add a scanner, in increasing order of "how far from this
codebase":

1. **A new Free built-in scanner.** Add a class under the owning tab's `classes/<Tab>/` (or `modules/<Module>/Scanners/`) folder
   extending `Utill\ScannerUtil`, implement `get_id()`/`get_label()`/
   `get_category()`/`scan()`, add its `::class` reference to
   `ScannerRegistry::get_default_scanner_classes()` (or, if it's an SEO
   check, to `modules/TechnicalSeo/Module.php`'s own `register_scanners()` instead -
   see the module-gating note above). Runs for every install, no license
   check (subject to whichever module/category toggle its category is
   gated by, if any).

## What's not here yet

Two of the three gaps this section originally called out are now closed:

- ~~**REST endpoints** (`vulopilot/v1/scans`, `/findings`)~~ **Built.**
  `Utill\Scans`/`Findings` (`rest_base` = `scans`/`findings`)
  back the admin UI pages this doc originally said "correctly show their
  error state until the REST layer lands." `Findings` also has a `/bulk`
  sub-route and a `/{id}/actions/{action_id}` sub-route - the latter is
  what wires a Finding to [`AI-ACTIONS.md`](AI-ACTIONS.md)'s `propose()`.
