# VuloPilot — AI Crawler Analytics module

Companion to [`DATABASE.md`](DATABASE.md), [`SCANNERS.md`](SCANNERS.md),
[`DASHBOARD-WIDGETS.md`](DASHBOARD-WIDGETS.md),
[`AI-VISIBILITY-MODULE.md`](AI-VISIBILITY-MODULE.md), and to `vulopilot-pro`'s
own
[`AI-CRAWLER-ANALYTICS-MODULE.md`](../../../../plugins/vulopilot-pro/docs/AI-CRAWLER-ANALYTICS-MODULE.md)
(the Pro-side file — every file in `modules/AiCrawlerAnalytics/`, in full
detail). Unlike Content
Intelligence/Brand Intelligence (both genuinely new modules built from
scratch), most of this phase's Free scope — AI Crawler Detection, Crawl
Logs, Top Crawled Pages, Crawl Statistics — **already shipped** under
readme.txt's "AI Crawler Traffic Monitoring" feature
(`Services\CrawlerTrafficLogger`, `Repositories\CrawlerVisitRepository`,
`RestAPI\Controllers\CrawlerTraffic`, `src/pages/CrawlerTraffic/`). This
pass's real job was narrower: close the one genuine Free gap ("Blocked
Pages"), then build the Pro layer on top of that existing infrastructure.

## Audit: requested vs. already-shipped

| Requested (Free) | Status |
|---|---|
| AI Crawler Detection | Already shipped — `CrawlerTrafficLogger::maybe_log()` |
| Crawl Logs | Already shipped — `vulopilot_crawler_visits` + `GET /crawler-traffic` |
| Top Crawled Pages | Already shipped — `CrawlerVisitRepository::get_most_crawled_pages()` |
| Blocked Pages | **New this pass** — no per-bot robots.txt Disallow detection existed anywhere; `RobotsTxtScanner` only ever checked the sitewide wildcard case |
| Crawl Statistics | Already shipped — `get_daily_volume()`/`get_bot_last_seen()`/`get_bot_counts()`, `CrawlerSummaryCard.tsx`, the `crawler-traffic` Dashboard widget |

| Requested (Pro) | Status |
|---|---|
| Historical Crawl Trends | New — per-bot daily volume over a longer window than Free's fixed 30-day view |
| AI Visibility Correlation | New — correlates crawl volume against GEO findings, no new storage |
| AI Crawler Alerts | New — daily volume-drop + still-blocked-hit checks |
| AI Monitoring Dashboard | New — `ai-monitoring` Dashboard widget |
| Crawl Reports | New — `Reports\Types` report type over crawler-visit data |

One existing Pro line already covers part of the historical-data story:
`vulopilot-pro`'s `AdvancedReports\Module::extend_crawler_log_retention()`
extends the retention window (30 → 365 days) — that's unchanged by this
pass. "Historical Crawl Trends" is additive on top of it (a longer-range,
per-bot trend view), not a duplicate of it.

## A design decision this pass deliberately did NOT make

`CrawlerTrafficLogger`'s own docblock argues that a per-event log doesn't
need the snapshot-rollup shape Health Score/GEO/Brand's historical trends
use, because `get_daily_volume()` computes a zero-filled daily trend live
and cheaply off the retained raw rows. This pass respects that: "Historical
Crawl Trends" is **not** a new `vulopilot_crawl_trend_history` table — it's
a new aggregate query (`CrawlerVisitRepository::get_daily_volume_by_bot()`)
over the existing `vulopilot_crawler_visits` table, read through a new Pro
route requesting a longer window than Free's summary card does. If
retention ever needs to stretch far enough that querying raw rows becomes
expensive, that's the point to revisit this decision — not now.

## What's genuinely new in this pass

### Free

**`RobotsTxtBotAccess`** (`classes/Services/RobotsTxtBotAccess.php`) — parses
`/robots.txt` into per-user-agent Disallow groups, transient-cached (1
hour) to avoid a remote fetch per scan. Real robots.txt semantics, but
narrow by design (same restraint `RobotsTxtScanner`'s own docblock argues
for): a bot's own named group if one exists, otherwise the wildcard
group's rules — no Allow-precedence, no wildcard path syntax.

**`CrawlerTrafficLogger::get_bot_signatures()`** — the previously-private
`BOT_SIGNATURES` constant is now reachable through a public static getter,
itself run through a new `vulopilot_crawler_bot_signatures` filter so Pro
(or a third party) can extend the detected-bot list without editing this
class — the "register a source, don't modify the host" convention every
other list-shaped registry in this codebase already follows, applied here
for the first time.

