# VuloPilot - Brand Intelligence module

## Audit: requested vs. already-shipped

Before writing any code, every requested item was checked against what
already existed - this pass turned up more overlap than either prior one,
since GEO's own E-E-A-T/trust/entity scanners already cover adjacent
ground.

**Already shipped, unchanged by this pass (reused via `scanner_id`, not
recategorized):**

| Requested | Already implemented as |
|---|---|
| Trust Score (existence half) | `GeoTrustSignalsScanner` (`geo-trust-signals`) - does an About/Contact page exist at all |
| Authority Score (bio/freshness half) | `GeoEeatSignalsScanner` (`geo-eeat-signals`) + `GeoAuthorInfoScanner` (`geo-author-info`) |
| Entity Score (naming half) | `GeoEntityNamingConsistencyScanner` (`geo-entity-naming-consistency`) |

**Genuinely new** (the 3 scanners this pass actually adds - see below):
About Page **content substance** (distinct from mere existence), and
machine-readable **Organization**/**Person** schema presence (distinct
from GEO's own author-bio-text and generic schema-presence checks).

**Pre-existing infrastructure this pass reuses directly, not duplicates:**

- `HomepageSchemaRenderer`/`SchemaJsonLdRenderer` (Free, `wp_head` output) - both new mechanical fixes write INTO the same `vulopilot_homepage_schema_json` option / `_vulopilot_schema_json` postmeta these already render, as a nested `publisher`/`author` sub-object, rather than needing a second storage key or a second renderer.
- `GeoInsights\CompetitorVisibilityAnalyzer`'s fetch mechanics (`wp_remote_get()` per `geo_competitor_urls` entry) - reused conceptually (same setting, same timeout/sslverify shape) by `BrandCompetitorAnalyzer`, but not the class itself, since it checks a different signal pair (Organization/Person schema, not GEO's own 4 structural signals) - same "different need, not a duplicate" reasoning `ContentGapAnalyzer`'s own docblock gives for the identical choice.
- `GeoInsights\VisibilitySnapshotBuilder`/`VisibilityMonitor`/`VisibilitySnapshotScheduler`'s shape - mirrored, not shared code, for `BrandScoreSnapshotBuilder`/`BrandMonitor`/`BrandScoreSnapshotScheduler` (simpler here: Brand Score is a deterministic composite computed live, never an AI-sampled average, so there's no bounded-sample-batch/nullable-score complexity to carry over).
- `OneClickFix\BulkFixRest`'s "loop the existing single-item call" shape - reused directly by `BrandVisibility\Rest::create_knowledge_panel_optimization()`, which calls `FindingFixRest::resolve_fix()` per auto-discovered finding rather than reimplementing fix resolution.
- `src/pages/BrandVisibility/BrandVisibility.tsx`'s existing page/route/menu entry - extended in place (see below), not superseded by a new page.

## What's genuinely new in this pass

### Free

**`AboutPageAnalysisScanner`** (id `about-page-analysis`, category `brand`)
- deliberately narrower than `GeoTrustSignalsScanner`'s own check (does an
About/Contact page exist *at all*): this only ever runs for a site that
already has one, and asks whether it actually has real substance - a
minimum word count (`brand_about_page_min_words` setting, default 80) and
a real contact signal (an email address or phone-shaped number in its
text). A same-titled but empty About page passes the existence check
while still giving an AI answer engine nothing to cite.

**`OrganizationSchemaScanner`** (id `organization-schema`, category
`brand`) - real `wp_remote_get(home_url('/'))` fetch (same pattern
`StructuredDataValidationScanner` already uses), checking specifically for
an `Organization`/`LocalBusiness` schema.org type - the structured data
Knowledge Panels and AI answer engines read to resolve "who runs this
site," not just "does some schema exist" (`SchemaScanner`'s own, broader
check).

**`AuthorSchemaScanner`** (id `author-schema`, category `brand`) - reads
each published post's own `_vulopilot_schema_json` postmeta (same key
`AeoSchemaScanner` already reads) for a `Person` reference - distinct from
`GeoAuthorInfoScanner`'s check (does the author have a human-visible bio
at all): this is the machine-readable signal, which a bio field alone
doesn't provide.

**Brand/Trust/Authority/Entity Scores** - `GET /brand-intelligence/score`
(`BrandVisibility\Rest`), 4 composite deterministic scores (no AI,
no cost) via `FindingRepository::get_severity_breakdown_for_scanner_ids()`
and the same weighting every other composite score in this codebase uses:

| Score | `scanner_id`s |
|---|---|
| Trust | `geo-trust-signals`, `about-page-analysis` |
| Authority | `geo-eeat-signals`, `geo-author-info`, `author-schema` |
| Entity | `geo-entity-naming-consistency`, `organization-schema` |
| Brand (overall) | union of the 7 above |

Also wired into the Dashboard's `category_scores.brand`
(`Dashboard\Rest\Dashboard::calculate_brand_score()`) and a new `brand` stat
widget (`dashboard-widgets/registry.ts`).

**Brand Intelligence Report** - `Reports\Types\BrandIntelligenceReport`,
same "extends `AbstractReportType` directly, spans a `scanner_id` list
across categories" shape `ContentIntelligenceReport` already establishes.

**Brand Visibility page** (`src/pages/BrandVisibility/BrandVisibility.tsx`)
- extended in place, not replaced: the pre-existing off-site
mention/share-of-voice card (still honestly "Not connected yet" - see
"Tier scoping" below) now sits alongside a real, always-available on-site
section (Brand Score card + 3 findings-table sections grouped by their own
`scanner_id` list), gated on the Brand Intelligence module being active
the same way `Content.tsx`'s own `isContentModuleActive()` gate works.
One page, since both halves answer the same underlying question ("how
visible/trusted is this brand") - the on-site half just doesn't need a
third-party connection to be real today.

## Tier scoping: "Brand Mention Tracking"

Deliberately **not** built as a new, separate off-site tracking feature.
This is the exact same gap `BrandVisibility.tsx`'s own "Not connected yet"
card already documented before this pass (needs a real Ahrefs Brand Radar
connection this codebase has no credentials for) - building a
look-alike feature with fabricated mention/share-of-voice numbers would
violate this codebase's own "nothing fabricated" posture
(`GeoInsights\CompetitorVisibilityAnalyzer`'s own docblock states the
identical constraint for the identical reason). "Brand Monitoring" above
is the real, delivered half of Phase 03's ask - sitewide Brand Score
history and drop alerts, entirely on real, already-collected data; "Brand
Mention Tracking" stays an honest, undelivered gap until a real
third-party data source is connected.

## Extension points added

- `vulopilot_brand_authority_trends_card` / `vulopilot_brand_competitor_comparison_card` / `vulopilot_brand_knowledge_panel_card` (React filters, `@wordpress/hooks`) - same "register a source, don't modify the host" slot pattern `vulopilot_content_topic_authority_card`/`vulopilot_content_gap_analysis_card` already use on the Content page.
- No new PHP registry - the new scanners/REST controllers/report/mechanical fixes all go through the existing `vulopilot_scanner_sources`/`vulopilot_rest_controllers`/`ReportTypeRegistry`/`ScannerFixMap`, exactly as documented in `SCANNERS.md`/`AI-ACTIONS.md`.

## REST routes added

| Route | Plugin | Cost | Notes |
|---|---|---|---|
| `GET /brand-intelligence/score` | Free | None | Brand/Trust/Authority/Entity composite scores |

## What's still not here (honest gaps)

- **Real off-site brand-mention/share-of-voice tracking** - see "Tier
  scoping" above; unchanged by this pass.
- **No scheduled/automatic Competitor Comparison or Knowledge Panel runs**
  - both are manual, action-driven cards on the Brand Visibility page;
  only Authority Trends' own snapshot runs on a cron cadence.
- **`generate-organization-schema`/`generate-author-schema` don't repair
  a malformed EXISTING block** - same posture `generate-homepage-schema`
  already takes for `StructuredDataValidationScanner`'s "existing block is
  broken" finding: guessing what a third-party theme/plugin meant to write
  isn't something this plugin can safely reconstruct.
