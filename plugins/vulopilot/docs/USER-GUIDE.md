# VuloPilot (Free) - User Guide

The admin menu was substantially restructured recently. If you used VuloPilot before and are looking for "Health," "GEO," "Commerce," "Activity," or a standalone "AI Assistant"/"Automation"/"Modules" page by that exact name, they're gone as separate pages - their content moved into the pages below (see each section for where).

## What VuloPilot does

VuloPilot scans your WordPress site for issues across several categories, lists what it finds as **findings**, and - for some finding types - can draft an AI-written fix you review and approve before anything changes. It never edits your site automatically; every AI action follows a propose → review → approve/reject flow, and approved actions can be rolled back afterward.

## The admin menu (current, real)

In order: **Dashboard, AI Copilot, SEO & Visibility, Content, Performance, Site Health, Accessibility, Security, Commerce** (only shown if the store platform is active), **Automations, Reports, Settings**. This is the complete, final top-level list (`classes/Admin.php`'s `add_menus()`) - there is no longer a separate "Health," "GEO," "Commerce," "Activity," "AI Assistant," or "Modules" entry; each was folded into one of the pages below (see that method's own comment: "every tab/page that used to be reachable-but-unlinked ... has been removed outright").

## Dashboard

The landing screen. Shows, top to bottom:
- A "Getting started" card (setup checklist for a new install).
- **Vital Pulse**: your real sitewide health score (0-100), critical-issue count, and last-scan time, plus a category score breakdown (SEO/Performance/Security/Accessibility/GEO/Content/Brand/Commerce) and a "Health timeline" trend card right beneath it.
- **Site snapshot**: real WordPress core counts (posts, pages, comments, users, active plugins), with an automation-status card alongside it.
- **Needs your attention**: real open issues, quick fixes, and pending AI-action approvals.
- **AI crawler traffic**: a quick look at real AI-bot visits to your site, with a link to the full report.
- **Recent activity**: a real feed of meaningful site events (scans, fixes, changes).

A **Run scan** button in the header re-runs every scanner and refreshes the dashboard. You can drag/reorder/hide widgets ("Customize" pencil icon in the header) and reset to the default layout.

## AI Copilot

A single-view chat page - ask it questions about your site or issues, with attachments support. This is a real chat interface backed by whichever AI provider you've configured (see Settings below), not just an activity log. A "History" tab that used to live here moved to **Reports → History** (a day-grouped scan/change/conversation timeline).

## SEO & Visibility

A tabbed page covering what used to be several separate menu items: **Overview, Brand Visibility, SEO, GEO, AEO, Keywords, Crawl & URLs, Business Identity & Schema**.

- **SEO** tab: title length, meta descriptions, heading structure, internal linking, canonical URLs, XML sitemap, robots.txt, Open Graph tags, Twitter Cards, orphaned pages, image SEO, structured data, duplicate/thin content.
- **AEO** tab: Answer Engine Optimization checks, folded in here from a former standalone page.
- **Crawl & URLs** tab: broken links, redirects, AI crawler traffic - folded in from three former standalone tabs.
- **Business Identity & Schema** tab: structured data / knowledge graph, merged from two former separate tabs ("Schema" and "Knowledge Graph").
- **Brand Visibility** and **Keywords** tabs: Keywords is honestly still "not connected yet" rather than fabricated rank data - see that tab for its own current state.

## Content

A "Run Content Audit" button in the header runs the `content` scan category.

## Performance

Two tabs: **Overview** and **Slow Pages** (a real per-page speed report). Overview includes the performance-category findings table directly (page-load checks, large images, etc.). Redirects/404s live under SEO & Visibility now, not here.

## Accessibility

Checks: duplicate `<h1>` tags, form fields missing labels, interactive elements missing ARIA roles, missing image alt text.

## Automations

Free gets exactly **2 fixed, schedule-only automations**: "Run Full Site Scan" and "Send Visibility Report" - no template picker, no wizard, always shown at the top of the page. You can turn each one on/off and set its schedule (daily/weekly/monthly/manual). These two genuinely run on their own schedule via WP-Cron (`Automations\AutomationScheduler`) - this is a real change from before: the underlying execution path for these two specific built-in automations now works, it's not just listing.

