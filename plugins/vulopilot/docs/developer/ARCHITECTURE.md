# Architecture Overview

How the free plugin is put together: bootstrap, the service container, module loading, the extension filters, REST and the React app. Read this first; the other developer docs go deeper on one area each.

Reading order: this page, then [REST-API](REST-API.md), then the area you are changing.

## 1. Request lifecycle

```
vulopilot.php
  -> VuloPilot() singleton (classes/VuloPilot.php)
       constructor: container = plugin_url, plugin_path, version, rest_namespace = 'vulopilot/v1', plugin_slug
       registers activation/deactivation hooks, then plugins_loaded -> init_plugin()
  init_plugin()  -> add_action('init', init_classes, 0)   (installer runs first if the run_installer option is set)
  init_classes() -> builds every service into $container, then do_action('vulopilot_loaded')
```

`VuloPilot()` is a plain-array container with magic `__get` / `__set`. Get any service with `VuloPilot()->scan_runner`, `VuloPilot()->ai_action_registry`, and so on. Heavy classes are created in `init_classes()`, not in constructors.

## 2. Service container keys

| Key | Class | Role |
|---|---|---|
| `util` | `Utill` | Settings defaults, table names, feature-flag helpers |
| `admin` | `Admin` | Admin menu and the hash-tab submenu |
| `frontendScripts` | `FrontendScripts` | Enqueues the React bundle, localizes `vulopilotAppLocalizer` |
| `modules` | `Modules` | Discovers and loads modules |
| `scanner_registry` / `scan_runner` | `Utill\ScannerRegistry` / `ScanRunner` | Runs scanners, emits `vulopilot_scan_completed` |
| `rule_registry` / `rule_engine` | `Utill\RuleRegistry` / `RuleEngine` | Turns findings into recommendations |
| `scan_persistence` | `Utill\ScanPersistenceListener` | Saves scan results and emits `vulopilot_scan_persisted` |
| `manual_action_registry` / `manual_action_runner` | `Automations\ActionRegistry` / `ManualActionRunner` | Run one action on one finding |
| `automation_scheduler` | `Automations\AutomationScheduler` | WP-Cron driven built-in automations |
| `rest` | `Rest` | Registers every REST controller |
| `ai_request_sender`, `ai_action_registry`, `ai_action_runner` | `AiAssistant\AiRequestSender`, `AiCopilot\ActionRegistry`, `AiCopilot\ActionRunner` | AI requests and the propose/approve/apply flow |
| `geo_analyzer`, `content_analyzer`, `llms_txt_generator` | analyzers | GEO score, content analysis, llms.txt |
| `sitemap_manager`, `robots_txt_manager`, `title_formatter`, ... | `SeoVisibility\*` | See [SEO-CORE](SEO-CORE.md) |
| `redirect_manager`, `not_found_logger` | `Content\*` | See [SEO-CORE](SEO-CORE.md) |
| `psi_fetcher`, `page_speed_scanner`, `performance_*` | `Performance\*` | See [PERFORMANCE-CORE](PERFORMANCE-CORE.md) |
| `login_protection_guard`, `firewall_guard` | `Security\*` | See [SECURITY-CORE](SECURITY-CORE.md) |

## 3. Modules

