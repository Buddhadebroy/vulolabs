# REST API Reference

Every controller registers under the namespace `vulopilot/v1` (`VuloPilot()->rest_namespace`). All routes require an authenticated administrator unless a controller says otherwise; the plugin also enforces a nonce (`X-WP-Nonce` from `vulopilotAppLocalizer.nonce`) on cookie-authenticated calls.

The tables below are generated from the code: one table per source folder, with the routes each controller registers. For the behaviour of a route read the controller file named beside it.

Add your own controller through the `vulopilot_rest_controllers` filter (see [ARCHITECTURE](ARCHITECTURE.md#4-extension-points)).

## Core and dashboard

| Class | File | What it does |
|---|---|---|
| `Rest` | `classes/Rest.php` | VuloPilot Rest class. |
| `ActivityLogs` | `classes/Dashboard/Rest/ActivityLogs.php` | GET /activity-logs backs src/pages/Activity/Activity.tsx's table. |
| `Dashboard` | `classes/Dashboard/Rest/Dashboard.php` | GET /dashboard - the summary object the Dashboard page's widgets read (src/dashboard-widgets/registry.ts's DashboardSummary interface). |
| `DashboardLayout` | `classes/Dashboard/Rest/DashboardLayout.php` | GET/POST /dashboard-layout backs the Dashboard page's drag-and-drop widget grid (src/dashboard-widgets/DashboardGrid.tsx). |

Hooks and routes registered by these classes:

- `Rest` - hooks: `rest_api_init`
- `ActivityLogs` - routes: `/activity-logs`
- `Dashboard` - routes: `/dashboard`
- `DashboardLayout` - routes: `/dashboard-layout`

## Settings and connections

| Class | File | What it does |
|---|---|---|
| `GoogleServices` | `classes/Settings/Rest/GoogleServices.php` | Backs Settings → Connections → Google Services' real "Connect Google Services" flow (GoogleServicesPanel.tsx) and the Keywords tab's own real connection-status read (KeywordsTab.tsx). |
| `Settings` | `classes/Settings/Rest/Settings.php` | GET/POST /settings backs src/pages/Settings/Settings.tsx, now built on zyra's real settings framework (`InputRenderer`/`NavigatorComponent`, `getAvailableSettings`/`getSettingById` from zyra's core module - see the free vulolabs p |
| `AiCredits` | `classes/AiAssistant/Rest/AiCredits.php` | Backs the AI Credits indicator/claim CTA (VuloPilot brief §4/§21) - a real `GET .../status` (composes AiCreditsConnection + the underlying VuloCloudAccountConnection's own status, see that class's own get_status() docblock) and a  |
| `AiHistory` | `classes/AiAssistant/Rest/AiHistory.php` | GET /ai-history backs src/pages/AIAssistant/AIAssistant.tsx's table. |
| `VuloCloudAiConnection` | `classes/AiAssistant/Rest/VuloCloudAiConnection.php` | GET /vulocloud-ai-connection, GET /vulocloud-ai-connection/broker-authorize-url - backs src/components/Settings/VuloCloudAiConnectionPanel.tsx (Settings → Connections → VuloCloud AI): the "Connect to VuloCloud" / "Disconnect" sect |

Hooks and routes registered by these classes:

- `GoogleServices` - routes: `/google-services/adsense-accounts`, `/google-services/analytics-accounts`, `/google-services/analytics-data-streams`, `/google-services/authorize-url`, `/google-services/disconnect`, `/google-services/search-console-sites`, `/google-services/select-adsense-account`, `/google-services/select-analytics-property`, `/google-services/select-search-console-site`, `/google-services/status`, `/google-services/test-connections`
- `Settings` - routes: `/`, `/settings`, `/settings/clear-cache`, `/settings/reset`, `/settings/reset-ai-visibility-scans`, `/settings/test-crawler-alert`, `/settings/test-email`, `/settings/test-pagespeed`, `/settings/test-report`, `/settings/verify-webmaster`
- `AiCredits` - routes: `/ai-credits/disconnect`, `/ai-credits/refresh-balance`, `/ai-credits/status`
- `AiHistory` - routes: `/ai-history`
- `VuloCloudAiConnection` - routes: `/vulocloud-ai-connection`, `/vulocloud-ai-connection/broker-authorize-url`

## SEO and crawling

| Class | File | What it does |
|---|---|---|
| `CrawlerTraffic` | `classes/SeoVisibility/Rest/CrawlerTraffic.php` | Backs src/pages/CrawlerTraffic/CrawlerTraffic.tsx (AI Crawler Traffic Monitoring, readme.txt). |
| `IndexNow` | `classes/SeoVisibility/Rest/IndexNow.php` | Backs the Instant Indexing tab's two action-driven cards that don't fit Controllers\Settings' per-field auto-save model (Settings.tsx's own "special component" escape hatch - see that class's docblock): the "Submit URLs" textarea/ |
| `PostSeo` | `classes/SeoVisibility/Rest/PostSeo.php` | `POST /post-seo/{id}/analyze` - the one part of the post-editor metabox that needs a custom endpoint. |
| `RobotsSitemap` | `classes/SeoVisibility/Rest/RobotsSitemap.php` | `GET /robots-sitemap/robots` and `GET /robots-sitemap/sitemap` - real, live fetch-and-parse of this site's OWN actual `/robots.txt` and sitemap index, backing RobotsSitemapSection.tsx's "Robots.txt Analysis"/"XML Sitemap Overview" |
| `Schema` | `classes/SeoVisibility/Rest/Schema.php` | `POST /schema/inspect` backs the Inspector section's real single-page checker (SchemaPageInspector) - POST, not GET, same "real outbound HTTP only on explicit request" reasoning as `/schema/coverage`. |
| `Visibility` | `classes/SeoVisibility/Rest/Visibility.php` | `GET /visibility/score` / `GET /visibility/progress` - back the "SEO & Visibility → Overview" tab's own real dashboard (OverviewTab.tsx): one combined score across the 4 real free-tier areas already scored elsewhere on this plugin |
| `BrokenLinksStats` | `classes/Content/Rest/BrokenLinksStats.php` | `GET /broken-links/stats` - backs BrokenLinksTab.tsx's own "Link health"/"Coverage" tiles (SEO & Visibility → Broken Links) with real numbers: BrokenLinksScanner::STATS_OPTION/BrokenImagesScanner::STATS_OPTION, each written fresh  |
| `ContentAssistant` | `classes/Content/Rest/ContentAssistant.php` | `POST /content-assistant/chat` - the conversational turn for "Create Content"'s AI Content Assistant sidebar (src/pages/Content/AiContentAssistantSidebar.tsx). |
| `NotFoundLogs` | `classes/Content/Rest/NotFoundLogs.php` | GET /not-found-logs, POST /not-found-logs/{id}/delete (dismiss a log entry), POST /not-found-logs/{id}/convert (turn it into a real redirect) - backs the Redirects page's own "404 Log" table. |
| `Redirects` | `classes/Content/Rest/Redirects.php` | GET/POST /redirects, POST /redirects/{id}, POST /redirects/{id}/delete - the "Redirects & 404s" feature's own CRUD surface, backing src/pages/Redirects/Redirects.tsx. |

Hooks and routes registered by these classes:

- `CrawlerTraffic` - routes: `/crawler-traffic`, `/crawler-traffic/analytics`, `/crawler-traffic/summary`
- `IndexNow` - routes: `/indexnow/history`, `/indexnow/submit`
- `PostSeo` - routes: `/post-seo/(?P<id>\d+)/analyze`
- `RobotsSitemap` - routes: `/robots-sitemap/robots`, `/robots-sitemap/sitemap`
- `Schema` - routes: `/schema/coverage`, `/schema/inspect`, `/schema/inspectable-pages`
- `Visibility` - routes: `/visibility/progress`, `/visibility/score`, `/visibility/traffic-sources`
- `BrokenLinksStats` - routes: `/broken-links/stats`
- `ContentAssistant` - routes: `/content-assistant/chat`
- `NotFoundLogs` - routes: `/not-found-logs`, `/not-found-logs/(?P<id>\d+)/convert`, `/not-found-logs/(?P<id>\d+)/delete`
- `Redirects` - routes: `/redirects`, `/redirects/(?P<id>\d+)`, `/redirects/(?P<id>\d+)/delete`, `/redirects/health`

## Performance, security, site health, automations, reports

| Class | File | What it does |
|---|---|---|
| `CoreWebVitals` | `classes/Performance/Rest/CoreWebVitals.php` | `GET /core-web-vitals` - backs "Performance" Overview's PerformanceScoreCard.tsx Core Web Vitals tiles. |
| `CoreWebVitalsBeaconRest` | `classes/Performance/Rest/CoreWebVitalsBeaconRest.php` | `POST /performance-vitals-beacon` - this codebase's first public, anonymous REST route (confirmed via a full audit: every other `permission_callback` in this plugin is `current_user_can('manage_options')`). |
| `EfficiencyChecks` | `classes/Performance/Rest/EfficiencyChecks.php` | GET /efficiency-checks - backs "Protect My Site" → Performance tab. |
| `PageSpeed` | `classes/Performance/Rest/PageSpeed.php` | `GET /page-speed` lists real per-page speed results plus a real summary and `top_issues` (PageSpeedRepository::get_top_issues() - the real, deduplicated `main_issue` values grouped by how many pages they affect, backing the "Perfo |
| `PerformanceActions` | `classes/Performance/Rest/PerformanceActions.php` | `POST /performance-actions/{action_id}` - backs "Performance" Overview's Quick Actions card (QuickActionsCard.tsx). |
| `PerformanceRealtime` | `classes/Performance/Rest/PerformanceRealtime.php` | `GET /performance-realtime` - backs "Performance" Overview's RealTimeMonitoringCard.tsx (Server Response Time, Page Views Last 5 Min) and MetricsGrid.tsx's "Performance Monitor" tile (Active vs. |
| `PerformanceScoreSnapshots` | `classes/Performance/Rest/PerformanceScoreSnapshots.php` | `GET /performance-score-snapshots?days=N` - backs SpeedHistoryCard.tsx's trend chart. |
| `SecurityScoreSnapshots` | `classes/Security/Rest/SecurityScoreSnapshots.php` | `GET /security-score-snapshots?days=N` - backs SecurityTrendCard.tsx's trend chart. |
| `Backups` | `classes/SiteHealth/Rest/Backups.php` | `GET /backups` lists real backup runs; `POST /backups` starts a real manual backup (never runs synchronously - `VuloPilot()->backup_manager` processes it via WP-Cron in small batches, same "GET lists, POST triggers, persistence ha |
| `PluginOverlap` | `classes/SiteHealth/Rest/PluginOverlap.php` | GET /plugin-overlap - backs "Protect My Site" → Files & Plugins' own "VuloPilot already covers this" card. |
| `AutomationDashboardStats` | `classes/Automations/Rest/AutomationDashboardStats.php` | - |
| `Automations` | `classes/Automations/Rest/Automations.php` | GET /automations backs src/pages/Automations/Automations.tsx's table. |
| `ReportRepository` | `classes/Reports/ReportRepository.php` | Persistence for vulopilot_reports (DATABASE.md). |
| `History` | `classes/Reports/Rest/History.php` | GET /history backs the AI Copilot page's History tab (HistoryTab.tsx) - a real, day-groupable activity timeline, distinct from `GET /activity-logs` (ActivityLogs.php, Free, backs Reports > Activity's own flat, unfiltered table): t |

Hooks and routes registered by these classes:

- `CoreWebVitals` - routes: `/core-web-vitals`
- `CoreWebVitalsBeaconRest` - routes: `/performance-vitals-beacon`
- `EfficiencyChecks` - routes: `/efficiency-checks`
- `PageSpeed` - routes: `/page-speed`
- `PerformanceActions` - hooks: `wp_editor_set_quality`; routes: `/performance-actions/(?P<action_id>[a-z-]+)`
- `PerformanceRealtime` - routes: `/performance-realtime`
- `PerformanceScoreSnapshots` - routes: `/performance-score-snapshots`
- `SecurityScoreSnapshots` - routes: `/security-score-snapshots`
- `Backups` - routes: `/backups`, `/backups/(?P<id>\d+)`, `/backups/(?P<id>\d+)/download`, `/backups/(?P<id>\d+)/restore`
- `PluginOverlap` - routes: `/plugin-overlap`
- `AutomationDashboardStats` - routes: `/automation-dashboard-stats`
- `Automations` - routes: `/automations`, `/automations/(?P<id>\d+)`, `/automations/(?P<id>\d+)/run`
- `History` - routes: `/history`, `/history/(?P<id>\d+)`

## Module controllers

| Class | File | What it does |
|---|---|---|
| `AiActionRuns` | `modules/AiCopilot/Rest/AiActionRuns.php` | GET /ai-action-runs backs the Dashboard's "Pending Approval" widget. |
| `Copilot` | `modules/AiCopilot/Rest/Copilot.php` | Reuses VuloPilot()->ai_request_sender (AI\AiRequestSender) exactly like ContentAssistant.php and GeoAnalyzer already do - same safety-validate → send → sanitize sequence, and every call is automatically recorded to `vulopilot_ai_h |
| `Geo` | `modules/GeoAnalysis/Rest/Geo.php` | `GET /geo/score` - a real, deterministic GEO Score (no AI, no cost) for the GEO tab's own "GEO Score" card (SEO & Visibility → GEO). |
| `GeoAnalysis` | `modules/GeoAnalysis/Rest/GeoAnalysis.php` | - |
| `LlmsTxt` | `modules/GeoAnalysis/Rest/LlmsTxt.php` | GET /llms-txt/regenerate backs the "Regenerate" button on Crawl & URLs → Robots & Sitemap (src/pages/GEO/CrawlRobotsSitemapSection.tsx; moved there from Settings → AI Visibility) - returns a fresh GeoAnalysis\LlmsTxtGenerator::gen |
| `BrandIntelligence` | `modules/BrandVisibility/Rest/BrandIntelligence.php` | `GET /brand-intelligence/score` - Brand Intelligence's composite, deterministic scores (no AI, no cost): an overall "Brand Score" plus three named sub-scores (Trust, Authority, Entity), each scoped to its own `scanner_id` list via |
| `EntityExtraction` | `modules/KnowledgeGraph/Rest/EntityExtraction.php` | `GET /entities` backs src/pages/KnowledgeGraph/KnowledgeGraph.tsx - Services\EntityExtractor's own docblock has the full extraction design. |
| `ContentIntelligence` | `modules/ContentOptimization/Rest/ContentIntelligence.php` | `GET /content-intelligence/score` - the composite, deterministic "Content Score" (no AI, no cost). |

Hooks and routes registered by these classes:

- `AiActionRuns` - routes: `/ai-action-runs`, `/ai-action-runs/(?P<id>\d+)/approve`, `/ai-action-runs/(?P<id>\d+)/reject`, `/ai-action-runs/(?P<id>\d+)/rollback`
- `Copilot` - routes: `/copilot/chat`, `/copilot/conversations`, `/copilot/conversations/(?P<id>\d+)`
- `Geo` - routes: `/geo/progress`, `/geo/score`
- `GeoAnalysis` - routes: `/geo-analysis/pages`, `/geo-analysis/top-pages`
- `LlmsTxt` - routes: `/llms-txt/regenerate`
- `BrandIntelligence` - routes: `/brand-intelligence/score`
- `EntityExtraction` - routes: `/entities`, `/entities/business-name-sources`, `/entities/product-details`
- `ContentIntelligence` - routes: `/content-intelligence/quality`, `/content-intelligence/score`, `/content-intelligence/stats`
