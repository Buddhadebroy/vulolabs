# Commerce (WooCommerce)

The Commerce page collects store-related findings for WooCommerce sites. It is only shown in the menu when WooCommerce is active.

> Install and the first scan are in [GETTING-STARTED](GETTING-STARTED.md).

**In this guide**

1. [Open the Commerce page](#1-open-the-commerce-page)
2. [Run a scan](#2-run-a-scan)
3. [Read the findings](#3-read-the-findings)
4. [Product structured data](#4-product-structured-data)
5. [Turn checks on or off](#5-turn-checks-on-or-off)

## 1. Open the Commerce page

Go to **VuloPilot → Commerce**. If you do not see it, WooCommerce is not active on your site. The page describes itself as AI-powered WooCommerce intelligence to help you increase sales and grow revenue.

## 2. Run a scan

Click **Run scan** in the header. When the scan finishes, findings appear in the issues table. Until then you will see "No WooCommerce findings yet - run a scan to check store settings, product data, and checkout health."

## 3. Read the findings

The **All WooCommerce Issues** table groups findings as:

| Group | What it covers |
|---|---|
| **Products** | Product data problems |
| **Checkout** | Checkout health |
| **Store** | Store settings |

**Important** lists the most serious ones first. Open a finding to read its recommendation, fix it in WooCommerce, then re-scan.

The **AI Sales Assistant** card summarizes your open store findings. It uses your AI service ([AI-COPILOT](AI-COPILOT.md#1-before-you-start)); use **Review Suggestions First** to check its proposals before anything changes.

## 4. Product structured data

Product schema (the data that lets search engines show price and availability) is checked under **SEO & Visibility → Business Identity & Schema → Product Details**, which lists detected products and their schema status. See [AI-VISIBILITY](AI-VISIBILITY.md#9-business-identity--schema).

## 5. Turn checks on or off

Go to **Settings → Scanning → WooCommerce**:

| Setting | What it does |
|---|---|
| **Flag products missing schema** | Flags products without valid Product structured data |

## Related guides

- [SEO](SEO.md) - product pages in sitemaps and IndexNow
- [SETTINGS](SETTINGS.md#scanning)
