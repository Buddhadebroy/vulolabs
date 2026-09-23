# VuloPilot (Free) - User Guide

This is a store-owner/site-admin guide to what VuloPilot's free tier actually does today. It's distinct from `readme.txt` (marketing copy) and from `.claude/`-style developer documentation (hooks/filters reference for third-party extenders) - this describes the real, current behavior of the plugin, verified against the code and a live install (`vulopilot` + WooCommerce active, `vulopilot-pro` inactive).

The admin menu was substantially restructured recently. If you used VuloPilot before and are looking for "Health," "GEO," "WooCommerce," "Activity," or a standalone "AI Assistant"/"Automation"/"Modules" page by that exact name, they're gone as separate pages - their content moved into the pages below (see each section for where).

## What VuloPilot does

VuloPilot scans your WordPress site for issues across several categories, lists what it finds as **findings**, and - for some finding types - can draft an AI-written fix you review and approve before anything changes. It never edits your site automatically; every AI action follows a propose → review → approve/reject flow, and approved actions can be rolled back afterward.

## The admin menu (current, real)

In order: **Dashboard, AI Copilot, SEO & Visibility, Content, Performance, Site Health, Accessibility, Security, Commerce** (only shown if WooCommerce is active), **Automations, Reports, Settings**. This is the complete, final top-level list (`classes/Admin.php`'s `add_menus()`) - there is no longer a separate "Health," "GEO," "WooCommerce," "Activity," "AI Assistant," or "Modules" entry; each was folded into one of the pages below (see that method's own comment: "every tab/page that used to be reachable-but-unlinked ... has been removed outright").

## Dashboard

The landing screen. Shows, top to bottom:
- A "Getting started" card (setup checklist for a new install).
- **Vital Pulse**: your real sitewide health score (0-100), critical-issue count, and last-scan time, plus a category score breakdown (SEO/Performance/Security/Accessibility/GEO/Content/Brand/WooCommerce) and a "Health timeline" trend card right beneath it.
- **Site snapshot**: real WordPress core counts (posts, pages, comments, users, active plugins), with an automation-status card alongside it.
- **Needs your attention**: real open issues, quick fixes, and pending AI-action approvals.
- **AI crawler traffic**: a quick look at real AI-bot visits to your site, with a link to the full report.
- **Recent activity**: a real feed of meaningful site events (scans, fixes, changes).

A **Run scan** button in the header re-runs every scanner and refreshes the dashboard. You can drag/reorder/hide widgets ("Customize" pencil icon in the header) and reset to the default layout.

**Known limitation**: the Health timeline *trend chart* only shows real data once VuloPilot Pro's Advanced Reports module is active - the free plugin doesn't record historical daily score snapshots itself. On a Free-only install it correctly shows "No trend data yet" and a locked "Unlock with Pro" card, not an error or fake data.

## AI Copilot

A single-view chat page - ask it questions about your site or issues, with attachments support. This is a real chat interface backed by whichever AI provider you've configured (see Settings below), not just an activity log. A "History" tab that used to live here moved to **Reports → History** (a day-grouped scan/change/conversation timeline).

## SEO & Visibility

A tabbed page covering what used to be several separate menu items: **Overview, Brand Visibility, SEO, GEO, AEO, Keywords, Crawl & URLs, Business Identity & Schema**.

- **SEO** tab: title length, meta descriptions, heading structure, internal linking, canonical URLs, XML sitemap, robots.txt, Open Graph tags, Twitter Cards, orphaned pages, image SEO, structured data, duplicate/thin content.
- **GEO** tab: Generative Engine Optimization - how discoverable/citable your content is to AI answer engines (ChatGPT, Perplexity, etc.). Includes a real, free, deterministic sitewide **GEO Score** card (entity coverage, freshness, answer-first structure, evidence signals) with a real score-trend chart and a breakdown table, computed automatically across your published pages - no per-post ID entry needed any more, and it's fully free (it replaced an older card whose number only populated with Pro active).
- **AEO** tab: Answer Engine Optimization checks, folded in here from a former standalone page.
- **Crawl & URLs** tab: broken links, redirects, AI crawler traffic - folded in from three former standalone tabs.
- **Business Identity & Schema** tab: structured data / knowledge graph, merged from two former separate tabs ("Schema" and "Knowledge Graph").
- **Brand Visibility** and **Keywords** tabs: Keywords is honestly still "not connected yet" rather than fabricated rank data - see that tab for its own current state.