A module is a folder in `modules/` with a `Module.php` at its top level. `Modules::load_active_modules()` scans registered module sources (this plugin's own `modules/` path plus any added through the `vulopilot_module_sources` filter) and instantiates active ones. The active list is stored in the option `vulopilot_all_active_module_list` (`Utill::ACTIVE_MODULES_DB_KEY`).

Default active modules on activation: `geo-analysis`, `technical-seo`, `content-optimization`, `brand-visibility`, `knowledge-graph`, `ai-copilot`.

| Module folder | Purpose | Doc |
|---|---|---|
| `modules/TechnicalSeo` | On-page SEO scanners | [SEO-MODULE](SEO-MODULE.md) |
| `modules/GeoAnalysis` | GEO/AEO analysis, llms.txt | [GEO-MODULE](GEO-MODULE.md), [AI-VISIBILITY-MODULE](AI-VISIBILITY-MODULE.md) |
| `modules/BrandVisibility` | Trust/authority scanners | [BRAND-INTELLIGENCE-MODULE](BRAND-INTELLIGENCE-MODULE.md) |
| `modules/KnowledgeGraph` | Entity extraction | [KNOWLEDGE-GRAPH-MODULE](KNOWLEDGE-GRAPH-MODULE.md) |
| `modules/ContentOptimization` | Content analysis and readability | [CONTENT-INTELLIGENCE-MODULE](CONTENT-INTELLIGENCE-MODULE.md) |
| `modules/AiCopilot` | AI actions, chat, action runs | [AI-ACTIONS](AI-ACTIONS.md), [AI-ARCHITECTURE](AI-ARCHITECTURE.md) |

Rule of thumb (from the repository guide): `classes/` holds shared core and always-on features; `modules/<Module>/` holds module code namespaced `VuloPilot\<Module>\...`. PSR-4 maps `VuloPilot\` to both folders, so after moving or renaming a class run `composer dump-autoload -o`.

## 4. Extension points

Filters and actions other plugins use. All are prefixed `vulopilot_`.

| Hook | Type | Where | Use it to |
|---|---|---|---|
| `vulopilot_loaded` | action | `VuloPilot::init_plugin` | Boot code that depends on the free plugin |
| `vulopilot_module_sources` | filter | `Modules` | Add a folder of modules |
| `vulopilot_scanner_sources` | filter | `Utill\ScannerRegistry` | Add scanner class names |
| `vulopilot_rule_sources` | filter | `Utill\RuleRegistry` | Add rule class names |
| `vulopilot_manual_action_sources` | filter | `Automations\ActionRegistry` | Add manual finding actions |
| `vulopilot_ai_action_sources` | filter | `AiCopilot\ActionRegistry` | Add AI action classes |
| `vulopilot_extension_sources` | filter | `Sdk\ExtensionManager` | Register SDK extensions ([EXTENSION-SDK](EXTENSION-SDK.md)) |
| `vulopilot_rest_controllers` | filter | `Rest` | Add REST controllers |
| `vulopilot_finding_list_response` | filter | `Utill\Findings` | Change the findings list response |
| `vulopilot_crawler_bot_signatures` | filter | `SeoVisibility\CrawlerTrafficLogger` | Add AI crawler user agents |
| `vulopilot_crawler_log_retention_days` | filter | crawler logging | Change log retention |
| `vulopilot_send_scheduled_visibility_report` | filter | `Automations\AutomationScheduler` | Deliver the scheduled report email; return `true`/`false`, leave `null` if not handled |
| `vulopilot_scan_completed` | action | `Utill\ScanRunner` | React to a finished scan (`$result`) |
| `vulopilot_scan_persisted` | action | `Utill\ScanPersistenceListener` | React after results are saved (`$scan_result`, `$scan_id`) |
| `vulopilot_recommendations_generated` | action | rule engine | React to new recommendations |
| `vulopilot_backup_completed` | action | `SiteHealth\BackupManager` | React to a finished backup (`$backup_id`) |
| `vulopilot_clear_all_caches`, `vulopilot_after_installed`, `vulopilot_security_score_recorded` | actions | various | Maintenance hooks |

Example - add an AI action from another plugin:

```php
add_filter( 'vulopilot_ai_action_sources', function ( array $classes ): array {
    $classes[] = \MyPlugin\Actions\MyAction::class; // implements VuloPilot\Utill\AIActionInterface
    return $classes;
} );
```

## 5. Data and settings

- Settings live in the single option `vulopilot_settings` (`Utill::VULOPILOT_SETTINGS_KEY`) merged over `Utill::VULOPILOT_SETTINGS_DEFAULTS`. See [SETTINGS-SYSTEM](SETTINGS-SYSTEM.md).
- Custom tables are listed in `Utill::TABLES`. Full schema: [DATABASE](DATABASE.md).

## 6. REST

Namespace `vulopilot/v1`, resolved from `VuloPilot()->rest_namespace`, never hardcoded. Controllers extend `\WP_REST_Controller`, register on `rest_api_init` and must set a `permission_callback`. `Rest` builds the built-in list and merges in `vulopilot_rest_controllers`. Route index: [REST-API](REST-API.md).

## 7. React app

`src/index.tsx` mounts one app into `#admin-main-wrapper` inside a `BrowserRouter`. Data reaches it through `wp_localize_script` as `vulopilotAppLocalizer` (REST URL, nonce, module list, date formats and so on). Pages are in `src/pages/*`, dashboard widgets in `src/dashboard-widgets`, the settings screens are built from files in `src/components/Settings`. Extension slots use `@wordpress/hooks` filters read through `src/services/useFilterSlot.ts`.

Build: `pnpm run build` (webpack via `wp-scripts`). Strings use `@wordpress/i18n` with the text domain `vulopilot`.

## 8. Conventions

- PHP: PascalCase classes, snake_case methods, tabs, `defined( 'ABSPATH' ) || exit;` at the top of every file.
- Output escaping and input sanitization on every boundary; AI-generated post content is passed through `wp_kses_post()` / `sanitize_text_field()` before saving.
- File locations use `wp_upload_dir()`, `plugin_dir_path()` and friends, never hardcoded `wp-content` paths.
