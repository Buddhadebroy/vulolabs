# VuloPilot - AI Visibility module

## Audit: requested vs. already-shipped

Before writing any code, every requested item was checked against what
already existed, since re-implementing an already-shipped feature (or
silently moving it behind a paywall it was never behind) would violate this
codebase's own "don't introduce duplicated systems" rule.

**Already shipped, unchanged by this pass:**

| Requested | Already implemented as |
|---|---|
| AI Visibility Scanner / GEO Scanner | The 9 `geo`-category scanners (GEO-MODULE.md) |
| Visibility Score | `GeoAnalyzer::analyze()`'s `overall_score` (per-post) |
| Missing FAQ Detection | `GeoFaqOpportunityScanner` |
| Missing Author Detection | `GeoAuthorInfoScanner` |
| Recommendations | `GeoAnalyzer`'s AI-generated suggestions list |
| Dashboard Widget | `geo` stat widget (`registry.ts`, backed by `Dashboard.php`'s `category_scores.geo`) |
| Report | `Reports\Types\AiVisibilityReport` (category `geo`) |
| Manual Scan | `ScanRunner`, already supports category `geo` |

## What's genuinely new in this pass

### Free

**`AeoSchemaScanner`** (`classes/SeoVisibility/AeoSchemaScanner.php`, id
`aeo-schema`, category `geo`) - covers both "AEO Scanner" and "Missing Schema
Detection" as the same real check (deliberately not two overlapping
scanners): flags a post whose content is *already shaped* like FAQ content
(question-phrased headings - the same signal `GeoFaqOpportunityScanner`
uses) or HowTo content (an ordered list with 3+ steps) but has no matching
`FAQPage`/`HowTo` schema.org markup saved to its `_vulopilot_schema_json`
postmeta (`SeoVisibility\SchemaJsonLdRenderer`'s own key). Narrower than
`GeoFaqOpportunityScanner` on purpose - that scanner flags content with *no*
FAQ shape at all; this one only fires once the shape already exists but the
schema an answer engine would actually read doesn't.

## Extension points added

- `vulopilot_finding_bulk_fix_handler` (React filter) - bulk-action counterpart to the existing `vulopilot_finding_fix_handler`.

No new PHP registry was introduced - every new scanner/REST controller
still goes through `vulopilot_scanner_sources`/`vulopilot_rest_controllers`,
exactly as documented in `GEO-MODULE.md`/`SCANNERS.md`.

## Tests

`tests/php/` (both plugins - this pass is what scaffolded the directory
`phpunit.xml.dist` already pointed at but that didn't exist yet). Uses
Brain\Monkey (already a dev dependency) for fast, isolated unit tests over
deterministic logic - not a full `wp-phpunit` integration bootstrap against a
real WordPress+MySQL install, which is real infrastructure this pass didn't
stand up. Covers `AeoSchemaScanner`'s content-shape detection,
`CompetitorVisibilityAnalyzer`'s structural-signal regexes, and
`GeoVisibilityHistoryRepository`'s table-key wiring. Run with
`vendor/bin/phpunit` from either plugin directory.

## What's still not here (honest gaps)

- **Real off-site brand-mention tracking** - Competitor Visibility above is
  a real, on-page structural comparison, not the Ahrefs-Brand-Radar-backed
  share-of-voice feature `BrandVisibility.tsx` still honestly says it needs.
- **A live post-search picker, bulk/sitewide *AI-scored* GEO scoring, and
  per-post GEO score history** - still open per `GEO-MODULE.md`'s own "What's
  not here yet" (the *sitewide sample average* now has history via this
  pass; a single post's own AI-judged score still only ever has its latest
  value in postmeta).