## Content

A single-view page (no tabs) with:
- An **AI Content Assistant** sidebar and a **Content Tools** grid of 12 real AI-action tiles - each one actually runs a real AI action end-to-end (pick an input, generate a real preview, approve/reject it), not a placeholder. **3 are free**: AI Writer, Blog Generator, Duplicate Content. **9 require Pro**: Landing Pages, Product Descriptions, FAQ Generator, Schema Generator, Image Alt Text, Meta Generator, Content Optimizer, Content Refresh, Media Library AI.
- A content stats card and quick-actions card.
- A **Recent Content** table listing your posts/pages with their own real open content-quality findings inline, and real Fix with AI / Resolve / Ignore / Review row actions.

A "Run Content Audit" button in the header runs the `content` scan category.

## Performance

Two tabs: **Overview** and **Slow Pages** (a real per-page speed report). Overview includes the performance-category findings table directly (page-load checks, large images, etc.). Redirects/404s live under SEO & Visibility now, not here.

## Site Health

Two tabs: **Site Health** and **Backups**. Always-on checks include plugin/theme/core update availability, SSL certificate validity/expiry, redirect chain length, published pages that 404 on their own URL, and (if `WP_DEBUG_LOG` is enabled) recent PHP warnings/errors from your own debug.log. Backups shows your backup status; cloud storage destinations (S3, Google Drive, etc.) are Pro-only.

## Accessibility

Checks: duplicate `<h1>` tags, form fields missing labels, interactive elements missing ARIA roles, missing image alt text.

## Security

A single findings view (no tab bar). Checks admin-username detection, REST API user-enumeration exposure, and other security findings. Unlike the old doc's claim that security scanning was entirely Pro, this is now a real, standalone free page - "Security" was split out of a former combined "Protect My Site" shell (which also held Site Health and Backups, now their own page above).

## Commerce

Only visible if WooCommerce is active. **This entire tab's real content is now Pro-only.** The free plugin has zero WooCommerce product/store scanning logic of its own any more - all of it (18 product/store scanners, 9 rules) moved to VuloPilot Pro's WooCommerce Intelligence module. On a Free-only install (as tested live), this page shows a locked/blurred preview of the real Commerce dashboard plus an "Upgrade to Pro" popup - not real data, and not hidden entirely (the menu item itself stays visible whenever WooCommerce is active, regardless of Pro status). The one narrow exception: **Settings → Scanning → WooCommerce** still has one real, free toggle, "Flag products missing schema" (see Settings below) - everything else WooCommerce-related is Pro.

## Automations

Free gets exactly **2 fixed, schedule-only automations**: "Run Full Site Scan" and "Send Visibility Report" - no template picker, no wizard, always shown at the top of the page. You can turn each one on/off and set its schedule (daily/weekly/monthly/manual). These two genuinely run on their own schedule via WP-Cron (`Automations\AutomationScheduler`) - this is a real change from before: the underlying execution path for these two specific built-in automations now works, it's not just listing.

