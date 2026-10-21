# Settings System

How settings are stored, described, drawn and saved.

## Storage

Every setting lives in **one** `wp_options` row, `vulocart_settings` (`Utill::SETTINGS_KEY`), as a flat array. There is no per-tab namespacing.

`Utill::SETTINGS_DEFAULTS` lists every known key with its default, so a key that was never saved still has a sensible value. Read settings like this:

```php
$settings = wp_parse_args( get_option( \VuloCart\Utill::SETTINGS_KEY, array() ), \VuloCart\Utill::SETTINGS_DEFAULTS );
```

On/off toggle fields (`type: 'checkbox', look: 'toggle'`) are stored as an **array**: it holds the one option value when on and is empty when off. Test them with `! empty( $settings['key'] )`, not `true === …`.

Other options the plugin uses:

| Option | Content |
|---|---|
| `vulocart_all_active_module_list` | Ids of the active modules |
| `vulocart_version` | Installed database version |
| `vulocart_permalinks` | Product permalink structure (`plain`, `shop`, `base`) and base |
| `vulocart_disabled_product_types` | Product types switched off |
| `vulocart_cart_order_modules_seeded`, `vulocart_checkout_modules_seeded`, `vulocart_reviews_module_seeded` | One-time module seeding flags |

## Keys

| Key | Default | Where it is set |
|---|---|---|
| `default_currency` | `USD` | General |
| `ask_product_type` | on | General |
| `low_stock_threshold` | 5 | General |
| `listing_template` | `grid` | General (`grid`, `compact`, `list`, `showcase`) |
| `listing_columns` | `4` | General (2 to 5) |
| `cart_expiry_days` | 14 | Checkout |
| `checkout_mode` | `multi_step` | Checkout (`multi_step`, `single_page`) |
| `checkout_delivery` | `page` | Checkout (`page`; Pro: `popup`, `drawer`, `hosted`, `one_click`) |
| `checkout_steps` | all five | Checkout (Customer and Payment cannot be turned off) |
| `checkout_fields` | `name`, `phone`, `address_2` | Checkout |
| `checkout_extras` | none | Checkout (Pro: `order_notes`, `address_autocomplete`) |
| `guest_checkout_enabled` | on | Checkout |
| `require_phone_number` | off | Checkout |
| `require_terms_acceptance`, `checkout_terms_url` | off, empty | Checkout |
| `enable_manual_payment`, `default_payment_status`, `enable_bank_transfer`, `bank_transfer_instructions`, `enable_cash_on_delivery`, `payment_capture_mode` | see [PAYMENT-FRAMEWORK](PAYMENT-FRAMEWORK.md#settings) | Payments |
| `flat_rate_shipping_cost` | 0 | Shipping & Tax → Shipping rates |
| `tax_based_on`, `prices_include_tax`, `tax_shipping`, `store_country`, `store_state` | `shipping`, off, on, empty, empty | Shipping & Tax → Tax |
| `default_tax_rate_percent` | 0 | Flat fallback rate, used only until tax rates exist |
| `send_order_confirmation_email`, `send_status_update_email`, `notification_from_email` | on, on, empty | Integrations |
| `mcp_api_key` | empty | Integrations |
| `enable_debug_logging` | off | Advanced |

Pro gateways add their own keys, prefixed `vulocart_pro_{gateway}_…`.

## Describing the screens

Each tab is one file under `src/settings/` (`General.ts`, `Checkout.ts`, `Payments.ts`, `Integrations.ts`, `Advanced.ts`, `Modules.ts`, and the folder `Shipping_and_Tax/`). A file default-exports an object:

- `id`, `priority` (sort order), `headerTitle`, `headerIcon`, optional `submitUrl`
- `modal`: the list of fields. A field has a `key`, a `type` (`text`, `number`, `select`, `checkbox`, `choice-toggle`, `textarea`, `email`, `password`, `section`, ...), a `label`, a `settingDescription`, `options`, and optionally `dependent` (show only when another key is set), `proSetting`, `moduleEnabled` (locked until that module is active) and `dependentPlugin`.

`services/templateService.ts` scans the folder with `require.context` and builds the navigation tree. A folder with a `FolderPriority.ts` becomes a group (Shipping & Tax is a folder). The `vulocart_settings_context` filter lets vulocart-pro add tabs.

A tab that is not a plain field list sets `PanelComponent` (Payments, Modules, Tax rates). Pro replaces whole panels through `vulocart_settings_panel_{tab id}` (`licensing`, `shipping-zones`, `shipping-packaging`) and adds fields to existing tabs through `vulocart_settings_fields`.

| Order | Tab | File |
|---|---|---|
| 1 | General | `General.ts` |
| 3 | Checkout | `Checkout.ts` |
| 4 | Payments | `Payments.ts` |
| 5 | Shipping & Tax (Shipping rates, Zones, Packaging, Tax) | `Shipping_and_Tax/` |
| 7 | Integrations (Email, MCP, VuloCloud AI) | `Integrations.ts` |
| 8 | Advanced | `Advanced.ts` |
| 9 | Modules | `Modules.ts` |
| 90 | Licensing (Pro) | `Licensing.ts` |

## Saving

`Settings.tsx` uses zyra's `InputRenderer`, which saves **each field as it changes** (autosave, no Save button) with `PUT /settings` and a body `{ setting: { key: value } }`.

`Controllers\Settings::update_item()` sanitizes each value (arrays are handled for toggles), **merges** it into the stored option instead of replacing the option, then fires **`vulocart_settings_updated`** with the full stored settings. Merging matters because one request carries one field.

`GET /settings` returns the stored settings with defaults filled in.

## Reading settings in JavaScript

Settings that the storefront needs are printed by `Block::print_frontend_config()` as `vulocartFrontendData`. Admin screens receive module state and capability flags in `vulocartLocalizer`. They fetch the settings option itself through `GET /settings`.

## Adding a setting

1. Add the key and its default to `Utill::SETTINGS_DEFAULTS` (toggle defaults are arrays).
2. Add the field to the right file in `src/settings/`.
3. Read it in PHP through `wp_parse_args()` as above. If the storefront needs it, add it to `print_frontend_config()`.
4. If the server must enforce it (guest checkout, terms), check it again in the REST controller; never trust a value the browser sends.