**`AiCrawlerBlockedPagesScanner`** (id `ai-crawler-blocked-pages`, category
`seo`, registered by `modules/Seo/Module.php` alongside `RobotsTxtScanner`)
— flags real published pages robots.txt disallows for one *specific* known
AI bot. Deliberately narrower than `RobotsTxtScanner`'s own sitewide
wildcard check: a bare `/` disallow is excluded here (already reported
there), so a page only shows up in this scanner's findings when the block
is genuinely bot-specific. Gated by a new `flag_ai_crawler_blocked_pages`
setting (Scanning → SEO, default on). Findings appear both on the SEO
page's existing "Robots.txt" section and on the Crawler Traffic page's own
new "Blocked pages" card (same `FindingsTable`, two homes — matches
`RedirectAnalysisScanner`'s own precedent of a scanner category appearing
wherever it's contextually useful).

No mechanical (OneClickFix) fix exists for this scanner — unlike Organization/
Author schema, "unblock this page for this bot" would require this codebase
to own full robots.txt generation, which it deliberately doesn't
(`RobotsTxtManager` only appends a `Sitemap:` line to WordPress core's own
virtual output). Left manually actionable, not fabricated.

**Two new `CrawlerVisitRepository` methods**, added to Free's own repository
even though only Pro's UI calls them initially (same "Free owns the table +
query methods, Pro decides which ones its UI calls" posture
`FindingRepository::get_severity_breakdown_for_scanner_ids()` already
established):
- `get_daily_volume_by_bot(int $days)` — per-bot daily volume, zero-filled the same way `get_daily_volume()` already is.
- `get_stats_for_period(string $start, string $end)` — total/by-bot/top-pages for a fixed date range, backing Crawl Reports.

**Settings**: `flag_ai_crawler_blocked_pages` (Scanning → SEO),
`crawler_volume_drop_threshold_percent` (new Scanning → Crawler Analytics
tab), `email_on_crawler_alerts` (Notifications) — same "setting
round-trips through Settings regardless of which tier reads it" posture
`geo_competitor_urls`/`geo_drop_threshold`/`brand_drop_threshold` already
take.

**`Modules/index.ts`** — a catalog entry (`src/components/Modules/index.ts`)
gives this Pro module a real name/description on the Modules admin page,
matching every other Pro-only module folder that has no same-named Free
counterpart. **Its `id` is currently `ai-crawler-intelligence`, not
`ai-crawler-analytics`** — the real backend module id every actual consumer
uses (`SeoContent.ts`'s `moduleEnabled: 'ai-crawler-analytics'` check,
`modules/AiCrawlerAnalytics/src/index.tsx`'s own
`'vulopilot-pro/ai-crawler-analytics'` filter namespace, and
`camel_to_kebab('AiCrawlerAnalytics')` — the folder-name-derived id
`Modules.php` actually resolves). This is the same class of mismatch this
same file's own comments describe having previously broken the GEO and AEO
cards (`geo-ai-understanding`/`aeo-answer-engine`, both fixed to
`geo-insights`): toggling "AI Crawler Intelligence" from the Modules page
calls `set_modules()` with an id that resolves to no real module folder, so
it doesn't actually activate `AiCrawlerAnalytics`. Confirmed by reading the
current `index.ts` — not fixed here, since this pass is docs-only.

### Pro (`modules/AiCrawlerAnalytics/`)

