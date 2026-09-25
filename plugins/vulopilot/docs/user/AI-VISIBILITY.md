# AI Visibility, Brand and Schema

This guide covers the parts of **SEO & Visibility** that help AI assistants (ChatGPT, Claude, Gemini, Perplexity and others) find, understand and cite your site: GEO, AEO, Brand Visibility, crawler traffic, llms.txt, and your Business Identity and Schema.

> Classic SEO (titles, sitemaps, redirects) is in [SEO](SEO.md). Install and the first scan are in [GETTING-STARTED](GETTING-STARTED.md).

**In this guide**

1. [The terms](#1-the-terms)
2. [Set up your business first](#2-set-up-your-business-first)
3. [Run a visibility scan](#3-run-a-visibility-scan)
4. [The Overview tab](#4-the-overview-tab)
5. [GEO: improve AI visibility](#5-geo-improve-ai-visibility)
6. [AEO: get cited as an answer](#6-aeo-get-cited-as-an-answer)
7. [Brand Visibility](#7-brand-visibility)
8. [Crawl & URLs: AI crawler traffic and llms.txt](#8-crawl--urls-ai-crawler-traffic-and-llmstxt)
9. [Business Identity & Schema](#9-business-identity--schema)
10. [Keywords](#10-keywords)
11. [Settings for these scans](#11-settings-for-these-scans)

## 1. The terms

| Term | Plain meaning |
|---|---|
| **GEO** (Generative Engine Optimization) | Making your content easy for AI systems to read and reuse |
| **AEO** (Answer Engine Optimization) | Making pages answer questions directly so they can be quoted |
| **Brand Visibility** | Trust and authority signals that make AI treat your site as a reliable source |
| **Entity** | A named thing on your site - business, person, product, service, location |
| **Schema / JSON-LD** | Machine-readable data that describes your pages to search engines |
| **llms.txt** | A plain Markdown index of your key pages for AI systems |

## 2. Set up your business first

1. Go to **Settings → Business Information**.
2. Fill in **Business type**, **Site tone**, **Service pages**, **Business locations** and **Competitors**.
3. Save.

This lets VuloPilot build a more complete profile and shape AI requests to sound like your site. See [SETTINGS](SETTINGS.md#business-information).

## 3. Run a visibility scan

1. Open **VuloPilot → SEO & Visibility**.
2. Click **Run Visibility Scan** in the header.
3. Open the tabs below to see results.

The page tabs are **Overview, Brand Visibility, SEO, GEO, AEO, Keywords, Crawl & URLs** and **Business Identity & Schema**.

## 4. The Overview tab

Four scores in one place: **Brand Visibility Score**, **SEO Health Score**, **GEO Visibility Score** and **Crawl & URLs Score**, each rated **Good**, **Needs Work** or **At Risk**. A short message sums up your visibility ("...in good shape across the board", "...could use some improvement", "...needs attention in several areas"). If you connect Google Analytics, **Visibility by Source** shows real sessions by channel.

## 5. GEO: improve AI visibility

The **GEO** tab shows a GEO score and groups findings by topic:

| Topic | Question it answers |
|---|---|
| **AI Summary** | Do pages have a short, up-front summary an AI can quote? |
| **Question Coverage** | Are common questions answered, with a FAQ or Q&A block? |
| **Evidence & Citations** | Are statistics backed by a citation or link? |
| **AI-Readable Structure** | Are paragraphs short and headings well ordered? |
| **Entity Clarity** | Are your brand, people and products named consistently? |
| **Content Freshness** | Have pages been updated recently? |

Use **A Closer Look, By Topic** to see open issues and affected pages for each topic, then **View issues**. A **Fix these first** card orders the work for you.

## 6. AEO: get cited as an answer

The **AEO** tab has three groups: **Questions & Answers**, **Direct Answers** and **Schema Markup**. It also shows:

- **Citation coverage** - how many tested questions your configured AI service already recognizes your site for.
- **Engine Testing** - pick a page you have just fixed and click **Test this page** to run a live single-page citation check without waiting for the next full scan. This uses your AI service.

Tip: add a **FAQ block** to pages that answer common questions (see [SEO](SEO.md#table-of-contents-and-faq-blocks)).

## 7. Brand Visibility

The **Brand Visibility** tab shows a **Brand Score** made of two parts:

| Score | Meaning |
|---|---|
| **Trust Score** | How trustworthy your site looks to people and AI engines |
| **Authority Score** | How strong your reputation and credibility are |

Findings are grouped under **Trust Signals** (a real About and Contact page), **Authority Signals** (author bios, content updates, Person schema) and **Entity Consistency**.

The About page check flags a page that is too thin to be a real trust signal. Set the minimum word count under **Settings → Scanning → SEO & Content → About Page** (default 80).

## 8. Crawl & URLs: AI crawler traffic and llms.txt

Open **Crawl & URLs**. Beyond redirects and the 404 log (see [SEO](SEO.md)), this tab shows:

- **Crawler Traffic** - real visits from AI crawlers over time: GPTBot, ChatGPT-User, ClaudeBot, anthropic-ai, PerplexityBot, Bytespider, CCBot, Google-CloudVertexBot, Amazonbot and others. **Recent Crawl Requests** lists each visit, searchable by requested URL. Only the bot name, user agent and URL are stored - no visitor IP addresses.
- **Overall Crawl Health** - whether robots.txt is reachable, whether an XML sitemap exists and whether important AI bots are blocked.
- **llms.txt** - an editable Markdown index served at `/llms.txt`.

To turn on crawler tracking and llms.txt see step 11. Crawler alerts are set up under [SETTINGS](SETTINGS.md#notifications).

## 9. Business Identity & Schema

This tab shows what search engines and AI learn about your business.

| Section | What it shows |
|---|---|
| **Business Profile** | Business name, type, services, locations, people, products and categories found on your site, each with a confidence level. Click **Edit Business Information** to correct anything |
| **Knowledge Graph** | A diagram of entities extracted from your content and how they connect, with **Add category / Add product** shortcuts |
| **Schema Coverage** | Which pages have valid structured data (JSON-LD) and which have problems |
| **Inspect a specific page** | Choose a page and see exactly what structured data it sends. Filters: **All**, **With schema**, **Need attention** |
| **Issues** | Schema and structured-data findings |
| **Product Details** | Products and their schema status (needs WooCommerce) |

If nothing shows, run a scan first.

## 10. Keywords

The **Keywords** tab shows real ranking keywords once you connect Google Search Console. Until then it says "Connect Google Search Console to see your real keyword rankings." Use **Connect Google Services** ([SETTINGS](SETTINGS.md#integrations)).

## 11. Settings for these scans

Go to **Settings → Scanning → AI Visibility**.

| Setting | What it does |
|---|---|
| **Entity clarity** | Checks how clearly brand, people and products are defined. **Minimum entity mentions** flags pages that mention their main entity too little |
| **Content freshness** | Flags pages not updated within **Flag content older than (months)** |
| **Answer-first content** | Flags a page if its core answer does not appear within **Answer-first threshold (words)** |
| **Evidence checks** | Checks for citations and facts; **Minimum data points per 500 words** |
| **Generate llms.txt** | Creates the Markdown index at `/llms.txt` |
| **Auto-regenerate on publish** | Rebuilds llms.txt whenever content is published or updated |

## Related guides

- [SEO](SEO.md) - robots.txt, sitemap, redirects
- [SETTINGS](SETTINGS.md)
