# VuloPilot — Brand Intelligence module

Companion to [`GEO-MODULE.md`](GEO-MODULE.md), [`CONTENT-INTELLIGENCE-MODULE.md`](CONTENT-INTELLIGENCE-MODULE.md),
[`SCANNERS.md`](SCANNERS.md), [`DASHBOARD-WIDGETS.md`](DASHBOARD-WIDGETS.md), and
[`AI-ACTIONS.md`](AI-ACTIONS.md). Brand Intelligence is a new module (new
category `brand`, alongside `seo`/`geo`/`content`/etc.) built to the same
shape those two already establish: Free owns 3 new deterministic scanners
plus a composite score/report spanning several existing GEO scanners it
reuses rather than duplicates; Pro owns everything with a real ongoing
cost or a real HTTP fetch — score history, drop monitoring, competitor
comparison, and the two schema-writing mechanical fixes.

## Audit: requested vs. already-shipped

Before writing any code, every requested item was checked against what
already existed — this pass turned up more overlap than either prior one,
since GEO's own E-E-A-T/trust/entity scanners already cover adjacent
ground.

**Already shipped, unchanged by this pass (reused via `scanner_id`, not
recategorized):**

| Requested | Already implemented as |
|---|---|
| Trust Score (existence half) | `GeoTrustSignalsScanner` (`geo-trust-signals`) — does an About/Contact page exist at all |
| Authority Score (bio/freshness half) | `GeoEeatSignalsScanner` (`geo-eeat-signals`) + `GeoAuthorInfoScanner` (`geo-author-info`) |
| Entity Score (naming half) | `GeoEntityNamingConsistencyScanner` (`geo-entity-naming-consistency`) |

