# Extension SDK

A small SDK for plugins that extend VuloPilot with their own scanners, rules, actions and REST controllers, and need a compatibility check.

## Extension classes

Implement `VuloPilot\Sdk\ExtensionInterface`:

| Method | Returns |
|---|---|
| `get_id()` | Unique extension id |
| `get_name()` | Display name |
| `get_version()` | Extension version |
| `get_minimum_vulopilot_version()` | Lowest VuloPilot version it works with |
| `register()` | Called once when the extension is loaded; add your hooks here |

Register it through the filter:

```php
add_filter( 'vulopilot_extension_sources', function ( array $classes ): array {
    $classes[] = \MyPlugin\MyExtension::class;
    return $classes;
} );
```

`ExtensionManager::register_extensions()` instantiates each class, skips (and lists) any extension whose minimum version is higher than the running VuloPilot, and calls `register()` on the rest. If `register()` throws, the failure is logged and that extension is skipped without affecting the others. `get_all_extensions()`, `get_extension( $id )` and `get_incompatible_extensions()` expose the result. An admin notice is shown for incompatible extensions.

## Compatibility helpers

`VuloPilot\Sdk\VersionGuard`:

- `meets_minimum( $current, $required )`
- `is_php_compatible( $required )`
- `is_wp_compatible( $required )`
- `is_woocommerce_compatible( $required = null )`

## Service provider base

`Sdk\AbstractServiceProvider` (`make( $id )`, `has( $id )`) is a tiny container for extension services.

## What an extension can add

| Need | Hook |
|---|---|
| Scanner | `vulopilot_scanner_sources` ([SCANNERS](SCANNERS.md)) |
| Rule | `vulopilot_rule_sources` ([RULE-ENGINE](RULE-ENGINE.md)) |
| AI action | `vulopilot_ai_action_sources` ([AI-ACTIONS](AI-ACTIONS.md)) |
| Manual action | `vulopilot_manual_action_sources` |
| REST controller | `vulopilot_rest_controllers` ([REST-API](REST-API.md)) |
| Module folder | `vulopilot_module_sources` ([ARCHITECTURE](ARCHITECTURE.md)) |

Boot your extension after `vulopilot_loaded`.

## Class reference

| Class | File | What it does |
|---|---|---|
| `AbstractServiceProvider` | `classes/Sdk/AbstractServiceProvider.php` | - |
| `ExtensionInterface` | `classes/Sdk/ExtensionInterface.php` | - |
| `ExtensionManager` | `classes/Sdk/ExtensionManager.php` | Collects every registered extension (`vulopilot_extension_sources` filter) and calls its register() - the SDK's discovery layer, same discovery-by-filter shape as Scanners\ScannerRegistry/RuleEngine\RuleRegistry/ AutomationEngine\ |
| `VersionGuard` | `classes/Sdk/VersionGuard.php` | - |

Hooks and routes registered by these classes:

- `ExtensionManager` - hooks: `admin_notices`, `init`
