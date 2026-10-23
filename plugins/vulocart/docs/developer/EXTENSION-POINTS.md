# Extension Points

Every hook, filter and JavaScript slot that vulocart-pro and third parties use to extend the free plugin. The names are stable; new hooks use the `vulocart_` prefix.

## Boot and modules

| Hook | Type | Arguments | Purpose |
|---|---|---|---|
| `vulocart_loaded` | action | none | Fired at the end of `VuloCart::init_classes()`. Anything that depends on the free plugin boots here |
| `vulocart_module_sources` | filter | `array( array( 'path' => …, 'namespace' => … ) )` | Add a folder of modules. The path must end with a slash; the namespace is the root of the module classes |
| `vulocart_module_companions` | filter | `array<card, string[]>` | Modules that switch on and off with a Modules-screen card |
| `vulocart_activated_module_{id}` | action | the module instance | Fired for each active module on every request. Create tables here (guard with a schema version) |
| `vulocart_deactivated_module_{id}` | action | the module instance | Fired when an admin switches a module off |
| `vulocart_after_installed` | action | none | Fired once the core tables are created |
| `vulocart_settings_updated` | action | the full stored settings | Fired after a settings save |
| `vulocart_update_pro_data` | filter | `array` | Pro reports its version and account link here |
| `kothay_dabba_vulocart` | filter | `false` | Pro answers `true` while installed, active and licensed. Read it through `Utill::is_khali_dabba()` |
| `vulocart_rest_controllers` | filter | `array<string, WP_REST_Controller>` | Add a controller to the central dispatcher. Anything that is not a `WP_REST_Controller` is ignored |

## Events

`EventDispatcher::dispatch( 'name', $payload )` fires the action `vulocart_{name}` with one array argument. Listeners react; they do not decide.

| Action | Payload keys | Fired when |
|---|---|---|
| `vulocart_product_created`, `_updated`, `_deleted` | `product` | A product changes |
| `vulocart_term_created`, `_updated`, `_deleted` | `term` | A category, brand, collection or tag changes |
| `vulocart_attribute_created`, `_updated`, `_deleted` | `attribute` | An attribute changes |
| `vulocart_review_submitted`, `vulocart_review_moderated` | `review` | A product review is submitted or moderated |
| `vulocart_cart_updated` | `cart_token` | Items are added, changed or removed |
| `vulocart_checkout_session_completed` | `session` | A checkout session ends in an order |
| `vulocart_order_created` | `order` | An order is placed |
| `vulocart_order_payment_status_changed` | `order` | The payment status changes |
| `vulocart_order_fulfillment_status_changed` | `order` | The fulfillment status changes |
| `vulocart_order_refunded` | `order` | An order is refunded |
| `vulocart_order_deleted` | `order` | An order is deleted (the order as it was) |
| `vulocart_customer_created`, `vulocart_customer_deleted` | `customer` | A customer record is created or removed |

vulocart-pro also fires `vulocart_pro_inventory_low` (`product_id`, `quantity`, `threshold`), `vulocart_pro_shipment_delivered` (`shipment`) and `vulocart_pro_ai_event` (`event`, `order_id`, `data`); the Workflow Builder listens to them.

## Checkout, payment, shipping and tax

| Hook | Type | Arguments | Purpose |
|---|---|---|---|
| `vulocart_checkout_steps` | filter | `array<{id, label, order, rest_base}>` | Add a checkout step descriptor |
| `vulocart_checkout_mode` | filter | `'single_page'\|'multi_step'` | Change the checkout layout |
| `vulocart_checkout_delivery` | filter | `'page'\|'popup'\|'drawer'\|'hosted'\|'one_click'` | Change where "Proceed to checkout" leads |
| `vulocart_payment_gateways` | filter | `array<id, PaymentGatewayInterface>` | Register a payment gateway |
| `vulocart_shipping_methods` | filter | `$methods`, `$context` | Add or change shipping methods. `$context` may hold `shipping_address`, `cart_weight`, `cart_subtotal` |
| `vulocart_tax_calculation` | filter | `null`, `$context` | A tax provider returns the whole result array (with `amount`), or null to use the built-in rates |
| `vulocart_tax_exempt` | filter | `false`, `$context` | Return true to make an order tax-free |
| `vulocart_order_total` | filter | `$total`, `$context` | Change an order's total (coupons and gift cards). Used by order creation and the Review summary alike |
| `vulocart_order_timeline` | filter | `$events`, `$order_id` | Add entries to an order's timeline |
| `vulocart_product_effective_price` | filter | `$price`, `$product` | Change the price a product is added to the cart at |
| `vulocart_price_types` | filter | `array<id, {label}>` | Declare more price types |
| `vulocart_purchasable_price_types` | filter | `string[]` | Say which price types the cart will sell |
| `vulocart_customer_high_value_threshold` | filter | `500` | Amount above which a customer counts as high value |
| `vulocart_storefront_product_sections` | filter | `string[]`, `$product` | Extra HTML sections on the product page (the "Product Extras" block) |
| `vulocart_frontend_config_printed` | action | none | Fires after `vulocartFrontendData` is printed; print your own storefront config here |

## vulocart-pro hooks

