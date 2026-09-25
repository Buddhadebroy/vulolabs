# AI Crawler Tracking

Detects and reports visits by known AI crawlers. User view: [../user/AI-VISIBILITY.md](../user/AI-VISIBILITY.md#crawl--urls-who-visits-your-site).

```
front-end request -> CrawlerTrafficLogger (template_redirect) -> matches User-Agent to a bot signature
   -> CrawlerVisitRepository::insert -> table vulopilot_crawler_visits
REST /crawler-traffic, /crawler-traffic/summary, /crawler-traffic/analytics -> React Crawl & URLs tab and Dashboard widget
```

## Detection

`CrawlerTrafficLogger` matches the request's user agent against `BOT_SIGNATURES` (GPTBot, ChatGPT-User, ClaudeBot, anthropic-ai, PerplexityBot, Bytespider, CCBot, Google-CloudVertexBot, Amazonbot and others). Extend the list with the `vulopilot_crawler_bot_signatures` filter.

It records only the bot name, user agent, requested URL and whether the response was a 404. It never stores IP addresses or other visitor data. Logging is gated by the setting `enable_crawler_tracking`.

## Retention

Rows older than `log_retention` days (default 30) are removed. Override with the `vulopilot_crawler_log_retention_days` filter.

## Robots and blocked pages

- `RobotsTxtBotAccess` parses `/robots.txt` into per-bot Disallow groups (cached for an hour).
- `TechnicalSeo\Scanners\AiCrawlerBlockedPagesScanner` (category `seo`) reports published pages that a specific AI bot is told not to crawl; setting `flag_ai_crawler_blocked_pages`.
- The "Crawl Health" card combines robots.txt reachability, sitemap presence and blocked bots.

## Alerts

Crawler alerts (blocked, access limited, traffic drop, inactive, new crawler) are configured in Settings -> Notifications and evaluated by the daily crawler monitor. The traffic drop threshold is `crawler_volume_drop_threshold_percent` (default 50).

## Settings

| Setting key | Default |
|---|---|
| `email_on_crawler_alerts` | `array()` |
| `flag_ai_crawler_blocked_pages` | `array( 'flag_ai_crawler_blocked_pages' )` |
| `enable_crawler_tracking` | `array( 'enable_crawler_tracking' )` |
| `log_retention` | `'30'` |
| `crawler_volume_drop_threshold_percent` | `50` |
| `crawler_alerts` | `array( ... )` |
| `crawler_alert_last_test_sent` | `''` |

## Class reference

| Class | File | What it does |
|---|---|---|
| `CrawlerTrafficLogger` | `classes/SeoVisibility/CrawlerTrafficLogger.php` | Detects AI crawlers by user agent and logs each visit. |
| `CrawlerVisitRepository` | `classes/SeoVisibility/CrawlerVisitRepository.php` | Storage for `vulopilot_crawler_visits`. |
| `RobotsTxtBotAccess` | `classes/SeoVisibility/RobotsTxtBotAccess.php` | Parses `/robots.txt` into per-user-agent Disallow groups, scoped to the known AI bot tokens (CrawlerTrafficLogger::get_bot_signatures()) - the one piece Seo\Scanners\RobotsTxtScanner deliberately doesn't cover (its own docblock: a |
| `CrawlerTraffic` | `classes/SeoVisibility/Rest/CrawlerTraffic.php` | - |
| `AiCrawlerBlockedPagesScanner` | `modules/TechnicalSeo/Scanners/AiCrawlerBlockedPagesScanner.php` | - |

Hooks and routes registered by these classes:

- `CrawlerTrafficLogger` - hooks: `init`, `template_redirect`
- `CrawlerTraffic` - ; routes: `/crawler-traffic`, `/crawler-traffic/analytics`, `/crawler-traffic/summary`
