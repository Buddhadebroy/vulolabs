# Commerce (Your Online Store)

## What it does

If you run a WooCommerce store, the Commerce page collects problems that could cost you sales: product information that is missing, checkout problems and store settings that need attention. It only appears in the menu when WooCommerce is active.

## Why it matters

Shoppers leave if a product page looks incomplete or checkout feels broken. Finding these issues yourself means clicking through every product. Commerce lists them for you.

New to VuloPilot? See [GETTING-STARTED](GETTING-STARTED.md).

## How to use it

1. Open **VuloPilot → Commerce**.
2. Click **Run scan**. Until you do, the page says "No WooCommerce findings yet."
3. Read the **All WooCommerce Issues** table. **Important** shows the most serious ones first.
4. Open an issue, fix it in WooCommerce and scan again.

| Group | What it covers |
|---|---|
| **Products** | Problems with product information |
| **Checkout** | Problems that could stop someone buying |
| **Store** | Store-wide settings |

## AI Sales Assistant

This card sums up your store's open problems in plain language and can suggest improvements using your AI connection ([AI-COPILOT](AI-COPILOT.md#before-you-start-connect-to-vulocloud)). Choose **Review Suggestions First** to look at what it proposes before anything changes.

## Product labels for search engines

To show price and stock in search results, products need hidden labels called **schema**. Check them at **SEO & Visibility → Business Identity & Schema → Product Details**, which lists your products and whether their schema is fine. More in [AI-VISIBILITY](AI-VISIBILITY.md#business-identity--schema-what-machines-learn-about-you).

## Setting

Go to **Settings → Scanning → WooCommerce**.

| Setting | What it does | Why turn it on |
|---|---|---|
| **Flag products missing schema** | Reports products that lack the hidden labels search engines use | Products with schema can show price and availability in search results |

## Related

- [SEO](SEO.md) - product pages in your sitemap and instant indexing
- [SETTINGS](SETTINGS.md#scanning)
