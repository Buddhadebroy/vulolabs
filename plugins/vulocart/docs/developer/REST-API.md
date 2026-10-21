# REST API

Every route of the free plugin. All routes are in the namespace **`vulocart/v1`**, so the full URL is `https://your-site.com/wp-json/vulocart/v1/{route}`. Read the namespace in code from `VuloCart()->rest_namespace`.

## Access levels

| Access | Meaning |
|---|---|
| Public | No login. Used by the storefront. A cart is protected by its token (`X-Cart-Token` header or `cart_token` parameter) and an order by its access token |
| Logged in | A signed-in WordPress user (the customer's own address book) |
| Admin | The `manage_options` capability. Send the REST nonce in the `X-WP-Nonce` header from wp-admin |

`PUT / PATCH` means the route accepts both. A route that is shown with a `{name}` segment takes that value from the URL. List routes are paginated with `page` and `per_page`.

This page is generated from the controllers. If a description looks stale, fix the docblock of the controller method and regenerate.

## Products

Catalog products. Reading is public; changing is admin only.

| Method | Route | Access | What it does |
|---|---|---|---|
| GET | `/products` | Public | Lists products, paginated |
| POST | `/products` | Admin | Creates a new product |
| GET | `/products/{id}` | Public | Fetches one product by id |
| PUT / PATCH | `/products/{id}` | Admin | Updates an existing product |
| DELETE | `/products/{id}` | Admin | Deletes a single product - the Products list screen's per-row delete action |
| PUT / PATCH | `/products/bulk-status` | Admin | Bulk-updates status |
| PUT / PATCH | `/products/bulk-price` | Admin | Bulk-sets price and/or sale price across several products - "Bulk Price Update" |
| PUT / PATCH | `/products/bulk-stock` | Admin | Bulk-sets stock status and/or stock quantity across several products - "Bulk Inventory Update" |
| DELETE | `/products/bulk-delete` | Admin | Bulk-deletes products |
| POST | `/products/{id}/duplicate` | Admin | Copies a product into a new draft: same type, price, currency and details, the title ending in "(Copy)", and no SKU (a SKU is unique to one product) |

## Categories, brands, collections and tags

One controller registers the same routes for four taxonomies. Replace `{taxonomy}` with `categories`, `brands`, `collections` or `tags`.

| Method | Route | Access | What it does |
|---|---|---|---|
| GET | `/{taxonomy}` | Public | Lists terms of that taxonomy |
| POST | `/{taxonomy}` | Admin | Creates a term |
| GET | `/{taxonomy}/{id}` | Public | Fetches one term by id |
| PUT / PATCH | `/{taxonomy}/{id}` | Admin | Updates an existing term |
| DELETE | `/{taxonomy}/{id}` | Admin | Deletes a term |

## Attributes

Product attributes and their values.

| Method | Route | Access | What it does |
|---|---|---|---|
| GET | `/attributes` | Public | Lists every attribute |
| POST | `/attributes` | Admin | Creates a new attribute |
| GET | `/attributes/{id}` | Public | Fetches one attribute by id |
| PUT / PATCH | `/attributes/{id}` | Admin | Updates an existing attribute |
| DELETE | `/attributes/{id}` | Admin | Deletes an attribute |
| POST | `/attributes/{id}/values` | Admin | Adds a new value to an attribute |
| DELETE | `/attributes/values/{value_id}` | Admin | Deletes an attribute value |

## Product reviews

Only available while the Product Reviews module is active.

| Method | Route | Access | What it does |
|---|---|---|---|
| GET | `/reviews` | Admin | Lists reviews, paginated - admin only |
| POST | `/reviews` | Public | Submits a new review |
| PUT / PATCH | `/reviews/{id}` | Admin | Moderates a review (approve/reject) - admin only |
| DELETE | `/reviews/{id}` | Admin | Deletes a review |

## Inventory (stock list)

The simple stock list of the free plugin.

| Method | Route | Access | What it does |
|---|---|---|---|
| GET | `/inventory` | Admin | Lists every product of a stock-trackable type |
| PUT / PATCH | `/inventory/{id}` | Admin | Quick-updates one product's stock fields |

## Product types

Which product types the store offers.

| Method | Route | Access | What it does |
|---|---|---|---|
| GET | `/product-types` | Admin | Lists every ProductType with its description and a real, live count of products currently using it |
| PUT / PATCH | `/product-types/{type}` | Admin | Switches one product type on or off |

## Dashboard

Numbers for the admin dashboard.

| Method | Route | Access | What it does |
|---|---|---|---|
| GET | `/dashboard` | Admin | Builds the dashboard summary |

## Settings

Reads and saves the plugin settings.

| Method | Route | Access | What it does |
|---|---|---|---|
| GET | `/settings` | Admin | Returns the stored settings, merged over the defaults |
| PUT / PATCH | `/settings` | Admin | Merges the posted field subset into the stored settings |

## Modules

Reads and changes which modules are active.

| Method | Route | Access | What it does |
|---|---|---|---|
| GET | `/modules` | Admin | Every currently active module's id: zyra's `initializeModules()`/ `useModules()` expect this exact flat-array shape |
| POST | `/modules` | Admin | Activates or deactivates one module - the request shape zyra's `ModuleGridComponent` actually sends |

## Checkout engine

Checkout steps and checkout sessions. Public: a shopper has no WordPress session.

| Method | Route | Access | What it does |
|---|---|---|---|
| GET | `/checkout/steps` | Public | Assembles every registered checkout step, sorted by its own declared `order` |
| POST | `/checkout/sessions` | Public | Starts (or returns the existing) session for a cart token |
| GET | `/checkout/sessions/{token}` | Public | Fetches a session by cart token |
| PUT / PATCH | `/checkout/sessions/{token}` | Public | Records step progress on a session |

## SDK config

Bootstrap call of `@vulocart/sdk`.

| Method | Route | Access | What it does |
|---|---|---|---|
| GET | `/sdk/config` | Public | Returns the SDK's own bootstrap config: where to call, what currency to render, and which Pro delivery modes |

## Cart module

Guest and customer carts. Public; the cart token (`X-Cart-Token` header) is the access control.

| Method | Route | Access | What it does |
|---|---|---|---|
| GET | `/cart` | Public | Returns a cart, without creating a row for a token nothing has been added to yet |
| DELETE | `/cart` | Public | Removes every line item from a cart |
| GET | `/cart/totals` | Public | Returns just a cart's totals |
| POST | `/cart/items` | Public | Adds a quantity of a product to a cart |
| PUT / PATCH | `/cart/items/{item_id}` | Public | Sets a line item's quantity |
| DELETE | `/cart/items/{item_id}` | Public | Removes one line item from a cart |

## Order module

Placing, tracking and managing orders.

| Method | Route | Access | What it does |
|---|---|---|---|
| GET | `/orders` | Admin | Lists orders, paginated - admin only |
| POST | `/orders` | Public | Creates an order from a cart |
| POST | `/orders/manual` | Admin | Creates a draft order directly from a merchant-picked item list - admin only |
| GET | `/orders/track` | Public | The guest order-tracking lookup: order number + access token, both required |
| PUT / PATCH | `/orders/bulk-fulfillment-status` | Admin | Transitions many orders to the same fulfillment status in one request: backs the admin grid's bulk-action dropdown |
| DELETE | `/orders/bulk-delete` | Admin | Permanently deletes several orders |
| PUT / PATCH | `/orders/bulk-payment-status` | Admin | Transitions many orders to the same payment status in one request: same reasoning as bulk_update_fulfillment_status() |
| GET | `/orders/{id}` | Admin | Fetches one order by id - admin only |
| PUT / PATCH | `/orders/{id}` | Admin | Updates an order's payment and/or fulfillment status - admin only |
| DELETE | `/orders/{id}` | Admin | Permanently deletes one order |
| POST | `/orders/{id}/request-payment` | Admin | Emails the customer a request to pay - admin only |
| GET | `/orders/{id}/timeline` | Admin | Everything that has happened to an order, oldest first: it was placed, each payment-ledger event, and whatever other modules add through `vulocart_order_timeline` (shipments, for one) |
| POST | `/orders/{id}/refund` | Admin | Issues a refund on an order - admin only |

## Payment module

Payment methods, payment intents, webhooks and order payment actions.

| Method | Route | Access | What it does |
|---|---|---|---|
| GET | `/payment/methods` | Public | Returns every currently-available payment method |
| POST | `/payment/intent` | Public | Creates a payment intent against a cart |
| POST | `/payments/webhook/{gateway}` | Public | Dispatches an inbound gateway webhook - public, see class docblock for why |
| POST | `/orders/{id}/capture-payment` | Admin | Captures an order's authorized payment - admin only |
| POST | `/orders/{id}/cancel-payment` | Admin | Voids an order's authorized (not yet captured) payment - admin only |
| GET | `/orders/{id}/payment-transactions` | Admin | Returns an order's own payment transaction history - admin only |

## Shipping module

Shipping methods offered at checkout.

| Method | Route | Access | What it does |
|---|---|---|---|
| GET | `/shipping/methods` | Public | Returns every currently-available shipping method |

## Taxes module

Tax rate lookup and tax class / rate management.

| Method | Route | Access | What it does |
|---|---|---|---|
| GET | `/taxes/rate` | Public | Returns the currently configured tax summary |
| GET | `/taxes/classes` | Admin | Lists tax classes |
| POST | `/taxes/classes` | Admin | Adds a tax class |
| DELETE | `/taxes/classes/{slug}` | Admin | Removes a tax class |
| GET | `/taxes/rates` | Admin | Lists rates, optionally for one class |
| POST | `/taxes/rates` | Admin | Adds a rate |
| PUT / PATCH | `/taxes/rates/{id}` | Admin | Edits a rate |
| DELETE | `/taxes/rates/{id}` | Admin | Deletes a rate |
| GET | `/taxes/presets` | Admin | The ready-made rate sets |
| POST | `/taxes/presets` | Admin | Applies a preset: replaces the standard-class rates with the preset's |

## Customer module

Customer records, address book and notes.

| Method | Route | Access | What it does |
|---|---|---|---|
| GET | `/customer/me` | Public | Returns the checkout wizard's Customer step prefill values |
| GET | `/customer/me/addresses` | Logged in | Lists the logged-in requester's own saved addresses |
| POST | `/customer/me/addresses` | Logged in | Adds a saved address for the logged-in requester |
| PUT / PATCH | `/customer/me/addresses/{address_id}` | Logged in | Updates one of the logged-in requester's own saved addresses |
| DELETE | `/customer/me/addresses/{address_id}` | Logged in | Deletes one of the logged-in requester's own saved addresses |
| GET | `/customers` | Admin | Lists customers, searchable - admin only |
| DELETE | `/customers/bulk-delete` | Admin | Permanently deletes several customers |
| GET | `/customers/{id}` | Admin | Fetches one customer - admin only |
| PUT / PATCH | `/customers/{id}` | Admin | Updates a customer's own profile fields - admin only |
| DELETE | `/customers/{id}` | Admin | Permanently deletes one customer (their orders are kept) |
| GET | `/customers/{id}/orders` | Admin | A customer's own order history - admin only |
| GET | `/customers/{id}/addresses` | Admin | Lists a customer's own addresses - admin only |
| POST | `/customers/{id}/addresses` | Admin | Adds an address to a customer's own address book - admin only |
| PUT / PATCH | `/customers/{id}/addresses/{address_id}` | Admin | Updates an address in a customer's own address book - admin only |
| DELETE | `/customers/{id}/addresses/{address_id}` | Admin | Deletes an address from a customer's own address book - admin only |
| GET | `/customers/{id}/notes` | Admin | Lists a customer's own internal notes - admin only |
| POST | `/customers/{id}/notes` | Admin | Adds an internal note about a customer - admin only |
| DELETE | `/customers/{id}/notes/{note_id}` | Admin | Deletes a note - admin only |

## Address module

Address validation for the checkout.

| Method | Route | Access | What it does |
|---|---|---|---|
| POST | `/address/validate` | Public | Sanitizes and validates a posted address bag |

## Review module (checkout step)

Order summary for the checkout Review step.

| Method | Route | Access | What it does |
|---|---|---|---|
| POST | `/review/summary` | Public | Builds and returns a full order preview for the current cart plus in-progress checkout selections |

## Confirmation module

Order confirmation data for the checkout Confirmation step.

| Method | Route | Access | What it does |
|---|---|---|---|
| GET | `/confirmation/{order_number}` | Public | Returns the confirmation-step view of a just-placed order |

## AI module

VuloCloud connection and AI usage.

| Method | Route | Access | What it does |
|---|---|---|---|
| GET | `/vulocloud-ai-connection` | Admin | Returns whether this site is connected to VuloCloud and how many credits remain |
| GET | `/vulocloud-ai-connection/broker-authorize-url` | Admin | Returns the VuloCloud URL the admin should visit to connect this site, or an error when the build has no VuloCloud URL |
| POST | `/vulocloud-ai-connection/disconnect` | Admin | Removes the VuloCloud connection from this site |
| GET | `/ai/usage` | Admin | Returns the AI usage totals and the 50 most recent AI requests |

