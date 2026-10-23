# Modules in the Free Plugin

The 12 modules of the free plugin live in `modules/`. How modules are discovered and loaded is in [ARCHITECTURE](ARCHITECTURE.md#modules). For each module this page lists what it does, what it registers and which tables it owns.

| Module id | Core? | Registers on the container | Tables |
|---|---|---|---|
| `cart` | yes | `cart_service` | `vulocart_carts`, `vulocart_cart_items` |
| `order` | yes | `order_service` | `vulocart_orders`, `vulocart_order_items` |
| `customer` | yes | `customer_service` | `vulocart_customers`, `vulocart_customer_addresses`, `vulocart_customer_notes` |
| `address` | yes | `address_service` | none |
| `payment` | yes | `payment_service` | `vulocart_payment_transactions` |
| `review` | yes | `order_review_service` | none |
| `confirmation` | yes | none | none |
| `shipping` | no | `shipping_service` | none |
| `taxes` | no | `tax_service` | `vulocart_tax_rates` |
| `product-reviews` | no | `review_service` | uses the core `vulocart_reviews` |
| `mcp` | no | none | none |
| `ai` | no | `ai_client` | `vulocart_ai_usage_log` |

"Core" modules are listed in `Modules::CORE_MODULE_IDS`: they have no card on the Modules screen and are always on.

## Cart

**Purpose.** Shopping carts for guests and signed-in customers.

- A cart is identified by an opaque **token** the client stores (`localStorage` in the storefront, the `X-Cart-Token` header on REST calls). There is no WordPress session, so a headless storefront or an app can use the same routes.
- `CartService::add_item()` snapshots the product's price and currency into the line, so a later price change does not alter an item already in the cart. A line is the pair (product, price id).
- `CartService::get_totals()` returns `subtotal` and `total` (equal here); shipping and tax are added when the order is created.
- `CartCleanupScheduler` registers a daily cron event `vulocart_cleanup_expired_carts` that deletes carts untouched for `cart_expiry_days` (Settings → Checkout, default 14).
- Dispatches `cart_updated`.
- Routes: `/cart`, `/cart/items`, `/cart/items/{id}`, `/cart/totals`. All public.

## Order

**Purpose.** Orders and their line items. Requires the Cart module (`Module::is_compatible()`); the service is created on `vulocart_loaded`.

- `OrderService::create_from_cart()` turns a cart into an order in one call. It snapshots each line (title, price, currency), computes the shipping cost and tax on the server (never taken from the client), applies the `vulocart_order_total` filter, clears the cart, then asks the Payment module to charge. If no payment module or method is involved the payment status stays at the default from Settings → Payments.
- An order has two independent statuses. **Payment status**: `pending`, `paid`, `failed`, `refunded`. **Fulfillment status**: `draft`, `pending`, `processing`, `shipped`, `completed`, `cancelled`. `draft` is an order an admin created by hand (`create_manual_order()`).
- Each order has a human `order_number` and an `access_token`. A guest can look the order up with both (`GET /orders/track`); the number alone is not enough because it is sequential.
- Money fields: `subtotal`, `shipping_cost`, `tax_amount`, `total`, plus `authorized_amount`, `captured_amount` and `refunded_amount` for the payment lifecycle.
- Events: `order_created`, `order_payment_status_changed`, `order_fulfillment_status_changed`, `order_refunded`, `order_deleted`. The `vulocart_order_timeline` filter lets modules add entries to the order timeline.
- Refunds go through `refund_order_via_gateway()`, which asks the order's gateway first and then records the amount.
- Routes: `/orders` (public create, admin list), `/orders/track`, `/orders/manual`, `/orders/{id}` and its sub-routes, bulk routes. See [REST-API](REST-API.md#order-module).

## Customer

**Purpose.** A stored customer for every buyer, with an address book and private notes.

- Listens to `vulocart_order_created` and finds or creates the customer by email (`find_or_create_by_email()`), then updates `total_orders`, `total_spent` and `last_order_at`.
- Totals are refreshed when an order's payment or fulfillment status changes or the order is deleted, so a refund or a cancellation is reflected. `maybe_backfill_totals()` recomputes all totals once for stores that counted the old way.
- A signed-in buyer's name, email and remembered phone prefill the checkout (`resolve_current()`).
- Adds the Customer step to the checkout through `vulocart_checkout_steps`.
- Deleting a customer removes their addresses and notes; their orders are kept because they are sales records.
- Events: `customer_created`, `customer_deleted`.
- Routes: `/customers…` (admin), `/customer/me` (public, checkout prefill) and `/customer/me/addresses…` (logged-in users).

## Address

**Purpose.** Cleans and validates addresses.

- `AddressService::FIELDS` is the fixed shape of an address: `full_name`, `phone`, `address_1`, `address_2`, `city`, `state`, `postcode`, `country`. `sanitize()` always returns exactly these keys.
- `REQUIRED_FIELDS` are the ones `validate()` insists on. `address_2` and `phone` are optional.
- `POST /address/validate` lets the Address step warn about a missing field early. The saved address is checked again by `Order\Rest::create_item()`.
- Adds the Address step to the checkout.

## Shipping

**Purpose.** The shipping methods offered at checkout and their cost.

- `ShippingService::get_available_methods()` always returns at least one method: a flat rate (the amount from Settings → Shipping & Tax → Shipping rates; 0 is shown as free shipping).
- The `vulocart_shipping_methods` filter lets another module add methods. vulocart-pro's Fulfillment module adds zone and weight-based rates here.
- `calculate_cost()` resolves the chosen method id to a cost when the order is created. An unknown id gives 0.0 instead of an error, so an order is never lost over a stale selection.
- Adds the Shipping step to the checkout.
- Route: `GET /shipping/methods` (public; optional `cart_token`, `country`, `state`).

## Taxes

**Purpose.** Tax classes, tax rates and tax calculation.

- `TaxService::calculate_cart()` works out tax by destination (country, state, postcode), tax class, priority (stacked taxes such as CGST + SGST), tax on shipping and tax-inclusive prices. Settings are described in [the user guide](../user/SHIPPING-AND-TAX.md).
- Where the tax address comes from is `tax_based_on`: the shipping address, billing address or the store address (`store_country`, `store_state`).
- If no rates exist yet, one flat rate (`default_tax_rate_percent`) applies to everything, so upgrading changes nothing until rates are entered.
- `Presets` offers ready-made rate sets (EU VAT, UK VAT, India GST and more) that an admin can apply.
- Filters: `vulocart_tax_calculation` (a provider such as vulocart-pro's Stripe Tax can return the whole result) and `vulocart_tax_exempt` (a module such as Tax IDs can zero the tax for a buyer).
- No checkout step: tax has nothing for the shopper to enter. The result shows in the Review step.
- Routes: `/taxes/rate` (public), `/taxes/classes`, `/taxes/rates`, `/taxes/presets` (admin).

## Payment

**Purpose.** The payment framework and the offline gateways. Described in detail in [PAYMENT-FRAMEWORK](PAYMENT-FRAMEWORK.md).

- Gateways: manual payment, bank transfer, cash on delivery (`Payment/Gateways/`). Online gateways are added by vulocart-pro on the `vulocart_payment_gateways` filter.
- Adds the Payment step to the checkout.
- Owns the `vulocart_payment_transactions` ledger.

## Review (checkout step)

**Purpose.** Shows the buyer the real final total before they place the order.

- `OrderReviewService::build_summary()` recomputes what `create_from_cart()` would charge (items, shipping, tax) without saving anything.
- `POST /review/summary` is public and takes the cart token and the selections made so far.
- Not related to product reviews; see the next module.

## Confirmation (checkout step)

**Purpose.** The final "Thank you" step. `GET /confirmation/{order_number}` returns the same data as order tracking, through its own route so the two can change independently.

## Product Reviews

**Purpose.** Customer reviews of products and their moderation.

- Adds the Reviews tab to the VuloCart menu and the `/reviews` routes. A review has a status (pending, approved, rejected) and can be approved, rejected or deleted by an admin. Submitting a review is public.
- The dashboard shows the number of reviews waiting for moderation.
- Switching the module off removes the screen and routes; the stored reviews stay in `vulocart_reviews` and come back when it is switched on again. The domain classes, repository and table stay in core; the module builds `VuloCart()->review_service` only while it is active.
- Events: `review_submitted`, `review_moderated`.

## MCP

**Purpose.** The on/off switch for the store's Model Context Protocol server.

The module has no code beyond its constructor. The server itself is vulocart-pro's McpServer module, which follows this card (`mcp` → `mcp-server` in the companions map). Activating the module unlocks the MCP API key field in Settings → Integrations.

## AI

**Purpose.** Connects the store to VuloCloud AI. See [AI-ARCHITECTURE](AI-ARCHITECTURE.md).

- Creates `VuloCart()->ai_client` and the `vulocart_ai_usage_log` table.
- Routes under `/vulocloud-ai-connection` (status, authorize URL, disconnect) and `/ai/usage`. All admin.
- The connect callback is the admin-post action `vulocart_connect_broker_callback`.

## Adding a module

1. Create `modules/MyModule/Module.php` in namespace `VuloCart\MyModule` (or, in a plugin, a folder registered through `vulocart_module_sources`).
2. Do the wiring in the constructor. If you need another module's service, either declare `is_compatible()` and wire on `vulocart_loaded`, or resolve the service only when it exists.
3. Create tables from `Install.php` on `vulocart_activated_module_my-module` with a schema version option.
4. Add a card to `src/modules-config.ts` whose `id` equals the kebab-case folder name. A card whose id has no folder switches itself back off.
5. If the module should switch together with another card, add it to the companions map through `vulocart_module_companions`.
