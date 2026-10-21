# Settings

## What it does

**VuloCart → Settings** holds every option of the store. Settings **save as you change them**: there is no Save button. A small message confirms each save.

You can also find any setting from the **search box** in the header: it searches tabs, settings and modules.

## The tabs

| Tab | What it covers | Guide |
|---|---|---|
| **General** | Default currency, "Ask what you're selling first", low stock threshold, product listing layout | below |
| **Checkout** | Cart expiry, checkout layout, steps, fields, guest checkout, phone, terms | [CHECKOUT](CHECKOUT.md) |
| **Payments** | Manual payment, bank transfer, cash on delivery, capture mode | [PAYMENTS](PAYMENTS.md) |
| **Shipping & Tax** | Flat rate shipping, tax rates, tax classes, tax settings (Pro adds Zones and Packaging) | [SHIPPING-AND-TAX](SHIPPING-AND-TAX.md) |
| **Integrations** | Order emails, MCP, VuloCloud AI | below |
| **Advanced** | Debug logging | below |
| **Modules** | Switch features on and off | [MODULES](MODULES.md) |
| **Licensing** | Activate VuloCart Pro (only when Pro is installed) | Pro guide |

## General

### Defaults

| Setting | What it does |
|---|---|
| **Default currency** | The ISO 4217 code (USD, EUR, GBP, INR…) used when a new product is created without a currency |
| **Ask what you're selling first** | When you add a product, start on the "What are you selling?" screen. Turn off to pick the type on the product page |

### Inventory

| Setting | What it does |
|---|---|
| **Low stock threshold** | Quantity at or below which a stock-tracked product counts as low stock (default 5). The Dashboard and Inventory warn about it |

### Product listing

| Setting | What it does |
|---|---|
| **Listing template** | How your catalog looks in the shop: *Grid* (image cards, a good default), *Compact* (small tiles, best for large catalogs), *List* (one row per product with a short description) or *Showcase* (large image-first cards). A single page can override it in the block settings |
| **Columns on wide screens** | 2 to 5 products side by side. Smaller screens show fewer automatically; the List layout ignores this |

## Integrations

### Email

| Setting | What it does |
|---|---|
| **Send order confirmation email** | Emails the buyer right after they place an order |
| **Send order status update email** | Emails the buyer whenever you change their order's status |
| **From address** | The address order emails come from. Leave blank to use your site's default mail sender |

### MCP

| Setting | What it does |
|---|---|
| **MCP API key** | The secret an MCP client (an AI assistant that works with your store) sends to log in. The field is locked until the **MCP** module is switched on. The MCP server itself comes with VuloCart Pro |

### VuloCloud AI

Connect your site to VuloCloud to use AI features. See [AI](AI.md).

## Advanced

| Setting | What it does |
|---|---|
| **Enable debug logging** | Writes module-loading failures to the server error log. Leave it off unless you are fixing a problem |

## Related

- [MODULES](MODULES.md), [GETTING-STARTED](GETTING-STARTED.md)
