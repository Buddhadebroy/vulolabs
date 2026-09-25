# Rule Engine and Recommendations

Rules turn findings into **recommendations**: a titled, prioritized suggestion with an estimated impact and time, optionally tied to a fix action.

```
vulopilot_scan_completed -> RuleEngine::handle_scan_completed(ScanResult)
   -> for each finding, for each registered rule: rule->applies_to(finding)? rule->get_recommendation(finding)
   -> sort by priority (high first)
   -> do_action('vulopilot_recommendations_generated', $recommendations, $findings)
```

Only completed scans are processed. A rule that throws is skipped, never breaking the others.

## Contract

`VuloPilot\Utill\RuleInterface`:

| Method | Meaning |
|---|---|
| `get_id()`, `get_label()` | Identity |
| `get_type()` | One of `RuleType`: `critical`, `error`, `warning`, `suggestion` |
| `get_priority()` | Integer; higher sorts first |
| `get_categories()`, `get_tags()` | Which finding categories it relates to; free tags |
| `is_fixable()`, `requires_ai()` | Whether an action can fix it, and whether that needs AI |
| `get_estimated_impact()`, `get_estimated_time_minutes()` | `Impact::HIGH/MEDIUM/LOW`; minutes |
| `get_tier()` | `'free'` or `'pro'` |
| `applies_to( Finding )` | Does this rule handle this finding? |
| `get_recommendation( Finding )` | Returns a `Recommendation` |

Extend `Utill\AbstractBasicRule` for defaults. A `Recommendation` carries the rule id, title, description, type, priority, categories, tags, estimated impact/time and the finding's `object_type` / `object_ref`.

## Registry

`RuleRegistry` starts from `get_default_rule_classes()`, applies the `vulopilot_rule_sources` filter and exposes `get_rule( $id )`, `get_all_rules()` and `get_rules_by_category( $category )`.

## Actions that fix a recommendation

Two separate action systems exist:

- `Utill\ActionInterface` - a manual or automated action that takes a `Recommendation` (`execute( Recommendation, array $config )`); registered through `vulopilot_manual_action_sources`. See [AUTOMATIONS-AND-REPORTS-CORE](AUTOMATIONS-AND-REPORTS-CORE.md).
- `Utill\AIActionInterface` - an AI-drafted change with propose / approve / rollback. See [AI-ACTIONS](AI-ACTIONS.md).

`Utill\TriggerInterface` (`register( callable $on_fire )`) lets an extension add an automation trigger.

## Rules registered by the core

| Class | File | What it does |
|---|---|---|
| `UnresolvedCriticalFindingRule` | `classes/Utill/UnresolvedCriticalFindingRule.php` | The one cross-cutting rule in this set: applies to any Finding with Severity::CRITICAL regardless of category (get_categories() returns an empty array - see RuleInterface's docblock for what that means), and always produces the en |
| `MissingAltTextRule` | `classes/Accessibility/MissingAltTextRule.php` | - |
| `CoreUpdateAvailableRule` | `classes/SiteHealth/CoreUpdateAvailableRule.php` | Turns Scanners\Basic\UpdatesScanner's WordPress-core-update Finding (object_type 'core') into a recommendation to update now. |
| `DormantPluginRule` | `classes/SiteHealth/DormantPluginRule.php` | Turns Scanners\Basic\PluginsScanner's "inactive plugin installed" Finding into a recommendation to remove or reactivate it. |
| `SeoTitleRewriteRule` | `classes/SeoVisibility/SeoTitleRewriteRule.php` | Turns Seo\Scanners\SeoScanner's title-length Finding into a recommendation to rewrite the title. |
| `MissingMetaDescriptionRule` | `classes/SeoVisibility/MissingMetaDescriptionRule.php` | Turns Seo\Scanners\MetaDescriptionScanner's "no excerpt set" Finding into a recommendation to draft one with AI - same reasoning as SeoTitleRewriteRule: a good description has to actually summarize the page's content, which needs  |
| `MissingFeaturedImageRule` | `classes/SeoVisibility/MissingFeaturedImageRule.php` | Turns Seo\Scanners\SeoImagesScanner's "no featured image" Finding into a recommendation. |
| `RobotsBlockingCrawlersRule` | `classes/SeoVisibility/RobotsBlockingCrawlersRule.php` | Turns Seo\Scanners\RobotsTxtScanner's "robots.txt blocks every crawler" HIGH-severity Finding into a critical recommendation. |
| `FaqOpportunityRule` | `classes/Content/FaqOpportunityRule.php` | Turns Geo\Scanners\GeoFaqOpportunityScanner's "no FAQ-style questions" Finding into a recommendation to draft one with AI - good FAQ questions have to actually anticipate what a reader would ask about this specific content, which  |
| `MissingSummaryBlockRule` | `classes/Content/MissingSummaryBlockRule.php` | Turns Geo\Scanners\GeoSummaryBlockScanner's "no upfront summary" Finding into a recommendation to draft one with AI - a good summary has to actually distill this specific content's key points, which needs the content itself. |

## Add a rule

```php
add_filter( 'vulopilot_rule_sources', fn( array $c ) => array_merge( $c, array( \MyPlugin\MyRule::class ) ) );
```

The class must implement `RuleInterface`. Keep `applies_to()` cheap: it runs for every finding of every completed scan.
