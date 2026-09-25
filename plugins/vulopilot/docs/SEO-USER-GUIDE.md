# VuloPilot SEO - Setup and User Guide

## Brief Introduction

VuloPilot's SEO tools help site owners and webmasters check, configure and improve how their WordPress site appears in search engines. The plugin scans your site for technical and on-page SEO problems, lists what it finds with a site-wide **SEO score**, and gives you the settings to fix them: title and description formats, XML and HTML sitemaps, robots.txt, redirects, canonical tags, social sharing tags, site verification and instant indexing. A **VuloPilot SEO** sidebar in the post editor lets you edit each page's SEO fields while you write.

Key features:

- **SEO scan and score** - titles, meta descriptions, headings, images, internal links, canonicals, duplicate and thin content, Open Graph and Twitter Card tags.
- **SEO Titles** - one place to set the title and description format for the homepage, posts, pages, categories, tags, search results and archives, with a live length check.
- **XML sitemap and HTML sitemap** - choose what is included, exclude posts and terms, add images, and show a visitor-facing sitemap with a shortcode.
- **Instant Indexing (IndexNow)** - tell search engines the moment content is published, edited or deleted, or submit up to 10,000 URLs by hand.
- **Redirect manager and 404 log** - create 301 redirects, auto-redirect when a slug changes, and record visits to missing pages.
- **robots.txt editor** - view your live robots.txt, test it and save changes from the dashboard.
- **Per-page SEO sidebar** in the post editor - SEO title, meta description, focus keyword, social preview, canonical URL, noindex/nofollow, schema and a page analysis.
- **Table of Contents and FAQ blocks** - the FAQ block also outputs FAQPage structured data.
- **Site verification and Google connection** - add verification codes for search engines and connect Search Console, Analytics and Tag Manager.

VuloPilot's standard scans and settings work without connecting an AI service.

## Requirements

- WordPress 6.7 or greater
- PHP 8.1 or greater
- An administrator account (all VuloPilot screens require the `manage_options` capability)
- Optional: a VuloCloud connection for AI-written suggestions, a Google account for Search Console and Analytics, and an IndexNow key (generated for you inside the plugin) for instant indexing

## Installation Guide

### Method I - Install from the WordPress plugin directory

1. In your WordPress admin, go to **Plugins → Add New Plugin**.
2. Search for **VuloPilot**.
3. Click **Install Now**, then **Activate**.

### Method II - Upload the plugin zip

1. Download the VuloPilot zip file.
2. Go to **Plugins → Add New Plugin → Upload Plugin**.
3. Choose the zip file, click **Install Now**, then **Activate Plugin**.

### Method III - Install manually on the server

