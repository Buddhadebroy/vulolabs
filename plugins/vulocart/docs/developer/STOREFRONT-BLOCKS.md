# Storefront Blocks

What a shopper sees. There are two sets of blocks.

| Set | Folder | Rendered | Blocks |
|---|---|---|---|
| Server-rendered | `blocks/` | PHP, by `Storefront\Storefront` | 23 product, cart and cart-link blocks |
| React | `src/blocks/` | JavaScript, discovered by `Block.php` | `vulocart/checkout`, `vulocart/order-tracking` |

## Server-rendered blocks

`Storefront\Storefront` registers every folder listed in `Storefront::BLOCKS` (each has a `block.json`) with `register_block_type()` and a render callback.

- They work in any block theme and are styled from the active theme's design tokens (`blocks/storefront.css`). Through the Shop pattern and the page content they also work in classic themes.
- The shopper's choices live in the URL: `vc_q` (search), `vc_cat` (category), `vc_sort`, `vc_page`. Every state is linkable and needs no JavaScript. `blocks/view.js` only auto-submits the filters and powers the add-to-cart button.
- A product's page is the same shop page with `?product=<id>` (or a pretty URL, see below). While it shows a product, the page's own heading is hidden (`hide_title_on_product`) because the product prints its title.
- `Storefront\ProductView::make()` turns a `Product` into the flat array every block prints, so price, sale state, stock and the call-to-action label are decided in one place. `make_detail()` adds the gallery, description, specifications, FAQs and all the prices the shopper can choose. Money is formatted by `ProductView::money()`.
- Sort choices (`Storefront::sort_options()`): Newest, Price low to high, Price high to low, Name A to Z.

### Collection blocks

| Block | Purpose |
|---|---|
| `vulocart/product-collection` | Queries the catalog and lays products out as a grid or list. Attributes: `perPage`, `columns`, `layout`, `orderBy`, `category` |
| `vulocart/product-filters` | Result count, search, category and sort. Attributes: `showSearch`, `showCategories`, `showSort` |
| `vulocart/product-template` | Repeats the blocks inside it once per product |
| `vulocart/product-image` | The photo, linking to the product, with sale and sold-out badges |
| `vulocart/product-title` | The name, optionally as a link |
| `vulocart/product-price` | The price, with the original struck through on sale |
| `vulocart/product-summary` | The short description |
| `vulocart/product-add-to-cart` | Adds to the cart in one tap, or opens the product when a choice is needed (types in `ProductView::QUICK_ADD_TYPES`) |
| `vulocart/product-pagination` | Page links |
| `vulocart/product-no-results` | Shown when nothing matches |

### Product page blocks

| Block | Purpose |
|---|---|
| `vulocart/product-details` | The single-product page; arrange the blocks inside it |
| `vulocart/product-breadcrumbs` | Home › Shop › Product |
| `vulocart/product-gallery` | Large image with thumbnails |
| `vulocart/product-purchase` | Price options, quantity, buy button and stock |
| `vulocart/product-stock` | Savings and availability |
| `vulocart/product-trust` | Shipping, returns and secure-checkout notes |
| `vulocart/product-facts` | SKU, brand, collection and type |
| `vulocart/product-content` | The long description |
| `vulocart/product-specs` | Details, specifications or shipping and returns as a card |
| `vulocart/product-faqs` | Questions and answers |
| `vulocart/product-rating` | Average stars and review count (card or product page); empty until a review is approved |
| `vulocart/product-reviews` | Rating breakdown, latest approved reviews and the review form. Needs the Product Reviews module; the form posts to `POST /reviews` (honeypot field `website`, five reviews an hour per address) and a new review stays `pending` until approved |
| `vulocart/product-related` | Other products: the ones picked on the product screen, then the same category, then (option) the newest. Attributes `heading`, `count`, `columns`, `fallback` |
| `vulocart/product-recently-viewed` | The products this browser looked at last (kept in `localStorage`), filled in by `blocks/view.js` through `GET /storefront/cards`. Hidden until there is something to show |
| `vulocart/product-share` | X, Facebook, WhatsApp and email links, copy-link and the device share sheet; no third-party script |
| `vulocart/product-compare` | Table of the products ticked with "Compare" (up to four, in `localStorage`), from `GET /storefront/compare`. The tick and the floating Compare link appear only once a page holds this block |
| `vulocart/product-extras` | Sections added by extensions, such as the Digital Product Passport. Filled through the `vulocart_storefront_product_sections` filter |