The page header always shows "Build with AI," "Create Automation," and "Browse Templates" buttons, even in Free - clicking any of them opens an upgrade popup, because the real trigger→action automation builder, the "Your automations" list of anything beyond the 2 built-ins, and the "Recent automation activity" feed are all Pro-only (rendered via a filter slot Pro fills in; Free shows a blurred dummy preview when Pro isn't active).

**Known limitation, still true**: manually forcing a run outside its own schedule ("Run now") is explicitly not supported yet - the REST endpoint returns "Manually running an automation isn't supported yet - automations currently only fire from their own configured trigger," rather than silently failing. A general trigger→action automation engine (arbitrary triggers wired to arbitrary actions) is Pro-only; Free's automation capability is limited to these 2 fixed, cron-scheduled jobs plus the separate "Fix with AI" manual-action flow.

## Reports

Two tabs: **Overview** and **History**.

- **Overview**: generate a one-off report and download it. Real report types available today: overall scan summary, SEO, GEO/AI visibility, brand intelligence, content intelligence, performance, security, accessibility, updates, automations, AI usage, and WooCommerce. Export formats are **CSV and JSON** - there is no PDF exporter in this codebase today (only `CsvExporter.php`/`JsonExporter.php` exist under `classes/Reports/Exporters/`). Also on this tab: a real "Report History" table of past generated reports, and a "Scheduled Reports" table that's Pro-gated - Free shows fabricated preview rows behind a blurred "Upgrade to Pro" overlay, not real schedules.
- **History**: a real, day-grouped timeline of scans, content changes, and AI Copilot conversations (moved here from the AI Copilot page).

**Not in free**: scheduled/recurring report delivery and a custom report builder combining multiple types - both Pro (Advanced Reports module).

## Settings

Real current tab order: **Business Information, SEO, Scanning, Automation, Reports, Notifications, Integrations, Backups, Developer Tools, Modules.** There is no "General," "Account," or "Advanced" tab any more - every field those used to hold moved to one of the tabs above (e.g. scan-frequency preferences now live directly under their relevant tab).

- **Business Information**: your site's name/description/contact info used to inform AI-generated content and schema.
- **SEO**: sub-tabs for SEO Titles, Sitemap, and Instant Indexing (IndexNow).
- **Scanning**: sub-tabs to toggle scan categories - SEO/Content, AI Visibility (GEO), Accessibility, Security, and WooCommerce. The WooCommerce sub-tab now has exactly one real free toggle ("Flag products missing schema") - it is not the old full WooCommerce-scanning toggle set (that logic moved to Pro entirely, see Commerce above).
- **Automation**: settings for the 2 built-in automations' behavior (cooldown/scheduling defaults).
- **Reports**: report-related preferences.
- **Notifications**: where critical-finding alerts email to, from-name/from-address, and per-category "Notify me about" checklists (Website Alerts, Visibility Alerts for GEO/brand/knowledge-graph score drops).
- **Integrations**: connect Google services, site verification, tag manager, and your VuloCloud AI connection.
- **Backups**: backup configuration; cloud storage destinations are Pro-gated here too.
- **Developer Tools**: debug logging and developer-facing options.
- **Modules**: enable/disable VuloPilot's 6 optional feature modules - **GEO Analysis, Technical SEO, Content Optimization, Knowledge Graph, Brand Visibility, AI Copilot**. All 6 are active by default on a fresh install.
- **AI Providers** live under Integrations/VuloCloud connection - configure your OpenAI/Anthropic/Gemini/OpenRouter/Ollama/Groq API key (bring your own key; no VuloPilot-hosted AI in the free tier), or connect via VuloCloud.

## AI actions catalog (free tier)

VuloPilot's free tier ships 24 distinct AI action classes (`modules/AiCopilot/Actions/`), a much larger catalog than before. Every action follows the same propose → review → approve/reject → (optional) rollback flow. They include (non-exhaustive): generate image alt text, improve readability, generate structured data (JSON-LD), generate a blog post draft, write a meta title/description, generate an FAQ section, generate a content summary block, suggest internal links (only to real, existing pages), generate social content, generate a landing/comparison page, generate a product description, generate an author bio, create a trust page, fix heading hierarchy, add subheadings, split long paragraphs, normalize entity naming, soften unsourced claims, differentiate duplicate titles, and audit content.

**How to trigger these today**: unlike before, most of these now DO have a real in-UI trigger - the **Content** page's 12-tile Content Tools grid runs a real action end-to-end for each tile (3 free, 9 Pro - see Content above), and individual findings across the app get real "Fix with AI" row actions. Any action without a dedicated UI tile is still reachable via the REST API directly.

## What's Pro-only (for context)

The real trigger→action Automation Builder (wizard, AI-generated automations, template library, "Your automations" list, activity feed), the entire Commerce/WooCommerce scanning and AI-sales feature set (18 scanners, 9 rules, AI sales assistant/optimizer), Security Monitoring depth beyond the free checks, scheduled/recurring Reports and the custom report builder, historical health-score trend charts (Advanced Reports), the health-score trend widget's real data, cloud backup storage, and most of the Content Tools grid's 12 tiles (9 of 12). Everything else described above is free, unrestricted, with no time limit.

## Known issues / limitations (current, honest state)

- Automations' manual "Run now" still isn't supported - only the 2 built-ins' own configured schedule actually fires them (this now genuinely works, unlike before).
- A general, arbitrary trigger→action automation engine doesn't exist in Free - only 2 fixed, schedule-only automations.
- Commerce is Pro-only in its entirety now, including the menu tab's real content; the menu item itself still shows (gated only on WooCommerce being active, not on Pro), so it's discoverable but shows a locked preview without Pro.
- Reports export as CSV/JSON only - no PDF.
- Scheduled reports and the health-score historical trend chart are Pro-only and show fabricated/locked preview content in Free, not real data - by design, not a bug.
- Keywords (SEO & Visibility → Keywords) is honestly "not connected yet" - it doesn't fabricate rank data.
- Of the Content page's 12 AI action tiles, 9 require Pro; only AI Writer, Blog Generator, and Duplicate Content are free.

## Manual testing checklist (for a human, in a browser)

This guide's functional review combined static code reading with a live install (`wp plugin list` confirms `vulopilot` + `woocommerce` active, `vulopilot-pro` inactive) but did not click through every screen. Before relying on this as "fully verified," a human should check, in an actual browser:

- [ ] Each top-level page (Dashboard, AI Copilot, SEO & Visibility, Content, Performance, Site Health, Accessibility, Security, Commerce, Automations, Reports, Settings) loads with exactly one page header, no duplicates.
- [ ] Findings tables across SEO & Visibility / Content / Performance / Site Health / Accessibility / Security / Commerce (they share a common table component) support search, filtering, pagination, and bulk Resolve/Ignore actions as expected.
- [ ] Running a scan from the Dashboard or a page's own "Run scan" button actually populates new findings and updates the dashboard's score/widgets afterward.
- [ ] The Content page's 3 free AI Content Tools tiles (AI Writer, Blog Generator, Duplicate Content) produce a real AI result when a provider is connected, and a clear "connect an AI provider" prompt when none is configured; the 9 Pro tiles correctly show the upgrade popup on a Free-only install.
- [ ] SEO & Visibility → GEO's GEO Score card loads a real number and trend chart on page load, with no post-ID entry required.
- [ ] Commerce, with WooCommerce active and Pro inactive, shows the locked/blurred preview and upgrade popup rather than any real store data.
- [ ] Automations' 2 built-in cards can be enabled/disabled and their schedule changed, and the header's "Build with AI"/"Create Automation"/"Browse Templates" buttons open the upgrade popup rather than doing nothing.
- [ ] Reports → Overview generates a real CSV/JSON report file; the Scheduled Reports table shows the blurred dummy rows, not a real schedule form.
- [ ] Settings → Modules shows all 6 modules (GEO Analysis, Technical SEO, Content Optimization, Knowledge Graph, Brand Visibility, AI Copilot) active by default, and toggling one off actually disables its dependent UI elsewhere.
- [ ] The browser console shows no JavaScript errors on any of the above screens.