| Hook | Type | Purpose |
|---|---|---|
| `vulocart_shipping_carriers` | filter | Register carriers for live rates and labels |
| `vulocart_pro_workflow_action_sources` | filter | Add workflow action classes |
| `vulocart_pro_mcp_tool_sources`, `vulocart_pro_mcp_resource_sources` | filter | Add MCP tool and resource classes |
| `vulocart_pro_address_autocomplete_provider` | filter | Supply an address lookup provider (default: none) |
| `vulocart_pro_document_store` | filter | Seller details printed on invoices and packing slips |
| `vulocart_pro_force_storefront_script` | filter | Load the Pro storefront script on a request that has no checkout block |
| `vulocart_pro_sdk_bundle_url` | filter | URL of the Pro SDK bundle |
| `vulocart_pro_license_grace_period_days` | filter | Days a licence stays valid after a failed server check |
| `vulocart_stripe_tax_failed` | action | Stripe Tax could not be used and the built-in rates were applied |

## JavaScript filters

All are `@wordpress/hooks` filters (`addFilter( name, namespace, callback )`). Free reads them with `applyFilters()`. A filter only has an effect for the screens that apply it.

### Engine screens

Menus built on `EngineScreen` resolve their pages through `vulocart_{engine}_view`. The callback receives `( previousValue, { view, … } )` and returns the page for that `view`, or the previous value when it is not its view. When nothing answers, the screen shows a "module required" panel that explains which module or licence is missing.

| Filter | Screen |
|---|---|
| `vulocart_ai_view` | AI. With `layout: 'card'` each module returns its card |
| `vulocart_fulfillment_view` | Shipment |
| `vulocart_inventory_view` | Inventory tabs |
| `vulocart_marketing_view` | Marketing |
| `vulocart_orders_view` | Extra order views (for example Subscriptions) |
| `vulocart_workflows_view` | Workflows |
| `vulocart_analytics_view` | Insights section of the Dashboard |
| `vulocart_products_extra_view`, `vulocart_customers_extra_view` | Views only a third party module knows (`&view=…`) |
| `vulocart_inventory_overview` | Extra panels on the Inventory overview |

### Product screens

| Filter | Purpose |
|---|---|
| `vulocart_product_edit_sections` | Cards appended to the center column of the product editor. Receives `{ id, type, subtype, shippable }` |
| `vulocart_product_pending_sections` | Descriptors of "coming" sections shown as notices |
| `vulocart_product_variants_section` | Replaces the "Attributes & Variations" notice (single winner) |
| `vulocart_product_pricing_section`, `vulocart_product_inventory_section` | Content inside the pricing and inventory cards |
| `vulocart_product_organization_fields` | Extra fields in the Organization card |
| `vulocart_product_price_types` | Price types the editor offers |
| `vulocart_product_ai_button` | An AI button beside a field |
| `vulocart_product_add_prefill` | Quick-start options above a new product (AI draft, saved templates) |
| `vulocart_product_more_actions` | Items in the editor's "…" menu |
| `vulocart_product_list_buttons`, `vulocart_product_list_overlay`, `vulocart_product_row_action_items` | Buttons, overlays and row actions on the product list |

### Orders, customers and settings

| Filter | Purpose |
|---|---|
| `vulocart_order_edit_main_sections`, `vulocart_order_edit_sections` | Cards in the main and side columns of the order screen. Receives `{ id }` |
| `vulocart_customer_detail_sections` | Cards on the customer page. Receives `{ id, customer }` |
| `vulocart_settings_context` | Add settings tabs (a `require.context`) |
| `vulocart_settings_fields` | Add fields to a settings panel (the Payments tab applies it) |
| `vulocart_settings_panel_licensing`, `vulocart_settings_panel_shipping-zones`, `vulocart_settings_panel_shipping-packaging` | Replace the content of those tabs with a component |
| `vulocart_shipping_rates` | Extra content on the shipping rates tab |
| `vulocart_checkout_states` | Add states or regions for a country in the checkout address form |

## The checkout registry

`window.vulocartCheckoutEngine` exposes `registerCheckoutStep`, `registerCheckoutStepExtension`, `registerOrderPlacedHandler`, `registerPaymentMethodRenderer`, `mount` and `unmount`. See [CHECKOUT-ENGINE](CHECKOUT-ENGINE.md).

## Recipes

**Add a module from your own plugin**

```php
add_filter( 'vulocart_module_sources', function ( $sources ) {
	$sources[] = array(
		'path'      => plugin_dir_path( __FILE__ ) . 'modules/',
		'namespace' => 'MyPlugin',
	);
	return $sources;
} );
```

Put `modules/Wishlist/Module.php` (class `MyPlugin\Wishlist\Module`) there and add a card with the id `wishlist` to the Modules screen.

**Change the order total**

```php
add_filter( 'vulocart_order_total', function ( $total, $context ) {
	return max( 0, $total - my_discount_for( $context['cart_token'] ) );
}, 10, 2 );
```

**Show a custom page for `?page=products&view=suppliers`**

```js
addFilter( 'vulocart_products_extra_view', 'my-plugin/suppliers', ( previous, { view } ) =>
	'suppliers' === view ? <SuppliersPage /> : previous
);
```