### Cart blocks

| Block | Purpose |
|---|---|
| `vulocart/cart` | The cart: items, quantities, summary and checkout button |
| `vulocart/cart-link` | A bag icon with the item count, for a header or navigation |

### Patterns and templates

`Storefront` registers a pattern category "VuloCart" and three patterns: **Shop page**, **Cart page**, **Checkout page**. When WordPress supports `register_block_template()` it also registers the templates `vulocart//shop`, `vulocart//cart` and `vulocart//checkout` (theme header and footer around the block layouts). `Storefront::shop_markup()`, `cart_markup()` and `checkout_markup()` produce the block markup shared by the patterns and the templates.

## Product permalinks

`Storefront\Permalinks` decides where a product's page lives, chosen under Settings → Permalinks (the option `vulocart_permalinks`):

| Structure | Example |
|---|---|
| `shop` (default) | `/shop/blue-bottle/` on the shop page |
| `base` | `/product/blue-bottle/` with a base of your choice |
| `plain` | `?product=12` |

The plain form keeps working whichever is chosen and redirects to the pretty address (`redirect_plain_links`). Changing the structure schedules a rewrite rules flush.

## React blocks

`Block.php` globs `assets/js/block/*/block.json`, so a new `src/blocks/{name}/` folder is picked up after a build with no PHP change.

- **`vulocart/checkout`** (`customize`, `layout`, `steps`, `fields`): the checkout. The block can override the site's layout, steps and optional fields for its page. See [CHECKOUT-ENGINE](CHECKOUT-ENGINE.md).
- **`vulocart/order-tracking`**: a guest enters the order number and access token and sees the status (`GET /orders/track`).

`Block::print_frontend_config()` prints `vulocartFrontendData` on every frontend page: the REST root and namespace (`apiUrl`, `restUrl`), the checkout settings (`checkoutMode`, `checkoutDelivery`, `checkoutSteps`, `checkoutFields`, `checkoutExtras`, guest checkout, phone and terms requirements), the signed-in user, the listing template and columns, and the page URLs `checkoutPageUrl`, `cartPageUrl`, `productsPageUrl` and `shopPageUrl` (found by looking for the first published page that contains the block; cached in a transient that is cleared on every `save_post`). The action `vulocart_frontend_config_printed` fires afterwards so Pro can print its own data.

All block scripts depend on the shared `vendors.js` chunk (`enqueue_shared_vendors_chunk()`), otherwise a block that imports `axios` silently fails to mount.

## Related

- [CATALOG](CATALOG.md) - the data these blocks show
- [CHECKOUT-ENGINE](CHECKOUT-ENGINE.md)
- [User guide: storefront](../user/CHECKOUT.md)

Product pages saved before the reviews and related blocks existed still get both at the end of the details. Place the block yourself to move it, or return `false` from `vulocart_auto_product_reviews` / `vulocart_auto_related_products` to drop the automatic one.

The share links go under the buy button, and recently viewed after the related products, on product pages that do not place those blocks; the filters `vulocart_auto_product_share` and `vulocart_auto_recently_viewed` turn each off. `vulocart_product_page_sections` lets another plugin add sections under the details (vulocart-pro's Upsells and Stock Alerts modules use it). The class is `Storefront\Discovery`; its public `views_for()` and `cards_html()` give an extension the shop's own cards.