## Reports

Two tabs: **Overview** and **History**.

- **History**: a real, day-grouped timeline of scans, content changes, and AI Copilot conversations (moved here from the AI Copilot page).

## Settings

Real current tab order: **Business Information, SEO, Scanning, Automation, Reports, Notifications, Integrations, Backups, Developer Tools, Modules.** There is no "General," "Account," or "Advanced" tab any more - every field those used to hold moved to one of the tabs above (e.g. scan-frequency preferences now live directly under their relevant tab).

- **Business Information**: your site's name/description/contact info used to inform AI-generated content and schema.
- **SEO**: sub-tabs for SEO Titles, Sitemap, and Instant Indexing (IndexNow).
- **Automation**: settings for the 2 built-in automations' behavior (cooldown/scheduling defaults).
- **Reports**: report-related preferences.
- **Notifications**: where critical-finding alerts email to, from-name/from-address, and per-category "Notify me about" checklists (Website Alerts, Visibility Alerts for GEO/brand/knowledge-graph score drops).
- **Integrations**: connect Google services, site verification, tag manager, and your VuloCloud AI connection.
- **Developer Tools**: debug logging and developer-facing options.
- **Modules**: enable/disable VuloPilot's 6 optional feature modules - **GEO Analysis, Technical SEO, Content Optimization, Knowledge Graph, Brand Visibility, AI Copilot**. All 6 are active by default on a fresh install.
- **AI Providers** live under Integrations/VuloCloud connection - configure your OpenAI/Anthropic/Gemini/OpenRouter/Ollama/Groq API key (bring your own key; no VuloPilot-hosted AI in the free tier), or connect via VuloCloud.

## AI actions catalog (free tier)

VuloPilot's free tier ships 24 distinct AI action classes (`modules/AiCopilot/Actions/`), a much larger catalog than before. Every action follows the same propose → review → approve/reject → (optional) rollback flow. They include (non-exhaustive): generate image alt text, improve readability, generate structured data (JSON-LD), generate a blog post draft, write a meta title/description, generate an FAQ section, generate a content summary block, suggest internal links (only to real, existing pages), generate social content, generate a landing/comparison page, generate a product description, generate an author bio, create a trust page, fix heading hierarchy, add subheadings, split long paragraphs, normalize entity naming, soften unsourced claims, differentiate duplicate titles, and audit content.

## Known issues / limitations (current, honest state)

- Automations' manual "Run now" still isn't supported - only the 2 built-ins' own configured schedule actually fires them (this now genuinely works, unlike before).
- A general, arbitrary trigger→action automation engine doesn't exist in Free - only 2 fixed, schedule-only automations.
- Reports export as CSV/JSON only - no PDF.
- Keywords (SEO & Visibility → Keywords) is honestly "not connected yet" - it doesn't fabricate rank data.

## Manual testing checklist (for a human, in a browser)

- [ ] Each top-level page (Dashboard, AI Copilot, SEO & Visibility, Content, Performance, Site Health, Accessibility, Security, Commerce, Automations, Reports, Settings) loads with exactly one page header, no duplicates.
- [ ] Findings tables across SEO & Visibility / Content / Performance / Site Health / Accessibility / Security / Commerce (they share a common table component) support search, filtering, pagination, and bulk Resolve/Ignore actions as expected.
- [ ] Running a scan from the Dashboard or a page's own "Run scan" button actually populates new findings and updates the dashboard's score/widgets afterward.
- [ ] SEO & Visibility → GEO's GEO Score card loads a real number and trend chart on page load, with no post-ID entry required.
- [ ] Automations' 2 built-in cards can be enabled/disabled and their schedule changed, and the header's "Build with AI"/"Create Automation"/"Browse Templates" buttons open the upgrade popup rather than doing nothing.
- [ ] Reports → Overview generates a real CSV/JSON report file; the Scheduled Reports table shows the blurred dummy rows, not a real schedule form.
- [ ] Settings → Modules shows all 6 modules (GEO Analysis, Technical SEO, Content Optimization, Knowledge Graph, Brand Visibility, AI Copilot) active by default, and toggling one off actually disables its dependent UI elsewhere.
- [ ] The browser console shows no JavaScript errors on any of the above screens.
