# VuloCart Architecture

How the free plugin is put together: how it boots, how its code is layered, how modules load, and how the admin app and the storefront reach the data. For the details of one area, follow the links to the other documents in this folder.

## What VuloCart is

A commerce engine for WordPress that keeps its own tables (it does not use WooCommerce's data model) and exposes everything through a REST API. The free plugin contains the catalog, carts, orders, customers, payments (offline gateways), shipping (flat rate), taxes, the checkout engine, the storefront blocks and the admin app. [vulocart-pro](../../../../../plugins/vulocart-pro/docs/developer/README.md) adds more modules on top.

## Folder map

```
vulocart/
├── vulocart.php            Plugin header and the global VuloCart() accessor
├── config.php              Constants (version, VuloCloud URL, shop URL)
├── classes/                Core code, PSR-4 namespace VuloCart\
│   ├── VuloCart.php        Bootstrap singleton
│   ├── Modules.php         Module loader
│   ├── ServiceContainer.php  bind/make container for repositories
│   ├── Install.php         Core tables
│   ├── Utill.php           Table names, option keys, setting defaults
│   ├── Block.php           Registers the React blocks and prints frontend config
│   ├── Admin/Menu.php      Admin menus and the admin script
│   ├── Application/        Services: ProductService, TermService, ...
│   ├── Domain/             Plain entities and repository interfaces
│   ├── Infrastructure/     $wpdb repositories
│   ├── Events/             EventDispatcher
│   ├── RestAPI/            Rest dispatcher, Cors, Controllers/
│   ├── Storefront/         Server-rendered product blocks, permalinks, product view
│   ├── Notifications/      OrderEmails
│   └── AI/                 VuloCloud connection and AI client
├── modules/                Toggleable modules (Cart, Order, Payment, ...)
├── blocks/                 Server-rendered storefront blocks (block.json + editor/view JS)
├── src/                    React admin app and the React storefront blocks
├── assets/                 Build output
└── docs/                   This documentation
```

## Bootstrap

`vulocart.php` calls the global function `VuloCart()` once. It returns `VuloCart\VuloCart`, a singleton that holds a plain array container with magic `__get` / `__set`, so `VuloCart()->product_service` reads `$container['product_service']`.

1. The constructor loads `config.php`, stores the plugin URL, path, version and REST namespace (`vulocart/v1`) and hooks `plugins_loaded` and `init`.
2. On `plugins_loaded`, `init_plugin()` schedules `init_classes()` on `init` (priority 0) and runs the installer once if the activation flag is set.
3. `init_classes()` builds the services, the module loader, the admin, REST and storefront classes, then fires **`vulocart_loaded`**. vulocart-pro waits for that action before it boots.

Activation only sets a flag (`vulocart_run_installer`) and flushes rewrite rules. Tables are created later, in `init_plugin()`, because `dbDelta()` is not guaranteed to be loaded when the activation hook runs.

### What is on the container

| Key | Set by | What it is |
|---|---|---|
| `util` | core | `Utill` instance (logging, Pro check) |
| `service_container` | core | `ServiceContainer`, binds repository interfaces to implementations |
| `event_dispatcher` | core | `Events\EventDispatcher` |
| `product_service`, `term_service`, `attribute_service`, `checkout_service` | core | Application services |
| `modules` | core | `Modules` loader |
| `admin`, `rest`, `cors`, `block`, `storefront`, `permalinks`, `order_emails` | core | Hook-registering classes |
| `cart_service` | Cart module | Carts |
| `order_service` | Order module | Orders |
| `customer_service` | Customer module | Customers, addresses, notes |
| `address_service` | Address module | Address sanitizing and validation |
| `shipping_service` | Shipping module | Shipping methods and cost |
| `tax_service` | Taxes module | Tax calculation |
| `payment_service` | Payment module | Gateways and the transaction ledger |
| `order_review_service` | Review module | Final totals for the Review step |
| `review_service` | Product Reviews module | Product reviews |
| `ai_client` | AI module | VuloCloud AI requests |

A key that a module sets only exists while that module is active. Code outside the module must not assume it is there (the order service, for example, resolves the shipping, tax and payment services only when they exist).

## Layers

```
React / REST client
      ↓
REST controller          classes/RestAPI/Controllers/*, modules/*/Rest.php   (validation, permissions, response shape)
      ↓
Application service      classes/Application/*, modules/*/Application/*      (business rules, events)
      ↓
Domain                   classes/Domain/*, modules/*/Domain/*                 (plain entities, repository interfaces)
      ↓
Infrastructure           classes/Infrastructure/Database/*                    ($wpdb repositories)
      ↓
Tables
```

Rules the code follows:

- A controller calls a service, never a repository.
- A domain class has no WordPress calls.
- Application services decide what happened and then call the event dispatcher. WordPress hooks are only the transport.
- Repositories are bound to their interfaces in one place, `VuloCart::init_classes()` (core) or the module's `Module.php`. Switching storage means changing that binding.

### Events

`EventDispatcher::dispatch( 'product_created', $payload )` fires the action `vulocart_product_created` with the payload array. A listener should react (send a webhook, clear a cache); it must not contain the rule that decided the event. The events are listed in [EXTENSION-POINTS](EXTENSION-POINTS.md#events).

## Modules

A module is a folder under `modules/` that contains a `Module.php` (class `VuloCart\{Folder}\Module`). Everything else is optional: `Install.php`, `Rest.php`, `Application/`, `Domain/`, `Infrastructure/`, `src/`.

- **Id.** The module id is the kebab-case folder name: `ProductReviews` becomes `product-reviews`.
- **Discovery.** `Modules::get_all_modules()` scans every source returned by the `vulocart_module_sources` filter. vulocart-pro adds its own `modules/` folder this way. If two sources have a module with the same id, the second is keyed `{namespace}_{id}`.
- **Active list.** The ids are stored in the option `vulocart_all_active_module_list`. `Modules::load_active_modules()` runs once per request: it renames old ids (`RENAMED_MODULE_IDS`), adds the core modules, adds companions, requires each `Module.php`, constructs the class and fires `vulocart_activated_module_{id}`. An id that does not resolve to an available module is dropped from the stored list.
- **Availability.** A module can define a static `is_compatible()`. When it returns false the module is not available. Order, for example, requires the Cart module.
- **Core modules.** `Modules::CORE_MODULE_IDS` (`cart`, `order`, `customer`, `address`, `payment`, `confirmation`, `review`) have no card on the Modules screen and are always active.
- **Seeding.** A new install activates Cart, Order and the checkout modules once; one-time flag options (`vulocart_cart_order_modules_seeded`, `vulocart_checkout_modules_seeded`, `vulocart_reviews_module_seeded`) keep the loader from switching them back on after the merchant turned them off.
- **Companions.** One card on the Modules screen can switch several modules. `Modules::get_companion_map()` (filter `vulocart_module_companions`) maps a card to the modules that follow it, for example `shipping` to `fulfillment`, or `ai` to `catalog-ai`, `checkout-ai`, `support-ai` and `vector-search`. A companion that is not available (Pro missing or unlicensed) is simply dropped.
- **Tables.** A module creates its own tables from `Install.php`, on the `vulocart_activated_module_{id}` action. The install runs only when the stored schema version differs from the module's current version, because that action fires on every request. Never write `CREATE TABLE IF NOT EXISTS` for `dbDelta()`: it would read `IF` as the table name.

The modules shipped in this plugin are described in [MODULES](MODULES.md).

## REST API

All routes are in the namespace `vulocart/v1` (read it from `VuloCart()->rest_namespace`, never hard-code it).

- Core controllers (`classes/RestAPI/Controllers/*`) are created by `RestAPI\Rest::register_routes()` on `rest_api_init`. The `vulocart_rest_controllers` filter adds more.
- Module controllers (`modules/*/Rest.php`) hook `rest_api_init` themselves.
- Every route has a `permission_callback`. Admin routes check `manage_options`. Public routes are the ones a shopper needs: reading products, carts, checkout, order placement and tracking. A cart is protected by its token (`X-Cart-Token`), an order by its access token.
- `RestAPI\Cors` adds `Access-Control-Allow-Origin: *` to `vulocart/v1` responses so `@vulocart/sdk` can run on other domains.

The complete list is in [REST-API](REST-API.md).

## Admin app (React)

- One webpack entry, `src/index.tsx`. `Admin\Menu` prints a root element on each admin screen and `src/index.tsx` renders the matching tree (see its file comment). The main menu mounts into `#admin-main-wrapper`; Orders, Products, Customers, Inventory, Shipping, AI, Workflows and Marketing use their own root ids.
- The tabs of the main menu are read from `location.hash` (`#&tab=dashboard`), registered in `src/routes.ts`.
- `vulocartLocalizer` (printed by `Menu::enqueue_admin_script()`) carries the REST URL, nonce, active modules, formats and the Pro flag `khali_dabba`.
- Settings screens are described declaratively in `src/settings/*.ts` and drawn by zyra's `InputRenderer`. See [SETTINGS-SYSTEM](SETTINGS-SYSTEM.md).
- Pro adds its screens through `@wordpress/hooks` filters (`vulocart_product_edit_sections`, `vulocart_ai_view`, ...). Free reads them with `applyFilters()`. The full list is in [EXTENSION-POINTS](EXTENSION-POINTS.md#javascript-filters).
- `src/index.tsx` renders on `DOMContentLoaded` so Pro's bundle has already registered its filters.

## Storefront

Two systems exist side by side:

1. **Server-rendered blocks** in `blocks/` (product collection, product page, cart, ...), registered by `Storefront\Storefront`. They need no JavaScript to show products and are themed from the active theme's design tokens. See [STOREFRONT-BLOCKS](STOREFRONT-BLOCKS.md).
2. **React blocks** in `src/blocks/` (`vulocart/products`, `vulocart/checkout`, `vulocart/order-tracking`), discovered by `Block.php` from the built folder. The checkout is the [checkout engine](CHECKOUT-ENGINE.md).

`Block::print_frontend_config()` prints `vulocartFrontendData` on every frontend page (checkout settings, current user, page URLs).

## Pro detection

`Utill::is_khali_dabba()` returns the value of the `kothay_dabba_vulocart` filter, which only vulocart-pro answers (true while it is installed, active and licensed). Free code never checks for the Pro plugin directly.

## Related

- [MODULES](MODULES.md) - the modules in this plugin
- [CATALOG](CATALOG.md) - products, prices and taxonomies
- [CHECKOUT-ENGINE](CHECKOUT-ENGINE.md), [PAYMENT-FRAMEWORK](PAYMENT-FRAMEWORK.md)
- [EXTENSION-POINTS](EXTENSION-POINTS.md) - hooks, filters and how to extend
- [DATABASE](DATABASE.md), [REST-API](REST-API.md), [CLASS-REFERENCE](CLASS-REFERENCE.md)
