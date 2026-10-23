# Class Reference

Every class and interface of the free plugin with the purpose from its docblock, grouped by folder. The methods of each class are documented in the source, one docblock per method.

This page is generated from the class docblocks. If a description looks stale, fix the class docblock and regenerate.

## `classes`

| Class | File | Purpose |
|---|---|---|
| `VuloCart\AI\AiClient` | `classes/AI/AiClient.php` | The single entry point every VuloCart AI feature calls - `VuloCart()->ai_client` |
| `VuloCart\AI\AiUsageLogUtil` | `classes/AI/AiUsageLogUtil.php` | Insert-only log of every real AI provider call this site has made - `AiClient::send()`/`generate_image()`/`embed()` write one row per attempt (successful or not, `success` distinguishes), what the AI top-level menu's own Usage… |
| `VuloCart\AI\ConnectBrokerCallbackHandler` | `classes/AI/ConnectBrokerCallbackHandler.php` | Handles the VuloCloud connect broker's redirect back to this site (`admin-post.php?action=vulocart_connect_broker_callback`, VuloCloudConnection::get_redirect_uri()) |
| `VuloCart\AI\Exceptions\AIProviderException` | `classes/AI/Exceptions/AIProviderException.php` | Thrown when an AI call fails - no provider-configured, an HTTP/network failure, or a provider that doesn't support the requested capability (image generation/embeddings) |
| `VuloCart\AI\Services\CredentialEncryption` | `classes/AI/Services/CredentialEncryption.php` | Encrypts and decrypts secrets stored in the database (the VuloCloud site secret, and the VuloCloud tokens of vulocart-pro) |
| `VuloCart\AI\VuloCloudConnection` | `classes/AI/VuloCloudConnection.php` | A passwordless connect flow gives the site a ConnectedSite id and secret (the secret is stored encrypted) |
| `VuloCart\Admin\Menu` | `classes/Admin/Menu.php` | Registers VuloCart's admin menus and mounts the React admin app |
| `VuloCart\Application\AttributeService` | `classes/Application/AttributeService.php` | Where ProductAttribute business logic lives - backs `classes/RestAPI/Controllers/Attributes.php` |
| `VuloCart\Application\CheckoutService` | `classes/Application/CheckoutService.php` | Where session lifecycle logic lives: creating a session the first time a cart enters checkout, recording step progress, marking a session completed once its Order exists, and finding stale ones for the Abandoned Checkout feature |
| `VuloCart\Application\PriceCatalog` | `classes/Application/PriceCatalog.php` | The price types a product can be sold at, and cleaning/reconciling a product's price list |
| `VuloCart\Application\ProductService` | `classes/Application/ProductService.php` | Where product business logic lives |
| `VuloCart\Application\ReviewService` | `classes/Application/ReviewService.php` | Where Review business logic lives - backs `classes/RestAPI/Controllers/Reviews.php` |
| `VuloCart\Application\TermService` | `classes/Application/TermService.php` | Where Category/Brand/Collection business logic lives - backs `classes/RestAPI/Controllers/Terms.php`'s three taxonomy-scoped route sets |
| `VuloCart\Block` | `classes/Block.php` | Each `src/blocks/{name}/` folder is built into `assets/js/block/{name}/` (with its block.json copied alongside) |
| `VuloCart\Domain\Attribute\AttributeRepositoryInterface` (interface) | `classes/Domain/Attribute/AttributeRepositoryInterface.php` | The contract Application\AttributeService depends on |
| `VuloCart\Domain\Attribute\AttributeValue` | `classes/Domain/Attribute/AttributeValue.php` | One value belonging to an Attribute (e.g. "Red" under "Color") |
| `VuloCart\Domain\Attribute\ProductAttribute` | `classes/Domain/Attribute/ProductAttribute.php` | A named property products can be described by (e.g. "Color", "Size") - deliberately NOT a Domain\Term\Term (Taxonomy's own docblock explains why): an attribute's whole purpose is its list of AttributeValue children, not a flat… |
| `VuloCart\Domain\Checkout\CheckoutMode` | `classes/Domain/Checkout/CheckoutMode.php` | How the same pluggable step sequence is rendered or delivered |
| `VuloCart\Domain\Checkout\CheckoutSession` | `classes/Domain/Checkout/CheckoutSession.php` | The Checkout Engine's own tracking record - one per cart that has actually entered checkout (not one per cart; browsing and adding to cart alone never creates one) |
| `VuloCart\Domain\Checkout\CheckoutSessionRepositoryInterface` (interface) | `classes/Domain/Checkout/CheckoutSessionRepositoryInterface.php` | Same dependency-injection seam every other Domain repository interface in this codebase already establishes - VuloCart::init_classes() binds this to Infrastructure\Database\WPDBCheckoutSessionRepository, and only there |
| `VuloCart\Domain\Checkout\CheckoutStatus` | `classes/Domain/Checkout/CheckoutStatus.php` | Only two real, stored values - "abandoned" is deliberately NOT a third one |
| `VuloCart\Domain\Product\Product` | `classes/Domain/Product/Product.php` | Plain domain object - no `$wpdb`, no WordPress function calls, no REST request handling. `Infrastructure\Database\WPDBProductRepository` is the only class that knows how a Product is actually stored; everything above it… |
| `VuloCart\Domain\Product\ProductRepositoryInterface` (interface) | `classes/Domain/Product/ProductRepositoryInterface.php` | The contract Application\ProductService depends on - bound to a concrete implementation only in VuloCart::init_classes() (via ServiceContainer), never referenced by class name anywhere else |
| `VuloCart\Domain\Product\ProductType` | `classes/Domain/Product/ProductType.php` | The closed set of product `type` values the `vulocart_products` table accepts: Physical, Digital, Subscription, Course, Service, Membership, Booking, Rental, Bundle, Donation, Gift Card and License |
| `VuloCart\Domain\Review\Review` | `classes/Domain/Review/Review.php` | A customer's rating/comment on one Product |
| `VuloCart\Domain\Review\ReviewRepositoryInterface` (interface) | `classes/Domain/Review/ReviewRepositoryInterface.php` | The contract Application\ReviewService depends on |
| `VuloCart\Domain\Review\ReviewStatus` | `classes/Domain/Review/ReviewStatus.php` | Every moderation state a Review can be in - same small, hand-maintained constant list convention Order\Domain\PaymentStatus/ FulfillmentStatus already establish |
| `VuloCart\Domain\Term\Taxonomy` | `classes/Domain/Term/Taxonomy.php` | Categories/Brands/Collections share one table (`vulocart_terms`, discriminated by this `taxonomy` column) and one Domain\Term\Term shape - the same structural relationship WordPress core's own `wp_terms`/`wp_term_taxonomy`… |
| `VuloCart\Domain\Term\Term` | `classes/Domain/Term/Term.php` | Plain domain object - same shape/rules as Domain\Product\Product |
| `VuloCart\Domain\Term\TermRepositoryInterface` (interface) | `classes/Domain/Term/TermRepositoryInterface.php` | The contract Application\TermService depends on - bound to a concrete implementation only in VuloCart::init_classes(), same seam Domain\Product\ProductRepositoryInterface already establishes |
| `VuloCart\Events\EventDispatcher` | `classes/Events/EventDispatcher.php` | Broadcasts what happened (`vulocart_product_created`, `vulocart_order_created`, ...) as WordPress actions |
| `VuloCart\Infrastructure\Database\WPDBAttributeRepository` | `classes/Infrastructure/Database/WPDBAttributeRepository.php` | The only class that runs SQL against `vulocart_attributes`/ `vulocart_attribute_values` - implements Domain\Attribute\AttributeRepositoryInterface, bound in VuloCart::init_classes() |
| `VuloCart\Infrastructure\Database\WPDBCheckoutSessionRepository` | `classes/Infrastructure/Database/WPDBCheckoutSessionRepository.php` | The only class in this codebase that runs SQL against `vulocart_checkout_sessions` - implements Domain\Checkout\CheckoutSessionRepositoryInterface, bound in VuloCart::init_classes() |
| `VuloCart\Infrastructure\Database\WPDBProductRepository` | `classes/Infrastructure/Database/WPDBProductRepository.php` | The only class in this codebase that runs SQL against `vulocart_products` - implements Domain\Product\ProductRepositoryInterface, bound in VuloCart::init_classes() |
| `VuloCart\Infrastructure\Database\WPDBReviewRepository` | `classes/Infrastructure/Database/WPDBReviewRepository.php` | The only class that runs SQL against `vulocart_reviews` - implements Domain\Review\ReviewRepositoryInterface, bound in VuloCart::init_classes() |
| `VuloCart\Infrastructure\Database\WPDBTermRepository` | `classes/Infrastructure/Database/WPDBTermRepository.php` | The only class that runs SQL against `vulocart_terms` - implements Domain\Term\TermRepositoryInterface, bound in VuloCart::init_classes(). `count_products_for_term()` counts live against `vulocart_products.meta` (a… |
| `VuloCart\Install` | `classes/Install.php` | Owns `vulocart_products` plus the catalog tables used by the Products menu: `vulocart_terms` (categories, brands, collections, tags), `vulocart_attributes`, `vulocart_attribute_values`, `vulocart_reviews` and… |
| `VuloCart\Logger` | `classes/Logger.php` | When Settings → Advanced → "Enable debug logging" is on, problems such as a module that failed to load are written to one file in the uploads folder, one line per entry (`Y-m-d H:i:s:message`) |
| `VuloCart\Modules` | `classes/Modules.php` | Module loader: finds, activates and boots the plugin's modules |
| `VuloCart\Notifications\OrderEmails` | `classes/Notifications/OrderEmails.php` | Sends the order emails: a confirmation when an order is created, and a status update when its payment or fulfillment status changes |
| `VuloCart\RestAPI\Controllers\Attributes` | `classes/RestAPI/Controllers/Attributes.php` | Backs the Products menu's "Attributes" admin page (`src/pages/Attributes/`) |
| `VuloCart\RestAPI\Controllers\Checkout` | `classes/RestAPI/Controllers/Checkout.php` | VuloCart Checkout REST controller - the Checkout Engine's own routes |
| `VuloCart\RestAPI\Controllers\Dashboard` | `classes/RestAPI/Controllers/Dashboard.php` | One read-only summary for the VuloCart → Dashboard page (`src/pages/Dashboard/`): sales figures for a date range (with the previous range for comparison), a daily series, what needs the merchant's attention, recent orders, top… |
| `VuloCart\RestAPI\Controllers\Inventory` | `classes/RestAPI/Controllers/Inventory.php` | Backs the Products menu's "Inventory" admin page (`src/pages/Inventory/`) - a specialized, admin-only view over the existing `vulocart_products` table (Application\ProductService), not a new domain entity of its own:… |
| `VuloCart\RestAPI\Controllers\Logs` | `classes/RestAPI/Controllers/Logs.php` | VuloCart Logs REST controller: the three routes the admin UI's log viewer field (`type: 'log'`, used the same way in the other VuloLabs and MultiVendorX plugins) calls to show, clear and download the debug log of Settings →… |
| `VuloCart\RestAPI\Controllers\Modules` | `classes/RestAPI/Controllers/Modules.php` | `GET` / `POST /vulocart/v1/modules`: reads and changes which modules are active |
| `VuloCart\RestAPI\Controllers\ProductTypes` | `classes/RestAPI/Controllers/ProductTypes.php` | Product Types REST controller: backs the "Product Types" page of the Products menu (`src/pages/ProductTypes/`) |
| `VuloCart\RestAPI\Controllers\Products` | `classes/RestAPI/Controllers/Products.php` | Products REST controller: list (paginated), read, create, update, delete, duplicate and bulk-edit products |
| `VuloCart\RestAPI\Controllers\Reviews` | `classes/RestAPI/Controllers/Reviews.php` | Backs the Products menu's "Reviews" admin page (`src/pages/Reviews/`). `POST /reviews` (submit) is public - same "guest-first" posture Cart/Order's own public routes take (Cart\Rest.php's own docblock) - everything else is… |
| `VuloCart\RestAPI\Controllers\Sdk` | `classes/RestAPI/Controllers/Sdk.php` | `GET /vulocart/v1/sdk/config`: the first call `@vulocart/sdk` makes to learn how the store is set up |
| `VuloCart\RestAPI\Controllers\Settings` | `classes/RestAPI/Controllers/Settings.php` | `GET` / `POST /vulocart/v1/settings`: reads and saves the settings shown on src/pages/Settings/Settings.tsx |
| `VuloCart\RestAPI\Controllers\Terms` | `classes/RestAPI/Controllers/Terms.php` | Terms REST controller: registers one set of CRUD routes per taxonomy in ROUTE_TAXONOMIES (`/categories`, `/brands`, `/collections`, `/tags`), each bound to a Domain\Term\Taxonomy constant |
| `VuloCart\RestAPI\Cors` | `classes/RestAPI/Cors.php` | Adds CORS headers to the plugin's own REST namespace (`vulocart/v1`) so `@vulocart/sdk` can run on a domain other than this WordPress site (a landing page, a separate app, plain HTML) |
| `VuloCart\RestAPI\Rest` | `classes/RestAPI/Rest.php` | Plugin-level REST dispatcher: creates the core controllers and calls `register_routes()` on each at `rest_api_init` |
| `VuloCart\ServiceContainer` | `classes/ServiceContainer.php` | It is separate from the plugin's own `VuloCart::$container` array, which only holds config values and eagerly built services (a service locator) |
| `VuloCart\Storefront\Permalinks` | `classes/Storefront/Permalinks.php` | Where a product's page lives: `/shop/blue-bottle/` (on the shop page), `/product/blue-bottle/` (a base of your choice) or the plain `?product=12` |
| `VuloCart\Storefront\ProductView` | `classes/Storefront/ProductView.php` | Turns a domain Product into the flat array the storefront blocks print - one place decides what a shopper sees (price, sale state, stock, call-to-action), so every block (image badge, price, add-to-cart) agrees |
| `VuloCart\Storefront\Storefront` | `classes/Storefront/Storefront.php` | The block-based shop: a Product Collection that queries the catalog and a set of small blocks (filters, template, image, title, price, summary, add to cart, pagination, no results) that a site editor can rearrange, restyle or… |
| `VuloCart\Utill` | `classes/Utill.php` | Central registry of table names, option keys and setting defaults used across the plugin |
| `VuloCart\VuloCart` | `classes/VuloCart.php` | Plugin bootstrap singleton: a plain-array container with magic `__get` / `__set`, created once by the global `VuloCart()` accessor |

## `modules/Address`

| Class | File | Purpose |
|---|---|---|
| `VuloCart\Address\Application\AddressService` | `modules/Address/Application/AddressService.php` | Where Address business logic lives - Rest calls only this class, same as every other module's own Application service |
| `VuloCart\Address\Module` | `modules/Address/Module.php` | Address module: sanitizes and validates the billing and shipping address of an order |
| `VuloCart\Address\Rest` | `modules/Address/Rest.php` | Address REST controller |

## `modules/Ai`

| Class | File | Purpose |
|---|---|---|
| `VuloCart\Ai\Install` | `modules/Ai/Install.php` | VuloCart Ai module Install class - owns `vulocart_ai_provider_configs` (one row per BYOK provider, `credentials` always encrypted, classes/AI/Services/CredentialEncryption.php) and `vulocart_ai_usage_log` (insert-only call… |
| `VuloCart\Ai\Module` | `modules/Ai/Module.php` | AI module: connects the store to VuloCloud AI and records AI usage |
| `VuloCart\Ai\Rest` | `modules/Ai/Rest.php` | VuloCart Ai module Rest class - the VuloCloud connection (status, connect URL, disconnect) and the usage log, all `manage_options`-gated |

## `modules/Cart`

| Class | File | Purpose |
|---|---|---|
| `VuloCart\Cart\Application\CartCleanupScheduler` | `modules/Cart/Application/CartCleanupScheduler.php` | Deletes expired carts |
| `VuloCart\Cart\Application\CartService` | `modules/Cart/Application/CartService.php` | Where Cart business logic actually lives - Rest calls only this class, mirroring VuloCart\Application\ProductService's role for Products |
| `VuloCart\Cart\Domain\Cart` | `modules/Cart/Domain/Cart.php` | Plain domain object |
| `VuloCart\Cart\Domain\CartItem` | `modules/Cart/Domain/CartItem.php` | Plain domain object, same shape/rules as VuloCart\Domain\Product\Product - no `$wpdb`, no WordPress function calls. `unit_price`/`currency` are a snapshot taken from the Product at the moment it was added… |
| `VuloCart\Cart\Domain\CartRepositoryInterface` (interface) | `modules/Cart/Domain/CartRepositoryInterface.php` | The contract Application\CartService depends on - bound to a concrete implementation only in Module::init_classes() (via VuloCart's own ServiceContainer), same seam VuloCart\Domain\Product\ProductRepositoryInterface already… |
| `VuloCart\Cart\Infrastructure\WPDBCartRepository` | `modules/Cart/Infrastructure/WPDBCartRepository.php` | The only class in this codebase that runs SQL against `vulocart_carts`/ `vulocart_cart_items` - implements Domain\CartRepositoryInterface, bound in Module::init_classes() |
| `VuloCart\Cart\Install` | `modules/Cart/Install.php` | Owns `vulocart_carts`/`vulocart_cart_items` - module-owned data, so these tables are created here rather than in the plugin-level `VuloCart\Install` (which only owns `vulocart_products`, the plugin's always-on core entity) |
| `VuloCart\Cart\Module` | `modules/Cart/Module.php` | Cart module: shopping carts for guests and signed-in customers |
| `VuloCart\Cart\Rest` | `modules/Cart/Rest.php` | Cart REST controller: `/cart`, `/cart/items`, `/cart/items/{id}` and `/cart/totals` |

## `modules/Confirmation`

| Class | File | Purpose |
|---|---|---|
| `VuloCart\Confirmation\Module` | `modules/Confirmation/Module.php` | Confirmation module: the "Thank you" step shown after an order is placed |
| `VuloCart\Confirmation\Rest` | `modules/Confirmation/Rest.php` | Confirmation REST controller |

## `modules/Customer`

| Class | File | Purpose |
|---|---|---|
| `VuloCart\Customer\Application\CustomerService` | `modules/Customer/Application/CustomerService.php` | Where Customer business logic lives - Rest calls only this class |
| `VuloCart\Customer\Domain\Customer` | `modules/Customer/Domain/Customer.php` | The persistent profile this module previously deliberately didn't have (Module.php's own pre-existing docblock explained why a snapshot-only model was enough until now) - every downstream feature this plugin pair's own… |
| `VuloCart\Customer\Infrastructure\WPDBAddressRepository` | `modules/Customer/Infrastructure/WPDBAddressRepository.php` | Owns `vulocart_customer_addresses` - the real address book `Address\Application\AddressService`'s own docblock (pre-dating this pass) explicitly said this plugin didn't have yet |
| `VuloCart\Customer\Infrastructure\WPDBCustomerRepository` | `modules/Customer/Infrastructure/WPDBCustomerRepository.php` | The only class in this codebase that runs SQL against `vulocart_customers` - same "one repository owns the raw SQL for its own table" convention `Order\Infrastructure\WPDBOrderRepository` already establishes |
| `VuloCart\Customer\Infrastructure\WPDBNoteRepository` | `modules/Customer/Infrastructure/WPDBNoteRepository.php` | Owns `vulocart_customer_notes` - admin-only internal notes about a customer (never shown to the customer themselves), same role `vulocart-pro`'s own OrderNotes module plays for an Order |
| `VuloCart\Customer\Install` | `modules/Customer/Install.php` | Owns `vulocart_customers`/`vulocart_customer_addresses`/ `vulocart_customer_notes` - this module's first-ever tables (Domain\ Customer's own docblock explains why a persistent entity is new here) |
| `VuloCart\Customer\Module` | `modules/Customer/Module.php` | Every order dispatches `vulocart_order_created`; this module then finds or creates the customer and updates their order count and lifetime spend |
| `VuloCart\Customer\Rest` | `modules/Customer/Rest.php` | `GET /customer/me` is public (it prefills the checkout) |

## `modules/Mcp`

| Class | File | Purpose |
|---|---|---|
| `VuloCart\Mcp\Module` | `modules/Mcp/Module.php` | MCP module: the on/off switch for the store's MCP (Model Context Protocol) server |

## `modules/Order`

| Class | File | Purpose |
|---|---|---|
| `VuloCart\Order\Application\OrderService` | `modules/Order/Application/OrderService.php` | Where order business logic lives; the REST controller calls only this class |
| `VuloCart\Order\Domain\FulfillmentStatus` | `modules/Order/Domain/FulfillmentStatus.php` | Fulfillment status of an order: the other of the two independent statuses an order tracks (see PaymentStatus). `DRAFT` is an order an admin created manually (OrderService::create_manual_order()) that has not been placed with… |
| `VuloCart\Order\Domain\Order` | `modules/Order/Domain/Order.php` | Plain domain object. `order_number` is the human-facing identifier shown to the buyer; `access_token` is the order's equivalent of a cart's `token`: an opaque value only the buyer (or whoever the order was emailed to) holds,… |
| `VuloCart\Order\Domain\OrderItem` | `modules/Order/Domain/OrderItem.php` | Plain domain object, same shape/rules as VuloCart\Cart\Domain\CartItem - but `title` is snapshotted here too (CartItem doesn't store one; its Rest layer resolves it live from the Product on every read), because an Order is a… |
| `VuloCart\Order\Domain\OrderRepositoryInterface` (interface) | `modules/Order/Domain/OrderRepositoryInterface.php` | The contract Application\OrderService depends on - bound to a concrete implementation only in Module::wire_services() (via VuloCart's own ServiceContainer), same seam every other *RepositoryInterface in this codebase already… |
| `VuloCart\Order\Domain\PaymentStatus` | `modules/Order/Domain/PaymentStatus.php` | Payment status of an order: one of the two independent statuses an order tracks (the other is FulfillmentStatus), so "has it been paid?" and "has it been shipped?" are separate columns |
| `VuloCart\Order\Infrastructure\WPDBOrderRepository` | `modules/Order/Infrastructure/WPDBOrderRepository.php` | The only class in this codebase that runs SQL against `vulocart_orders`/ `vulocart_order_items` - implements Domain\OrderRepositoryInterface, bound in Module::wire_services() |
| `VuloCart\Order\Install` | `modules/Order/Install.php` | Owns `vulocart_orders`/`vulocart_order_items` - same module-owned-table, version-gated activation-hook pattern VuloCart\Cart\Install and `vulocart-pro`'s `Passport\Util` already establish |
| `VuloCart\Order\Module` | `modules/Order/Module.php` | An order is built from a cart, so this module is only available while the Cart module is active (see is_compatible()) |
| `VuloCart\Order\Rest` | `modules/Order/Rest.php` | `POST /orders` (create from a cart) and `GET /orders/track` are public, because a guest placing an order and checking on it has no WordPress session |

## `modules/Payment`

| Class | File | Purpose |
|---|---|---|
| `VuloCart\Payment\Application\GatewayRegistry` | `modules/Payment/Application/GatewayRegistry.php` | Where every `PaymentGatewayInterface` implementation becomes known to `PaymentService` - collected via the `vulocart_payment_gateways` filter (fired once, lazily, on first use), the exact same "module contributes an array… |
| `VuloCart\Payment\Application\PaymentService` | `modules/Payment/Application/PaymentService.php` | The Payment Framework's own orchestrator - the only class that talks to both `GatewayRegistry` (resolve which gateway) and `WPDBTransactionLedger` (record what happened) |
| `VuloCart\Payment\Domain\PaymentContext` | `modules/Payment/Domain/PaymentContext.php` | What `PaymentService` hands a gateway's `authorize()`/`capture()`/ `refund()`/`cancel()` - everything a gateway needs to act, without the gateway ever touching a Cart/Order object directly (Payment has no dependency on either… |
| `VuloCart\Payment\Domain\PaymentGatewayInterface` (interface) | `modules/Payment/Domain/PaymentGatewayInterface.php` | The one contract every payment method implements: the three offline gateways of this plugin and the Stripe, PayPal and Razorpay gateways of vulocart-pro. `PaymentService` and `GatewayRegistry` never know which concrete class… |
| `VuloCart\Payment\Domain\PaymentResult` | `modules/Payment/Domain/PaymentResult.php` | What every `PaymentGatewayInterface` method returns - a plain value object, never a raw gateway SDK response, so `PaymentService` and its callers never branch on a gateway-specific shape. `$status` is one of this class's own… |
| `VuloCart\Payment\Gateways\BankTransferGateway` | `modules/Payment/Gateways/BankTransferGateway.php` | Distinct from ManualGateway even though both are offline: a bank transfer always starts `AUTHORIZED` (never immediately `CAPTURED`, regardless of the Payments tab's `default_payment_status`) since real money hasn't moved yet -… |
| `VuloCart\Payment\Gateways\CashOnDeliveryGateway` | `modules/Payment/Gateways/CashOnDeliveryGateway.php` | Same "no external call, merchant confirms by hand" shape as BankTransferGateway - kept as its own gateway (rather than folding into ManualGateway) so it has its own settings toggle (`enable_cash_on_delivery`) and label,… |
| `VuloCart\Payment\Gateways\ManualGateway` | `modules/Payment/Gateways/ManualGateway.php` | The original (pre-Payment-Framework) `manual` method, now expressed as a real `PaymentGatewayInterface` implementation instead of a hardcoded array entry - same settings key (`enable_manual_payment`), same behavior… |
| `VuloCart\Payment\Infrastructure\WPDBTransactionLedger` | `modules/Payment/Infrastructure/WPDBTransactionLedger.php` | The only class in this codebase that runs SQL against `vulocart_payment_transactions` - same "one repository owns the raw SQL for its own table" convention `Order\Infrastructure\ WPDBOrderRepository` already establishes, kept… |
| `VuloCart\Payment\Install` | `modules/Payment/Install.php` | Owns `vulocart_payment_transactions` - the Payment Framework's own audit ledger, one row per gateway call (intent/authorize/capture/ refund/cancel/webhook), independent of `vulocart_orders` (a row can exist before an order… |
| `VuloCart\Payment\Module` | `modules/Payment/Module.php` | Payment module: the payment framework and the built-in offline gateways |
| `VuloCart\Payment\Rest` | `modules/Payment/Rest.php` | `GET /payment/methods` and `POST /payment/intent` are public: a guest at checkout has no WordPress session. `POST /payments/webhook/{gateway}` is public too, because the caller is the gateway's own server; the gateway's… |

## `modules/ProductReviews`

| Class | File | Purpose |
|---|---|---|
| `VuloCart\ProductReviews\Module` | `modules/ProductReviews/Module.php` | VuloCart ProductReviews Module - customer reviews on products: the moderation queue (VuloCart → Reviews), the `reviews` REST routes (list, submit, moderate, delete) and the dashboard's "reviews to moderate" count |

## `modules/Review`

| Class | File | Purpose |
|---|---|---|
| `VuloCart\Review\Application\OrderReviewService` | `modules/Review/Application/OrderReviewService.php` | Recomputes exactly what `Order\Application\OrderService:: create_from_cart()` would charge - same subtotal-from-cart, same Shipping/Taxes cost resolution - without persisting anything, so the checkout wizard's Review step… |
| `VuloCart\Review\Module` | `modules/Review/Module.php` | Review module: the "Review your order" step of the checkout |
| `VuloCart\Review\Rest` | `modules/Review/Rest.php` | Review REST controller |

## `modules/Shipping`

| Class | File | Purpose |
|---|---|---|
| `VuloCart\Shipping\Application\ShippingService` | `modules/Shipping/Application/ShippingService.php` | The free tier's own lightweight shipping engine: one marketplace-wide flat rate (the Shipping tab's `flat_rate_shipping_cost`), not zones or per-product carrier rates. `get_available_methods()` always returns at least one… |
| `VuloCart\Shipping\Module` | `modules/Shipping/Module.php` | Shipping module: shipping methods and shipping cost at checkout |
| `VuloCart\Shipping\Rest` | `modules/Shipping/Rest.php` | Shipping REST controller |

## `modules/Taxes`

| Class | File | Purpose |
|---|---|---|
| `VuloCart\Taxes\Application\Presets` | `modules/Taxes/Application/Presets.php` | VuloCart Taxes module Presets: ready-made rate sets, so a store does not type 27 EU rates by hand |
| `VuloCart\Taxes\Application\RateRepository` | `modules/Taxes/Application/RateRepository.php` | VuloCart Taxes module RateRepository: the tax-rate table and the list of tax classes |
| `VuloCart\Taxes\Application\TaxService` | `modules/Taxes/Application/TaxService.php` | Works out the tax on a cart the way current stores do it: by where the order is going and what each product is, not one rate for everything |
| `VuloCart\Taxes\Install` | `modules/Taxes/Install.php` | Owns `vulocart_tax_rates`: one row per tax rate, matched against where an order is going (country, state, postcode) and the product's tax class |
| `VuloCart\Taxes\Module` | `modules/Taxes/Module.php` | Taxes module: tax classes, tax rates and tax calculation |
| `VuloCart\Taxes\Rest` | `modules/Taxes/Rest.php` | `GET /taxes/rate` is public (the checkout labels its tax line from it); everything that edits tax classes and rates needs `manage_options` |

