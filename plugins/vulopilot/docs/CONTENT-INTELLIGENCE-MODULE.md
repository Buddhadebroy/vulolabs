# VuloPilot - Content Intelligence module

## Audit: requested vs. already-shipped

**Already shipped, unchanged by this pass:**

| Requested | Already implemented as |
|---|---|
| Thin Content Detection | `SeoAnalysis\Basic\ThinContentScanner` (`thin-content`, category `seo`) |
| Duplicate Content Detection | `DuplicateContentScanner` (`duplicate-content`) |
| Heading Analysis | `HeadingStructureScanner` (`heading-structure`) |
| Internal Link Analysis | `InternalLinkingScanner` (`internal-linking`) |

Thin Content/Duplicate Content/Heading Structure/Internal Linking scanners
are **reused, not recategorized** - they stay `seo`-category (so
`SEO.tsx`'s own `SEO_SECTIONS` grouping doesn't break) and are additionally
read into Content Intelligence's own composite score/page/report via an
explicit `scanner_id` list, not a `category` filter. See
`FindingRepository::get_severity_breakdown_for_scanner_ids()`'s own docblock
for the mechanism.

## What's genuinely new in this pass

### Free

**`ReadabilityScanner`** (`modules/ContentOptimization/Scanners/ReadabilityScanner.php`, id
`readability`, new category `content`) - the one genuinely new scanner. Real
Flesch Reading Ease score (`206.835 - 1.015*(words/sentences) -
84.6*(syllables/words)`, clamped 0–100), skipping posts under 100 words
(already flagged by `ThinContentScanner` for a different reason). Threshold
is a real setting, `content_readability_min_score` (Scanning → Content
Intelligence, default 50 - Flesch's own published "Fairly Difficult"
boundary), not a hardcoded number.

**Content Score** - `GET /content-intelligence/score`
(`modules/ContentOptimization/Rest/ContentIntelligence.php`) - a composite score
over `readability` + the 4 reused `seo` scanners + `orphan-pages`, same
weighting formula (`100 - critical*15 - high*8 - medium*3 - low*1`) every
other category score already uses. Also wired into the Dashboard's
`category_scores.content` (`Dashboard\Rest\Dashboard`'s
`calculate_content_score()`) and a new `content` stat widget
(`dashboard-widgets/registry.ts`).

**Content Reports** - `Reports\Types\ContentIntelligenceReport`. Extends
`AbstractReportType` directly rather than `AbstractCategoryReportType` - that
base only scopes to one category string, but this report spans the same
cross-category `scanner_id` list the Content Score does (`orphan-pages`
included here, since a report period naturally includes sitewide findings
too, unlike the per-post `ContentAnalyzer`).

## Extension points added

- `vulopilot_content_topic_authority_card` / `vulopilot_content_gap_analysis_card` (React filters, `@wordpress/hooks`) - same "register a source, don't modify the host" slot pattern GEO.tsx's own `GeoScoreCard`/`GeoVisibilitySummary` slots use.
- No new PHP registry - the new scanner/REST controllers/report/AI actions all go through the existing `vulopilot_scanner_sources`/`vulopilot_rest_controllers`/`ReportTypeRegistry`/`vulopilot_ai_action_sources`, exactly as documented in `SCANNERS.md`/`AI-ACTIONS.md`.

## REST routes added

| Route | Plugin | Cost | Notes |
|---|---|---|---|
| `GET /content-intelligence/score` | Free | None | Composite Content Score (dashboard/page use) |

## What's still not here (honest gaps)

- **No Content Gap history / trend** - `ContentGapAnalyzer` stores one
  cached snapshot, overwritten each run, the same pre-history-table shape
  `VisibilitySnapshotBuilder` had before GEO's own Historical Trends pass -
  a growing history table wasn't requested for this module.
- **No scheduled/automatic Content Gap regeneration** - always a manual
  "Regenerate" action from the Content page; no cron trigger the way GEO's
  `VisibilitySnapshotScheduler` runs on a cadence.
- **`ExpandContentAction`/`RewriteContentAction` are standalone, not
  scanner-mapped** - by design (see above), but this means Health/Content
  page "one-click fix" flows never surface them; they're only reachable via
  the Content page's own cards/bulk-optimize, not `FindingsTable`'s per-row
  fix button.