**Genuinely new** (the 3 scanners this pass actually adds — see below):
About Page **content substance** (distinct from mere existence), and
machine-readable **Organization**/**Person** schema presence (distinct
from GEO's own author-bio-text and generic schema-presence checks).

**Pre-existing infrastructure this pass reuses directly, not duplicates:**

- `HomepageSchemaRenderer`/`SchemaJsonLdRenderer` (Free, `wp_head` output) — both new mechanical fixes write INTO the same `vulopilot_homepage_schema_json` option / `_vulopilot_schema_json` postmeta these already render, as a nested `publisher`/`author` sub-object, rather than needing a second storage key or a second renderer.
- `GeoInsights\CompetitorVisibilityAnalyzer`'s fetch mechanics (`wp_remote_get()` per `geo_competitor_urls` entry) — reused conceptually (same setting, same timeout/sslverify shape) by `BrandCompetitorAnalyzer`, but not the class itself, since it checks a different signal pair (Organization/Person schema, not GEO's own 4 structural signals) — same "different need, not a duplicate" reasoning `ContentGapAnalyzer`'s own docblock gives for the identical choice.
- `GeoInsights\VisibilitySnapshotBuilder`/`VisibilityMonitor`/`VisibilitySnapshotScheduler`'s shape — mirrored, not shared code, for `BrandScoreSnapshotBuilder`/`BrandMonitor`/`BrandScoreSnapshotScheduler` (simpler here: Brand Score is a deterministic composite computed live, never an AI-sampled average, so there's no bounded-sample-batch/nullable-score complexity to carry over).
- `OneClickFix\BulkFixRest`'s "loop the existing single-item call" shape — reused directly by `BrandIntelligence\Rest::create_knowledge_panel_optimization()`, which calls `FindingFixRest::resolve_fix()` per auto-discovered finding rather than reimplementing fix resolution.
- `src/pages/BrandVisibility/BrandVisibility.tsx`'s existing page/route/menu entry — extended in place (see below), not superseded by a new page.

## What's genuinely new in this pass

### Free

**`AboutPageAnalysisScanner`** (id `about-page-analysis`, category `brand`)
— deliberately narrower than `GeoTrustSignalsScanner`'s own check (does an
About/Contact page exist *at all*): this only ever runs for a site that
already has one, and asks whether it actually has real substance — a
minimum word count (`brand_about_page_min_words` setting, default 80) and
a real contact signal (an email address or phone-shaped number in its
text). A same-titled but empty About page passes the existence check
while still giving an AI answer engine nothing to cite.

**`OrganizationSchemaScanner`** (id `organization-schema`, category
`brand`) — real `wp_remote_get(home_url('/'))` fetch (same pattern
`StructuredDataValidationScanner` already uses), checking specifically for
an `Organization`/`LocalBusiness` schema.org type — the structured data
Knowledge Panels and AI answer engines read to resolve "who runs this
site," not just "does some schema exist" (`SchemaScanner`'s own, broader
check).

**`AuthorSchemaScanner`** (id `author-schema`, category `brand`) — reads
each published post's own `_vulopilot_schema_json` postmeta (same key
`AeoSchemaScanner` already reads) for a `Person` reference — distinct from
`GeoAuthorInfoScanner`'s check (does the author have a human-visible bio
at all): this is the machine-readable signal, which a bio field alone
doesn't provide.

**Brand/Trust/Authority/Entity Scores** — `GET /brand-intelligence/score`
(`Controllers\BrandIntelligence`), 4 composite deterministic scores (no AI,
no cost) via `FindingRepository::get_severity_breakdown_for_scanner_ids()`
and the same weighting every other composite score in this codebase uses:

| Score | `scanner_id`s |
|---|---|
| Trust | `geo-trust-signals`, `about-page-analysis` |
| Authority | `geo-eeat-signals`, `geo-author-info`, `author-schema` |
| Entity | `geo-entity-naming-consistency`, `organization-schema` |
| Brand (overall) | union of the 7 above |

Also wired into the Dashboard's `category_scores.brand`
(`Controllers\Dashboard::calculate_brand_score()`) and a new `brand` stat
widget (`dashboard-widgets/registry.ts`).

**Brand Intelligence Report** — `Reports\Types\BrandIntelligenceReport`,
same "extends `AbstractReportType` directly, spans a `scanner_id` list
across categories" shape `ContentIntelligenceReport` already establishes.

**Brand Visibility page** (`src/pages/BrandVisibility/BrandVisibility.tsx`)
— extended in place, not replaced: the pre-existing off-site
mention/share-of-voice card (still honestly "Not connected yet" — see
"Tier scoping" below) now sits alongside a real, always-available on-site
section (Brand Score card + 3 findings-table sections grouped by their own
`scanner_id` list), gated on the Brand Intelligence module being active
the same way `Content.tsx`'s own `isContentModuleActive()` gate works.
One page, since both halves answer the same underlying question ("how
visible/trusted is this brand") — the on-site half just doesn't need a
third-party connection to be real today.

### Pro

**Authority Trends** — `BrandScoreSnapshotBuilder` snapshots the
already-live composite scores into a new table,
`vulopilot_brand_score_history` (Free's `Install.php`, same
self-healing `CREATE TABLE IF NOT EXISTS` shape as
`vulopilot_geo_visibility_history`), once per `BrandScoreSnapshotScheduler`
cron tick (same `scan_frequency`-driven cadence
`GeoInsights\VisibilitySnapshotScheduler` already uses). Simpler than
GEO's own history: Brand Score has no AI-sampled average that can come
back empty, so every column is always a real 0-100 int — no
`sample_size`/nullable-score branch to carry over.
`BrandScoreHistoryRepository` (Pro) is the only writer, same Free-owns-the-
table/Pro-owns-the-repository split `GeoVisibilityHistoryRepository`
already establishes. Read via `GET /brand-score-history`, rendered as a
4-line trend chart (`AuthorityTrendsCard.tsx`, `recharts` — already a real
dependency).

**Brand Monitoring** — `BrandMonitor` self-registers on
`vulopilot_pro_brand_score_snapshot_built` (fired by
`BrandScoreSnapshotBuilder` after every run), logs every run to
`vulopilot_activity_logs`, and emails
(`email_on_brand_score_drop`/`brand_drop_threshold`) when Brand Score
drops past threshold since the previous snapshot — same logic
`GeoInsights\VisibilityMonitor` already uses for GEO's own sitewide score.

**Competitor Comparison** — `BrandCompetitorAnalyzer`, real
`wp_remote_get()` per competitor URL (`geo_competitor_urls` setting,
Scanning → GEO), checking the same two schema signals
`OrganizationSchemaScanner`/`AuthorSchemaScanner` check locally. `POST
/brand-competitor-comparison`, rendered as `CompetitorComparisonCard.tsx`.

**Knowledge Panel Optimization** — two new mechanical fixes (no AI call,
`MechanicalFixRunner`), both deterministically built from data that
already exists:
- `generate-organization-schema` (fixes `organization-schema` findings) — builds an Organization block (site name/URL, plus a logo when a site icon is set) and nests it as the `publisher` of whatever's already saved at `vulopilot_homepage_schema_json`, building a fresh WebSite+publisher base if nothing was saved yet (reusing `generate-homepage-schema`'s own field set rather than duplicating it).
- `generate-author-schema` (fixes `author-schema` findings) — builds a Person block from the post author's own real WordPress profile fields (display name, bio, author archive URL) and nests it as the `author` of whatever's already saved at that post's own `_vulopilot_schema_json`.

Both mapped in `ScannerFixMap::SCANNER_TO_MECHANICAL_FIX`. `POST
/brand-intelligence/optimize-knowledge-panel`
(`BrandIntelligence\Rest::create_knowledge_panel_optimization()`)
auto-discovers every open finding across both scanner ids and resolves
each through `FindingFixRest::resolve_fix()` — one click for everything
schema-related at once, rendered as `KnowledgePanelCard.tsx`.

**Brand Automation** — no new trigger class, same reasoning
`AI-VISIBILITY-MODULE.md`'s own "Automation" entry gives for GEO: binding
any existing trigger (`PostPublishedTrigger`, a cron trigger) to
`RunAiActionAction`/`generate-author-schema`-style mechanical resolution
already works through the existing generic Automation module — a Brand
Score drop has no corresponding Finding/Rule to synthesize a trigger from,
so forcing one would mean inventing a synthetic Finding, the kind of
duplicated/parallel path this pass avoids.

## Tier scoping: "Brand Mention Tracking"

Deliberately **not** built as a new, separate off-site tracking feature.
This is the exact same gap `BrandVisibility.tsx`'s own "Not connected yet"
card already documented before this pass (needs a real Ahrefs Brand Radar
connection this codebase has no credentials for) — building a
look-alike feature with fabricated mention/share-of-voice numbers would
violate this codebase's own "nothing fabricated" posture
(`GeoInsights\CompetitorVisibilityAnalyzer`'s own docblock states the
identical constraint for the identical reason). "Brand Monitoring" above
is the real, delivered half of Phase 03's ask — sitewide Brand Score
history and drop alerts, entirely on real, already-collected data; "Brand
Mention Tracking" stays an honest, undelivered gap until a real
third-party data source is connected.

## Extension points added

- `vulopilot_pro_brand_score_snapshot_built` (action, 2 args: `$snapshot`, `$previous_row`) — fired by `BrandScoreSnapshotBuilder` after every run. `BrandMonitor` hooks it; a future Pro/third-party consumer can too.
- `vulopilot_brand_authority_trends_card` / `vulopilot_brand_competitor_comparison_card` / `vulopilot_brand_knowledge_panel_card` (React filters, `@wordpress/hooks`) — same "register a source, don't modify the host" slot pattern `vulopilot_content_topic_authority_card`/`vulopilot_content_gap_analysis_card` already use on the Content page.
- No new PHP registry — the new scanners/REST controllers/report/mechanical fixes all go through the existing `vulopilot_scanner_sources`/`vulopilot_rest_controllers`/`ReportTypeRegistry`/`ScannerFixMap`, exactly as documented in `SCANNERS.md`/`AI-ACTIONS.md`.

## REST routes added

| Route | Plugin | Cost | Notes |
|---|---|---|---|
| `GET /brand-intelligence/score` | Free | None | Brand/Trust/Authority/Entity composite scores |
| `GET /brand-score-history` | Pro | None | Reads `BrandScoreHistoryRepository`'s daily rows |
| `POST /brand-competitor-comparison` | Pro | Real HTTP fetch, no AI | Runs `BrandCompetitorAnalyzer::analyze()` |
| `POST /brand-intelligence/optimize-knowledge-panel` | Pro | None (mechanical) | Resolves every open organization-schema/author-schema finding |

Free's `brand_score` and Pro's `brand_insights` REST controller-array keys
are deliberately different even though both eventually share the
`brand-intelligence` route base — see `RestAPI/Rest.php`'s own comment;
same key-collision avoidance `AI-VISIBILITY-MODULE.md`'s own pass
documents for `geo_top_pages`/`geo_analysis`.

## Tests

`test-organization-schema-scanner.php`/`test-author-schema-scanner.php`/
`test-about-page-analysis-scanner.php` (deterministic detection logic) in
Free; `test-brand-score-history-repository.php` (table-key wiring, same
shape as `test-geo-visibility-history-repository.php`),
`test-brand-competitor-analyzer.php` (schema-signal regexes), and
`test-mechanical-fix-runner.php` (confirms both new fixes merge into
existing schema JSON rather than clobbering it) in Pro — same
Brain\Monkey-based fast-unit-test posture every prior module's own Tests
section documents. Run with `vendor/bin/phpunit` from either plugin
directory.

React tests (`wp-scripts test-unit-js`) cover `BrandVisibility.tsx`'s own
module-active gating and Pro filter-slot rendering (Free), plus
`AuthorityTrendsCard`/`CompetitorComparisonCard`/`KnowledgePanelCard`
(Pro). Run with `pnpm test:unit:js` from either plugin directory.

## What's still not here (honest gaps)

- **Real off-site brand-mention/share-of-voice tracking** — see "Tier
  scoping" above; unchanged by this pass.
- **No scheduled/automatic Competitor Comparison or Knowledge Panel runs**
  — both are manual, action-driven cards on the Brand Visibility page;
  only Authority Trends' own snapshot runs on a cron cadence.
- **`generate-organization-schema`/`generate-author-schema` don't repair
  a malformed EXISTING block** — same posture `generate-homepage-schema`
  already takes for `StructuredDataValidationScanner`'s "existing block is
  broken" finding: guessing what a third-party theme/plugin meant to write
  isn't something this plugin can safely reconstruct.
