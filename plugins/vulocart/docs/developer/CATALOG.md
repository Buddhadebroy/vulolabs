# Catalog: Products, Prices and Taxonomies

The catalog is part of the always-on core (it is not a module). Everything is in `classes/`: the entities in `Domain/`, the rules in `Application/`, the storage in `Infrastructure/Database/` and the routes in `RestAPI/Controllers/`.

## Products

One table, `vulocart_products`, holds every product of every type. The columns every product has are `type`, `title`, `slug`, `sku`, `status`, `price` and `currency`. Everything else is stored in two JSON columns: `meta` (type-specific details and content) and `passport` (the Digital Product Passport, see vulocart-pro).

`Domain\Product\Product` is a plain object. `Application\ProductService` is the only class that talks to `ProductRepositoryInterface`; the REST controller and any other caller (an MCP tool, for example) go through the service.

### Statuses

`draft`, `published`, `archived`.

### Types

`Domain\Product\ProductType` is the closed list of values the `type` column accepts:

| Type | Meant for | Subtypes in the editor |
|---|---|---|
| `physical` | A product you ship | Standard, With options, Pre-order, Made to order |
| `digital` | A file, key or online access | File download, Software & keys, Online access |
| `subscription` | Billed on a schedule | Access plan, Box |
| `course` | Lessons a student works through | Self-paced, Live cohort |
| `service` | Work done for the customer | Fixed project, Session |
| `membership` | Ongoing access to perks | Fixed term, Recurring, Lifetime |
| `booking` | A time slot, seat or ticket | Appointment, Group class, Event ticket |
| `rental` | Something used for a period and returned | Equipment, Space or venue |
| `bundle` | Several products sold together | Fixed set, Mix & match |
| `donation` | A contribution of any amount | General, Campaign |
| `gift_card` | A balance redeemed later | Digital, Physical |
| `license` | Older license products, kept as they are | Standard |

The editor decides which cards a type needs from `src/pages/Products/typeProfiles.ts`: a card or field appears only if the merchant cannot sell that kind of product without it (a course never asks for a package weight). The REST controller keeps matching lists (`SUBTYPES`, `TYPE_DETAIL_FIELDS`) so nothing else is ever stored. Types the store has switched off under **Product Types** are not offered when adding a product.

### Prices

A product can have several prices, stored in `meta['prices']` and normalised by `Product::prices()`. Each price has an id, a type, a label, an amount, an optional sale amount, a currency and an active flag; exactly one is the default.

- Free knows one price type, `one_time`. A plugin adds others with the `vulocart_price_types` filter (all types that may be stored) and `vulocart_purchasable_price_types` (the ones the cart will sell). vulocart-pro's Subscriptions module adds a recurring type this way.
- `PriceCatalog::sanitize()` cleans a submitted list. Unknown types are kept, not turned into one-time prices, so switching a module off does not destroy the data.
- `PriceCatalog::reconcile()` keeps the `price` column, `meta['sale_price']` and the default price saying the same thing.
- `Product::current_price()` is what a customer pays before pricing rules. The `vulocart_product_effective_price` filter lets a module (vulocart-pro's Pricing Rules) change it; the cart snapshots the result.
- A cart or order line remembers which price it was bought at (`PriceCatalog::line_price()`).

### Events

`product_created`, `product_updated`, `product_deleted`. Deleting a product does not touch order lines that reference it.

## Taxonomies

Categories, brands, collections and tags share one table, `vulocart_terms`, told apart by the `taxonomy` column (`Domain\Term\Taxonomy`: `category`, `brand`, `collection`, `tag`). Categories can be nested through `parent_id`. A brand can carry a logo reference in `meta`. One controller, `Controllers\Terms`, serves all four under `/categories`, `/brands`, `/collections` and `/tags`.

Events: `term_created`, `term_updated`, `term_deleted`.

## Attributes

`vulocart_attributes` (for example Color) and `vulocart_attribute_values` (Red, Blue). `Application\AttributeService` manages them; the `/attributes` routes expose them. vulocart-pro's Variants module uses them to generate variants.

Events: `attribute_created`, `attribute_updated`, `attribute_deleted`.

## Inventory (free)

The free stock list is a view over the product columns and `meta`: stock quantity and stock status per product (`/inventory`). `low_stock_threshold` in Settings → General decides when a product counts as low. Multi-warehouse inventory is vulocart-pro's Inventory module.

## Product list and editor extension points

The product screens expose JavaScript filters so Pro modules can add to them: `vulocart_product_edit_sections`, `vulocart_product_variants_section`, `vulocart_product_pricing_section`, `vulocart_product_inventory_section`, `vulocart_product_organization_fields`, `vulocart_product_list_buttons`, `vulocart_product_more_actions` and others. They are listed in [EXTENSION-POINTS](EXTENSION-POINTS.md#javascript-filters).

## Related

- [STOREFRONT-BLOCKS](STOREFRONT-BLOCKS.md) - how products are shown to shoppers
- [DATABASE](DATABASE.md) - the table definitions
- [REST-API](REST-API.md#products) - the product routes