1. Unzip the plugin on your computer.
2. Upload the `vulopilot` folder to `/wp-content/plugins/` on your server (FTP, SFTP or your host's file manager).
3. Go to **Plugins** in the WordPress admin and click **Activate** under VuloPilot.

After activation, a **VuloPilot** item appears in the admin menu. The SEO tools live in two places:

| Where | What is there |
|---|---|
| **VuloPilot → SEO & Visibility** | The SEO score and findings, robots.txt, redirects, the 404 log and the schema/business views |
| **VuloPilot → Settings → SEO** | SEO Titles, Sitemap, Instant Indexing |
| **VuloPilot → Settings → Scanning → SEO & Content** | Which SEO checks run, the redirect manager switch, robots.txt options |
| **VuloPilot → Settings → Integrations** | Google services, Tag Manager, Webmaster Tools verification |
| **Post editor → VuloPilot SEO sidebar** | Per-page SEO fields and analysis |

## First Run

1. Open **VuloPilot → Dashboard** and click **Run scan** in the header.
2. When the scan finishes, open **VuloPilot → SEO & Visibility → SEO**.
3. Read the **Overall Score**, the number of pages checked and the issue counts (critical, high priority and so on).
4. Work through the six finding groups (see [Understanding the SEO scan](#understanding-the-seo-scan)) and use the settings below to fix what is reported.

## Understanding the SEO scan

The **SEO** tab groups findings into six sections:

| Section | What it checks |
|---|---|
| **Titles & Meta** | Title tags, meta descriptions, duplicate meta descriptions and focus keyword drift |
| **Content Structure** | Heading hierarchy, duplicate or missing H1 headings, thin content |
| **Images** | Missing featured images and content images with no alt text |
| **Internal Linking** | Pages with thin or missing internal links |
| **Indexability & Canonicals** | Canonical URLs, duplicate content, orphan pages with no internal links |
| **Structured Data** | Open Graph and Twitter Card tags |

The score card shows the overall score, the issues remaining and a progress trend. If a section has no findings yet, run a scan. If you turn the SEO module off in **Settings → Modules**, scanning stops, but findings already found are not deleted.

### Choosing which checks run

Go to **Settings → Scanning → SEO & Content**.

**Titles & meta**

- **Flag orphan pages** - pages with no incoming internal links.
- **Thin content threshold (words)** - pages under this word count are flagged. Default: 300.
- **Flag missing meta descriptions**
- **Flag duplicate title tags**

**Images**

- **Flag missing alt text**
- **Flag broken images** - images whose source URL returns an error.
- **Flag missing featured images** - published posts, pages or products with no featured image.

**Links & schema**

- **Flag broken internal links**
- **Add canonical URL tags** - WordPress already outputs canonical tags. Turn this on only if the "Canonical URLs" finding shows them missing.
- **Add Open Graph & Twitter Card tags** - social sharing metadata so platforms can show your title, description and image.

**Readability**

- **Minimum readability score** - posts scoring below this on the Flesch Reading Ease scale (0-100, higher is easier) are flagged. Default: 50.

**Robots.txt**

- **Auto-generate robots.txt** - adds a sitemap reference to robots.txt so search engines can find your sitemap.
- **Flag pages blocked for specific AI crawlers** - finds published pages affected by robots.txt rules for crawlers such as GPTBot and ClaudeBot.

**Redirects**

- **Enable redirect manager**
- **Auto-create redirect on slug change**
- **Log 404s**

Click **Save** after changing any of these.

## SEO Titles Setup

Go to **VuloPilot → Settings → SEO → SEO Titles**. This controls how your page titles and descriptions are built across the site.

1. Turn on **Custom title formats** to use the configured formats across your site.
2. Pick a **Separator** - `|` (pipe), `-` (dash), `•` (bullet), `:` (colon), `>` (greater than) or `~` (tilde). It replaces `%sep%` in every format. Default: `|`.
3. Open **Title & Description Format Templates**. There is one row per page type: **Homepage**, **Blog Post**, **Page**, **Category**, **Tag**, **Search Results** and **Archive**.
4. Click **Edit** on a row and change the **Title format** and the description format. You can click the variable buttons to insert them.
5. Watch the **Title length** indicator: **Empty**, **Too short**, **Good** or **Too long**. A summary line tells you how many formats could use improvement.
6. Save.

Variables you can use:

| Variable | Replaced with |
|---|---|
| `%site_title%` | Your website title |
| `%site_description%` | Your website description |
| `%post_title%` | The post title |
| `%page_title%` | The page title |
| `%category_title%` | The category name |
| `%tag_title%` | The tag name |
| `%search_term%` | What the visitor searched for |
| `%archive_title%` | The archive title |
| `%sep%` | Your chosen separator |

Default formats:

| Page type | Default title format |
|---|---|
| Homepage | `%site_title% %sep% %site_description%` |
| Post | `%post_title% %sep% %site_title%` |
| Page | `%page_title% %sep% %site_title%` |
| Category | `%category_title% %sep% %site_title%` |
| Tag | `%tag_title% %sep% %site_title%` |
| Search results | `Search results for "%search_term%" %sep% %site_title%` |
| Archive | `%archive_title% %sep% %site_title%` |

A title or description set on an individual page in the post editor sidebar overrides these formats for that page.

## Sitemap Setup

Go to **VuloPilot → Settings → SEO → Sitemap**. VuloPilot builds on the WordPress core sitemap.

### XML sitemap (for search engines)

1. Set **XML Sitemap** to **Enabled**. Your sitemap is then available at `yoursite.com/sitemap.xml`, and search engines are notified automatically when content is published or updated.
2. Under **What is included**, tick the **Post types in sitemap** (Posts, Pages, Media, Products and any custom post types) and the **Taxonomies in sitemap** (Categories, Tags, Product Categories, Product Tags).
3. Open **Advanced settings** if you need more control:
   - **Links per sitemap** - the maximum number of links on each sitemap page. Default: 200.
   - **Exclude posts** - post IDs to leave out, separated by commas.
   - **Exclude terms** - term IDs to leave out, separated by commas.
   - **Images in sitemaps** - include references to images used in post content.
   - **Include featured images** - include featured images even if they are not in the content.

Note: a sitemap makes it easier for search engines to find your content, but indexing is not guaranteed.

### HTML sitemap (for visitors)

1. Turn on **Enable HTML sitemap**.
2. Add the shortcode `[vulopilot_html_sitemap]` to any page or post.
3. Choose the **Display format** (List or Grid), **Sort by** (Published Date, Modified Date or Title), whether to **Show dates**, and whether **Item titles** use the post/term titles or the SEO titles.

The HTML sitemap uses the same included post types, taxonomies and exclusions as the XML sitemap.

## Instant Indexing (IndexNow)

Go to **VuloPilot → Settings → SEO → Instant Indexing**. Without IndexNow, search engines find changes on their own schedule, which can take days. IndexNow tells them immediately.

1. If the panel says **IndexNow needs a key**, generate a key. The key file is served from your site and renewed automatically - there is nothing else to manage. The status changes to **IndexNow is connected** and **Active**.
2. Under **What should notify search engines automatically**, choose which content types trigger a notification when they are published, edited or deleted. Default: Posts, Pages and Products (Products only appear when WooCommerce is active).
3. To submit specific pages, use **Submit specific URLs**: paste one URL per line (up to 10,000) and click **Submit URLs**.
4. **Recent submissions** lists your last 100 requests to search engines with the response of each. Use **Response code help** to understand a response.

You can also submit your sitemap to IndexNow from the **Crawl & URLs** view of SEO & Visibility. If it fails, check the IndexNow key under Settings → Instant Indexing.

## Redirects and the 404 Log

Turn the features on first: **Settings → Scanning → SEO & Content → Redirects** - enable **Enable redirect manager**, **Auto-create redirect on slug change** and **Log 404s** as needed.

Then open **VuloPilot → SEO & Visibility → Crawl & URLs**.

### Redirects

- **Redirect Health** shows how many of your redirects are active and working.
- The **Redirects** table lists every rule with its **From**, **To**, **Type**, **Hits**, **Created**, **Last accessed** and **Status**.
- Click **Add redirect**, enter the **Old page url** as a path (for example `/old-page/`) and the **New page url** (for example `https://example.com/new-page/`), and save. Existing rules can be edited, deactivated, activated or deleted.
- With **Auto-create redirect on slug change** on, changing the slug of a published post or page automatically redirects the old URL to the new one.

### 404 Log

- Every 404 the site has seen is listed with the **Requested URL** and when it was last seen. Use the **All / Content / System** filter to separate missing content pages from missing theme, plugin or asset files, and search to find a URL.
- Click **Create redirect** on a row to redirect it. If a URL does not need a redirect, click **Dismiss**.

## robots.txt

Open **VuloPilot → SEO & Visibility → Crawl & URLs → Robots & Sitemap**.

- **Robots.txt Analysis** shows your live robots.txt, fetched just now, with the total, allowed and disallowed rules, sitemaps and any crawl delay.
- Edit the file in the editor and save - it takes effect from the next request to `/robots.txt`. Use **Test robots.txt** to check it, and **Reset to WordPress default** to go back to the default. Other active plugins may also add their own rules to robots.txt.
- **Robots.txt Issues** reports whether robots.txt is reachable and not accidentally blocking every crawler, and lists AI crawlers that are blocked on your published pages.
- **llms.txt** can be generated and edited in the same section when it is turned on in the AI Visibility settings.

## Per-Page SEO in the Post Editor

Edit any post or page and open the **VuloPilot SEO** sidebar. It has five tabs.

| Tab | What you can do |
|---|---|
| **General** | See a live search result **Preview**. Click **Edit Snippet** to set the **SEO Title** and **Meta Description**, and add a **Focus Keyword** - the main term you want the page to rank for. A **Title Readability** check and a checklist (**All Good**, **Could Be Better**, **Needs Improvement**) update as you type. |
| **Social** | Set a **Social Title**, **Social Description** and **Social Image**. Empty fields fall back to the SEO title, the meta description and the featured image. |
| **Schema** | View or edit the page's structured data (JSON-LD). Invalid JSON is cleared when you save. |
| **Advanced** | Set a **Canonical URL** (empty uses the page's own permalink), and tick **No Index** to keep the page out of search results or **No Follow** to tell search engines not to follow its links. |
| **Page Analysis** | See this page's live SEO, GEO and AEO issues from the last check. |

## Table of Contents and FAQ Blocks

Both blocks are in the block inserter under **Widgets**.

- **Table of Contents** - lists the post's headings with links to each one and always reflects the current heading structure. Settings: a **title** (default "Table of Contents"), the minimum and maximum heading level (default H2 to H6) and a **collapsible** option.
- **FAQ** - a list of questions and answers that also outputs FAQPage structured data for search engines.

## Site Verification and Google Services

Go to **VuloPilot → Settings → Integrations**.

- **Webmaster Tools** - paste the verification code from **Google**, **Bing**, **Pinterest**, **Baidu**, **Yandex** or **Norton Safe Web**. VuloPilot adds each as a `<meta>` tag on every page. A **Custom webmaster tags** box accepts your own `<meta>` tags only; anything else is removed. After saving, use **Verify** to confirm.
- **Google Services** - **Connect Google Services** to use Search Console, Analytics (GA4) and AdSense inside VuloPilot. VuloPilot only reads your data and stores it on your own site. After connecting, choose a verified Search Console property, and for Analytics choose an account, property and data stream. You can also switch on **Install analytics code**, **Anonymize IP addresses** and **Exclude logged-in users**. **Test Connection** and **Disconnect Google Account** are under **More actions**.
- **Tag Manager** - enter your **Container ID** (format `GTM-XXXXXXX`) to add Google Tag Manager to your site.

Enabling Google Analytics or Tag Manager loads Google scripts on your front end. You are responsible for consent notices for your visitors.

## Frequently Asked Questions

**Where is my sitemap?**
At `yoursite.com/sitemap.xml` once **XML Sitemap** is enabled in Settings → SEO → Sitemap.

**My scan shows no SEO findings.**
Run a scan from the Dashboard. If the SEO module was turned off in **Settings → Modules**, turn it back on to resume scanning.

**Why is a page still showing an old title?**
A title set in the post editor sidebar overrides the SEO Titles format. Clear that page's SEO Title to use the format.

**A 404 I fixed still appears in the log.**
Click **Dismiss** on the row, or create a redirect for it.

**IndexNow says "Key not found or doesn't match".**
Generate the key again in Settings → SEO → Instant Indexing, and make sure the key file on your site is reachable.

**Will these settings guarantee higher rankings?**
No. VuloPilot finds and helps you fix the technical and content issues search engines look at, but it cannot guarantee a specific ranking or that a page is indexed.

## External Services Used by SEO Features

Only the features you turn on contact outside services: IndexNow (`api.indexnow.org`), Bing sitemap ping, Google APIs for Search Console and Analytics, and Google Tag Manager. The plugin readme's **External services** section lists what data each one receives and links to their terms and privacy policies.