**`CrawlerVisibilityCorrelationAnalyzer`** — for each of the site's
most-crawled pages (Free's own `get_most_crawled_pages()`), resolves the
real post behind the URL (`url_to_postid()`) and counts its open
`geo`-category findings (`FindingRepository`, filtered by
`object_type`/`object_ref` — the same pair `GeoEeatSignalsScanner`'s own
Finding already stores). Correlates against the deterministic, zero-cost
`geo`-category score (`Dashboard`'s own `category_scores.geo`), not
`GeoAnalysis\GeoAnalyzer`'s sparse per-post AI-judged score (only populated
for posts someone explicitly analyzed) or the sitewide-only GEO visibility
history (no per-URL granularity) — the one of the three that's actually
usable per-page. No AI cost, no new storage.

**`CrawlerAlertScheduler` + `CrawlerAlertMonitor`** — same
`wp_next_scheduled()`-guarded daily cron shape
`GeoInsights\VisibilitySnapshotScheduler` uses, simplified: no
snapshot/history table to build (see the design-decision section above),
so the scheduler calls the monitor directly. Two checks, both derived from
data that already exists:
1. **Volume drop** — yesterday's total visit count vs. the trailing 7-day average before it (today is excluded, since a partial day always looks like a drop).
2. **Still-blocked hits** — a known bot keeps visiting a path robots.txt disallows specifically for it. Doesn't read `AiCrawlerBlockedPagesScanner`'s own stored findings — `vulopilot_scan_findings` has no `meta` column (`DATABASE.md`), so that scanner's `array('bot' => ...)` Finding meta is never actually persisted to query back. Instead, `CrawlerAlertMonitor` independently re-derives the same "known bot + its own Disallow paths" check directly against real, recent `crawler_visits` rows — a few duplicated lines rather than a cross-layer dependency, the same trade-off `VisibilityMonitor`'s own docblock documents.

Logs every run to `vulopilot_activity_logs` (event_type
`crawler_alert_check`) regardless of outcome; emails
(`email_on_crawler_alerts`) only when the volume drop crosses
`crawler_volume_drop_threshold_percent` or at least one bot is ignoring a
block — same "log always, alert only past threshold" posture
`VisibilityMonitor`/`BrandMonitor` already establish.

**`Rest.php`** — `GET /crawler-traffic/historical-trends` (per-bot daily
volume over a longer window, default 90 days) and `POST
/crawler-traffic/visibility-correlation`. Registered under array key
`crawler_analytics_pro` (not `crawler_traffic`) — Free's own dispatcher
already claims that key, same key-collision-avoidance convention
`BrandIntelligence\Rest.php`'s own docblock documents. "AI Crawler Alerts"
has no route of its own — the React card reuses Free's existing `GET
/activity-logs?event_type=crawler_alert_check`, same "call the existing
list endpoint" pattern `DASHBOARD-WIDGETS.md` documents for Recent
Activity/Latest Reports/Pending Approval.

**`CrawlReport`** — extends `AbstractReportType` directly (not
`AbstractCategoryReportType` — crawler-visit rows aren't
`vulopilot_scan_findings` rows, so there's no single `category` string to
scope by), registered via `vulopilot_report_type_sources` the same way
`AdvancedReports\Module` already adds `HealthReport`. `generate()` only
ever reads plain SQL from `get_stats_for_period()`, same "never calls out
to anything mid-generation" rule `AiVisibilityReport`'s own docblock
documents.

**React**: `HistoricalCrawlTrendsCard.tsx` (recharts multi-line, one `Line`
per bot, reshaping the per-bot response into one row per date),
`CrawlerVisibilityCorrelationCard.tsx` (action-driven, mirrors
`CompetitorComparisonCard.tsx`'s own "Analyze" button posture),
`CrawlerAlertsCard.tsx` (reads `/activity-logs`), and `AiMonitoringWidget.tsx`
— the first Pro widget to actually use the `vulopilot_dashboard_widgets`
filter slot `DASHBOARD-WIDGETS.md` already documented but nothing had
exercised yet. All three `CrawlerTraffic.tsx` card slots
(`vulopilot_crawler_historical_trends_card`,
`vulopilot_crawler_visibility_correlation_card`,
`vulopilot_crawler_alerts_card`) follow the identical `applyFilters(...,
null)` module-scope resolution pattern `BrandVisibility.tsx`'s own Pro
slots already use.

## Testing

Free: `test-robots-txt-bot-access.php` (parsing/resolution logic),
`test-ai-crawler-blocked-pages-scanner.php` (path-matching logic),
`CrawlerTraffic.test.tsx` + `CrawlerTraffic.pro-filters.test.tsx` (module
gating + Pro slot resolution, mirroring `BrandVisibility`'s own test
pair). A new `@zyra/table` Jest stub
(`tests/js/__mocks__/zyra-table.tsx`) was added alongside the existing
`@zyra/core`/`@zyra/components`/`@zyra/inputs` ones — needed because
`CrawlerTraffic.tsx` renders a raw `TableCard` directly (not only through
`FindingsTable.tsx`, which every other page's test already mocks away
whole), and no test in this codebase had exercised that import path
before.

Pro: `test-crawler-visibility-correlation-analyzer.php`,
`test-crawler-alert-monitor.php`, `test-crawl-report.php` (all Mockery/
Brain\Monkey unit tests, same posture every other Pro test in this suite
uses), plus Jest tests for all 4 new React components.

## What's not here yet

- **A shared PHP/TS source of truth for the AI-bot list** — `BOT_SIGNATURES`
  (PHP, detection) and `CrawlerTraffic.tsx`'s filter-pill options (TS,
  display — now hand-mirrored for all 9 bots, per that component's own
  docblock) still have to be updated by hand in two places;
  `vulopilot_crawler_bot_signatures` only solves the PHP side.
- **Response-code-aware "blocked"** — both `AiCrawlerBlockedPagesScanner`
  and `CrawlerAlertMonitor` treat "blocked" as "robots.txt disallows it,"
  not "the bot actually received a 403/redirect at request time" —
  `CrawlerTrafficLogger::maybe_log()` never inspects the response, only
  the request, so no code path could currently tell the difference.
