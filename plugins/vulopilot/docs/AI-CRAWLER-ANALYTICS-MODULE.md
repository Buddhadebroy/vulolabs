# VuloPilot - AI Crawler Analytics module

## Audit: requested vs. already-shipped

| Requested (Free) | Status |
|---|---|
| AI Crawler Detection | Already shipped - `CrawlerTrafficLogger::maybe_log()` |
| Crawl Logs | Already shipped - `vulopilot_crawler_visits` + `GET /crawler-traffic` |
| Top Crawled Pages | Already shipped - `CrawlerVisitRepository::get_most_crawled_pages()` |
| Blocked Pages | **New this pass** - no per-bot robots.txt Disallow detection existed anywhere; `RobotsTxtScanner` only ever checked the sitewide wildcard case |
| Crawl Statistics | Already shipped - `get_daily_volume()`/`get_bot_last_seen()`/`get_bot_counts()`, `CrawlerSummaryCard.tsx`, the `crawler-traffic` Dashboard widget |

| Requested | Status |
|---|---|
| Historical Crawl Trends | New - per-bot daily volume over a longer window than Free's fixed 30-day view |
| AI Visibility Correlation | New - correlates crawl volume against GEO findings, no new storage |
| AI Crawler Alerts | New - daily volume-drop + still-blocked-hit checks |
| AI Monitoring Dashboard | New - `ai-monitoring` Dashboard widget |
| Crawl Reports | New - `Reports\Types` report type over crawler-visit data |

## What's genuinely new in this pass

### Free

**`RobotsTxtBotAccess`** (`classes/SeoVisibility/RobotsTxtBotAccess.php`) - parses
`/robots.txt` into per-user-agent Disallow groups, transient-cached (1
hour) to avoid a remote fetch per scan. Real robots.txt semantics, but
narrow by design (same restraint `RobotsTxtScanner`'s own docblock argues
for): a bot's own named group if one exists, otherwise the wildcard
group's rules - no Allow-precedence, no wildcard path syntax.

**`AiCrawlerBlockedPagesScanner`** (id `ai-crawler-blocked-pages`, category
`seo`, registered by `modules/TechnicalSeo/Module.php` alongside `RobotsTxtScanner`)
- flags real published pages robots.txt disallows for one *specific* known
AI bot. Deliberately narrower than `RobotsTxtScanner`'s own sitewide
wildcard check: a bare `/` disallow is excluded here (already reported
there), so a page only shows up in this scanner's findings when the block
is genuinely bot-specific. Gated by a new `flag_ai_crawler_blocked_pages`
setting (Scanning → SEO, default on). Findings appear both on the SEO
page's existing "Robots.txt" section and on the Crawler Traffic page's own
new "Blocked pages" card (same `FindingsTable`, two homes - matches
`RedirectAnalysisScanner`'s own precedent of a scanner category appearing
wherever it's contextually useful).

No mechanical (OneClickFix) fix exists for this scanner - unlike Organization/
Author schema, "unblock this page for this bot" would require this codebase
to own full robots.txt generation, which it deliberately doesn't
(`RobotsTxtManager` only appends a `Sitemap:` line to WordPress core's own
virtual output). Left manually actionable, not fabricated.

**Settings**: `flag_ai_crawler_blocked_pages` (Scanning → SEO),
`crawler_volume_drop_threshold_percent` (new Scanning → Crawler Analytics
tab), `email_on_crawler_alerts` (Notifications) - same "setting
round-trips through Settings regardless of which tier reads it" posture
`geo_competitor_urls`/`geo_drop_threshold`/`brand_drop_threshold` already
take.

## What's not here yet

- **A shared PHP/TS source of truth for the AI-bot list** - `BOT_SIGNATURES`
  (PHP, detection) and `CrawlerTraffic.tsx`'s filter-pill options (TS,
  display - now hand-mirrored for all 9 bots, per that component's own
  docblock) still have to be updated by hand in two places;
  `vulopilot_crawler_bot_signatures` only solves the PHP side.
- **Response-code-aware "blocked"** - both `AiCrawlerBlockedPagesScanner`
  and `CrawlerAlertMonitor` treat "blocked" as "robots.txt disallows it,"
  not "the bot actually received a 403/redirect at request time" -
  `CrawlerTrafficLogger::maybe_log()` never inspects the response, only
  the request, so no code path could currently tell the difference.
