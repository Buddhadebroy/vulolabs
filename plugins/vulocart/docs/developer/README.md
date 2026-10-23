# VuloCart Developer Documentation

Code-level documentation for developers who extend or maintain the free plugin. Guides for store owners are in [../user](../user/README.md). The Pro plugin has its own set in [vulocart-pro/docs/developer](../../../../../plugins/vulocart-pro/docs/developer/README.md).

## Start here

1. [ARCHITECTURE](ARCHITECTURE.md) - bootstrap, container, layers, modules, REST, React, storefront.
2. [MODULES](MODULES.md) - the 12 modules of the free plugin and how to add one.
3. [EXTENSION-POINTS](EXTENSION-POINTS.md) - every hook, filter and JavaScript slot, with recipes.

## By area

| Area | Document | Covers |
|---|---|---|
| Catalog | [CATALOG](CATALOG.md) | Products, product types, prices, categories, brands, collections, tags, attributes |
| Checkout | [CHECKOUT-ENGINE](CHECKOUT-ENGINE.md) | Step discovery and rendering, sessions, placing an order, delivery styles |
| Payments | [PAYMENT-FRAMEWORK](PAYMENT-FRAMEWORK.md) | Gateway interface, charge paths, statuses, webhooks, writing a gateway |
| Anywhere | [SDK](SDK.md) | The JavaScript SDK: checkout on any website, widgets, limits |
| Storefront | [STOREFRONT-BLOCKS](STOREFRONT-BLOCKS.md) | Server-rendered blocks, React blocks, patterns, permalinks |
| Settings | [SETTINGS-SYSTEM](SETTINGS-SYSTEM.md) | Storage, keys, how screens are described and saved |
| AI | [AI-ARCHITECTURE](AI-ARCHITECTURE.md) | VuloCloud connection, `AiClient`, usage log |
| Reference | [REST-API](REST-API.md), [DATABASE](DATABASE.md), [CLASS-REFERENCE](CLASS-REFERENCE.md) | Generated from the code |

## Working on the code

```bash
pnpm install                 # once, in the repository root
pnpm run build               # from plugins/vulocart: rebuild assets/
pnpm run watch               # rebuild on change
composer dump-autoload -o    # after moving or renaming a PHP class
composer run-script phpcs    # coding standard check
```

Checklist before a release: PHP lint on changed files (`php -l`), `pnpm run build`, a run on a clean site with `WP_DEBUG` on, and a walk through the checkout with each payment method.

## Conventions

- PHP classes are PascalCase, methods snake_case, tabs for indentation, `defined( 'ABSPATH' ) || exit;` at the top of every file. Namespaces mirror the folders (PSR-4).
- Every function and class has a docblock whose first line says **what it is for**. Keep it that way: the generated reference pages read it.
- Hooks are prefixed `vulocart_`.
- REST controllers extend `\WP_REST_Controller`, take the namespace from `VuloCart()->rest_namespace` and always define a `permission_callback`.
- TypeScript uses tabs, single quotes and trailing commas.
- Comments explain *why*, not history. Do not leave notes about how the code used to work, who asked for it or which task it belonged to.

## Generated sections

[REST-API](REST-API.md), [DATABASE](DATABASE.md) and [CLASS-REFERENCE](CLASS-REFERENCE.md) are generated from the source: the controllers' `register_rest_route()` calls and method docblocks, the `CREATE TABLE` statements, and the class docblocks. If a description looks stale, fix the docblock and regenerate.
