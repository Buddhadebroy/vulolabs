# AI Visibility: AEO, Visibility Score and Schema

Answer Engine Optimization (AEO) and the combined visibility score. User view: [../user/AI-VISIBILITY.md](../user/AI-VISIBILITY.md). GEO scanning is in [GEO-MODULE](GEO-MODULE.md), crawler tracking in [AI-CRAWLER-ANALYTICS-MODULE](AI-CRAWLER-ANALYTICS-MODULE.md).

## Components

| Component | Role |
|---|---|
| `SeoVisibility\AeoSchemaScanner` | Flags posts shaped like an FAQ or how-to that lack the matching structured data (category `geo`) |
| `Content\FaqOpportunityRule`, `Content\MissingSummaryBlockRule` | Recommendations to add an FAQ or a summary block |
| `SeoVisibility\SchemaCoverageAnalyzer` | Snapshot of which pages have valid JSON-LD, refreshed after each scan (`vulopilot_scan_completed`) |
| `SeoVisibility\SchemaPageInspector` | Fetches one page and extracts its JSON-LD (used by the Inspector) |
| `SeoVisibility\Rest\Schema` | `POST /schema/coverage`, `/schema/inspect`, `/schema/inspectable-pages` |
| `SeoVisibility\Rest\Visibility` | `GET /visibility/score`, `/visibility/progress`, `/visibility/traffic-sources` |
| FAQ block (`vulopilot/faq`) | Emits FAQPage JSON-LD |

## Visibility score

`GET /visibility/score` combines four area scores that are already computed elsewhere: Brand Visibility, SEO Health, GEO Visibility and Crawl & URLs. It reads scores from finding severity counts; it does not make AI calls. `/visibility/progress` returns the trend and `/visibility/traffic-sources` reads Google Analytics sessions by channel when a GA4 property is connected.

Outbound HTTP (the coverage refresh and the inspector) only happens on an explicit request or after a scan, never on every page load.

## Engine testing

The AEO tab's "Test this page" runs a single-page citation check through `AiRequestSender`. It needs the AI connection.

## Class reference

| Class | File | What it does |
|---|---|---|
| `AeoSchemaScanner` | `classes/SeoVisibility/AeoSchemaScanner.php` | AEO (Answer Engine Optimization) - the one GEO check this pass adds that the existing 9 `geo`-category scanners don't already cover: whether a post whose own content is *already shaped* like an answer-engine-ready FAQ or HowTo (qu |
| `SchemaCoverageAnalyzer` | `classes/SeoVisibility/SchemaCoverageAnalyzer.php` | Snapshot of which pages have valid JSON-LD. |
| `SchemaPageInspector` | `classes/SeoVisibility/SchemaPageInspector.php` | Real single-page JSON-LD inspection for the "Schema & Knowledge" tab's own Inspector section - a real `wp_remote_get()` of the requested page plus the exact same `StructuredDataValidationScanner::extract_json_ld_blocks()` extracti |
| `Schema` | `classes/SeoVisibility/Rest/Schema.php` | `POST /schema/inspect` backs the Inspector section's real single-page checker (SchemaPageInspector) - POST, not GET, same "real outbound HTTP only on explicit request" reasoning as `/schema/coverage`. |
| `Visibility` | `classes/SeoVisibility/Rest/Visibility.php` | `GET /visibility/score` / `GET /visibility/progress` - back the "SEO & Visibility → Overview" tab's own real dashboard (OverviewTab.tsx): one combined score across the 4 real free-tier areas already scored elsewhere on this plugin |
| `FaqOpportunityRule` | `classes/Content/FaqOpportunityRule.php` | Turns Geo\Scanners\GeoFaqOpportunityScanner's "no FAQ-style questions" Finding into a recommendation to draft one with AI - good FAQ questions have to actually anticipate what a reader would ask about this specific content, which  |
| `MissingSummaryBlockRule` | `classes/Content/MissingSummaryBlockRule.php` | Turns Geo\Scanners\GeoSummaryBlockScanner's "no upfront summary" Finding into a recommendation to draft one with AI - a good summary has to actually distill this specific content's key points, which needs the content itself. |

Hooks and routes registered by these classes:

- `Schema` - ; routes: `/schema/coverage`, `/schema/inspect`, `/schema/inspectable-pages`
- `Visibility` - ; routes: `/visibility/progress`, `/visibility/score`, `/visibility/traffic-sources`
