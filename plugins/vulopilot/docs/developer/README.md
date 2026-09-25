# VuloPilot Developer Documentation

Code-level documentation for developers who extend or maintain the free plugin. End-user guides are in [../user](../user/README.md).

## Start here

1. [ARCHITECTURE](ARCHITECTURE.md) - bootstrap, container, modules, hooks, REST, React.
2. [REST-API](REST-API.md) - every route, generated from the controllers.
3. [DATABASE](DATABASE.md) - tables and columns.

## By area

| Area | Document | Covers |
|---|---|---|
| SEO | [SEO-CORE](SEO-CORE.md) | Sitemaps, title formats, IndexNow, robots.txt, redirects, 404 log, post editor sidebar, blocks |
| SEO scanners | [SEO-MODULE](SEO-MODULE.md) | Technical SEO scanners and rules |
| AI visibility | [GEO-MODULE](GEO-MODULE.md), [AI-VISIBILITY-MODULE](AI-VISIBILITY-MODULE.md), [AI-CRAWLER-ANALYTICS-MODULE](AI-CRAWLER-ANALYTICS-MODULE.md) | GEO/AEO scoring, crawler tracking, llms.txt |
| Brand and entities | [BRAND-INTELLIGENCE-MODULE](BRAND-INTELLIGENCE-MODULE.md), [KNOWLEDGE-GRAPH-MODULE](KNOWLEDGE-GRAPH-MODULE.md) | Trust/authority, entity extraction |
| Content | [CONTENT-INTELLIGENCE-MODULE](CONTENT-INTELLIGENCE-MODULE.md) | Content analysis, readability |
| AI | [AI-ARCHITECTURE](AI-ARCHITECTURE.md), [AI-ACTIONS](AI-ACTIONS.md) | Requests, propose/approve/apply, actions |
| Performance | [PERFORMANCE-CORE](PERFORMANCE-CORE.md) | PageSpeed, Web Vitals, asset scanners |
| Site health | [SITE-HEALTH-AND-BACKUPS-CORE](SITE-HEALTH-AND-BACKUPS-CORE.md) | Health scanners, backups |
| Accessibility | [ACCESSIBILITY-MODULE](ACCESSIBILITY-MODULE.md) | WCAG scanners |
| Security | [SECURITY-CORE](SECURITY-CORE.md), [SECURITY-MODULE](SECURITY-MODULE.md) | Guards and scanners |
| WooCommerce | [WOOCOMMERCE-INTELLIGENCE-MODULE](WOOCOMMERCE-INTELLIGENCE-MODULE.md) | Store checks |
| Automation, findings | [AUTOMATIONS-AND-REPORTS-CORE](AUTOMATIONS-AND-REPORTS-CORE.md), [AUTOMATION-ENGINE-MODULE](AUTOMATION-ENGINE-MODULE.md), [SCANNERS](SCANNERS.md), [RULE-ENGINE](RULE-ENGINE.md) | Scan pipeline, rules, schedules |
| Settings | [SETTINGS-SYSTEM](SETTINGS-SYSTEM.md) | Storage, screens, integrations, notifications |
| Dashboard | [DASHBOARD-WIDGETS](DASHBOARD-WIDGETS.md) | Widget registry |
| Admin pages | [ADMIN-PAGES-OVERVIEW](ADMIN-PAGES-OVERVIEW.md) | Menu and page map |
| Extending | [EXTENSION-SDK](EXTENSION-SDK.md) | Extension classes and filters |

## Working on the code

```bash
pnpm install                 # once, in the repository root
pnpm run build               # from plugins/vulopilot: rebuild assets/
pnpm run watch               # rebuild on change
composer dump-autoload -o    # after moving or renaming a PHP class
pnpm exec wp i18n make-pot ...   # the makepot script; must finish with no warnings
```

Checklist before a release: PHP lint on changed files, `pnpm run build`, `make-pot` with no warnings, and a run in a clean site with `WP_DEBUG` on.

## Generated sections

Tables titled "Class reference", "Settings keys" and "REST-API" are generated from the source by a small script that reads class docblocks, `add_action`/`add_filter` calls, `register_rest_route()` and `Utill::VULOPILOT_SETTINGS_DEFAULTS`. If a description looks stale, fix the class docblock and regenerate.
