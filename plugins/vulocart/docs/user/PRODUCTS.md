# Products

## What it does

**Products** is where you add, price, photograph and organize everything you sell. A product can be a physical item, a download, a course, a service, a membership, a booking, a rental, a bundle, a donation or a gift card.

## Why it matters

A shopper can only buy a product that is **Published** and has a **price**. Good names, photos and descriptions are what sell it.

## The product list

**Products → All Products** lists every product.

Each row shows the product (name, image, type, SKU and status), its price, and the actions you can take on it: **Edit**, **Quick edit**, **Duplicate** and **Delete**.

What you can do:

- **Search** by title or SKU, and filter by **Status**, **Type** and **Category**.
- **Save view** keeps your current status, type, category and search as a tab you can open again. **Delete saved view** removes it.
- **Quick edit** changes name, status, SKU, catalog visibility, regular and sale price, availability, units in stock and "Featured" without leaving the list. **Open full editor** goes to the full page.
- **Duplicate** copies a product into a new draft ending in "(Copy)". The copy has no SKU, because a SKU belongs to one product.
- **Select several products** to change status, price, sale price or stock for all of them in one go ("Fill in only what you want to change"), or to delete them.
- **Export** downloads the list as CSV.

Some badges help you spot problems: **Marked out of stock**, **No price** (cannot be bought yet), **Hidden** (not shown in the shop or search).

## Add a product

1. Go to **Products → Add New**.
2. On the **What are you selling?** screen pick a type (Physical, Digital, Subscription, Course, Service, Membership, Booking, Rental, Bundle, Donation, Gift card). Some types ask for a kind, for example Physical → *Standard*, *With options*, *Pre-order* or *Made to order*. You can turn this screen off under Settings → General ("Start with What are you selling?"); then you pick the type on the product page.
3. Fill in the cards below and press **Save**. The **Setup progress** box tells you what is still missing and shows **Ready to publish** when the basics are done.
4. Set the status to **Published** (**Change status**) when you want it in the shop.

### The cards

| Card | What you enter |
|---|---|
| **Product Details** | Name, short description (one-line summary) and full description. You can mark a product **Featured** |
| **Pricing** | One or more prices (amount, optional sale amount) and the currency. A product can have several prices, for example sizes or tiers; one is the default. Pro adds recurring prices |
| **Type Details** | Fields that only matter for this type, for example lessons and skill level for a course, billing interval for a subscription, denominations for a gift card |
| **Attributes & Variations** | Options such as size or colour. Variants need the Pro module *Variants*; without it the card says variants are not supported |
| **Inventory** | **Track stock**, units on hand, availability (In stock, Out of stock, Available on backorder) and a running-low warning. Shown only for types that have stock |
| **Shipping** | Weight, package size (length, width, height) and shipping class (Standard, Fragile, Oversized, Free shipping). Shown only for types that ship, so checkout can price delivery |
| **Policies & Related Products** | Shipping, refund and cancellation policies, "Recommend alongside this product" (you might also like) and "Offer as an add-on at checkout". Related products are entered as comma-separated product ids |
| **Search & content** | How the listing appears in search, a **Specifications** table, **Frequently asked questions** and **Translations** |
| **Images** | The featured image (cards and the top of the product page) and more photos |
| **Catalog & Sourcing** | Category, tags, brand and collections |
| **Embed code** | Ready-to-paste code to sell this product from any page with the VuloCart SDK (available once the product exists) |

A card only appears if you cannot sell that kind of product without it. A donation never asks for a shipping policy.


### Checks before saving

VuloCart warns you when:

- the name is empty ("Give this product a name"),
- there is no price ("Add a price before publishing - enter 0 if it is free"),
- stock is tracked but no quantity is entered,
- units in stock is 0 but the product is not marked out of stock.

### Other actions in the editor

- **View product** or **Preview product** opens the product page.
- **Change product type** goes back to the type screen.
- **More actions (…)** holds extra actions; Pro adds "Save as template".
- A **Storefront preview** shows how the card will look as you type.

## Product types you can turn off

Under **Products → Product Types** you can switch off types you never sell, so they are not offered when adding a product. Existing products keep working. At least one type must stay on. See [ORGANIZING-PRODUCTS](ORGANIZING-PRODUCTS.md).

## Settings explained

| Setting | Where | What it does |
|---|---|---|
| Store currency | Settings → General | Currency for new products (ISO code such as USD, EUR, GBP, INR) |
| Start with "What are you selling?" | Settings → General | Start new products on the type screen |
| Low stock threshold | Settings → General | Quantity at or below which a product counts as low stock |
| Product listing and columns | Settings → General | How the shop shows products: Grid, Compact, List or Showcase, and 2 to 5 columns |

## Related

- [ORGANIZING-PRODUCTS](ORGANIZING-PRODUCTS.md) - categories, brands, attributes
- [CHECKOUT](CHECKOUT.md) - showing products in your shop
- [REVIEWS](REVIEWS.md)

## What shoppers see on a product page

Besides the details, shoppers get these automatically (each is also a block you can place or remove in the page editor):

- **Reviews** with the rating breakdown and a form (see [REVIEWS](REVIEWS.md)).
- **Related products**. With VuloCart Pro, the Marketing card also adds **Complete the set** (the add-ons you picked on the product screen, optionally as a "bought together" list with one button).
- **Share** links (X, Facebook, WhatsApp, email, copy link).
- **Notify me** when the product is sold out is part of VuloCart Pro (Inventory): shoppers leave an email and get one message when you save the product as available again.
- **Recently viewed** products, remembered in the shopper's browser.
- **Compare**: add the **Product Compare** block to one page, and every card gets a "Compare" tick (up to four products) with a floating link to that page.
