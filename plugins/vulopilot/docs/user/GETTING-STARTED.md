# Getting Started with VuloPilot

This page covers everything you need once, before using any module: requirements, installing, the first scan, how the admin is laid out and the ideas every other guide relies on. The module guides link back here instead of repeating it.

**In this guide**

1. [What VuloPilot does](#1-what-vulopilot-does)
2. [Requirements](#2-requirements)
3. [Install and activate](#3-install-and-activate)
4. [Your first scan](#4-your-first-scan)
5. [Find your way around](#5-find-your-way-around)
6. [Ideas you will see everywhere](#6-ideas-you-will-see-everywhere)
7. [Connect the optional services](#7-connect-the-optional-services)
8. [Where to go next](#8-where-to-go-next)

## 1. What VuloPilot does

VuloPilot scans your WordPress site, lists what it finds as **findings**, turns them into scores you can track, and helps you fix them. It covers SEO, site health, performance, accessibility, security, AI search visibility and (with WooCommerce) store health.

The flow is always the same:

```
Scan  →  Findings and scores  →  Fix (by hand, or with an AI draft you approve)  →  Re-scan
```

Standard scans and reports work without any AI service. AI is an optional extra.

## 2. Requirements

| Requirement | Minimum |
|---|---|
| WordPress | 6.7 or greater |
| PHP | 8.1 or greater |
| Who can use it | Administrators (the `manage_options` capability) |

Optional: a VuloCloud connection (for AI), a Google account (Search Console, Analytics), WooCommerce (Commerce page).

## 3. Install and activate

Pick whichever method suits you.

### Method 1 - From the WordPress plugin directory

1. In WordPress go to **Plugins → Add New Plugin**.
2. Search for **VuloPilot**.
3. Click **Install Now**, then **Activate**.

### Method 2 - Upload the zip file

1. Download the VuloPilot zip file.
2. Go to **Plugins → Add New Plugin → Upload Plugin**.
3. Choose the zip, click **Install Now**, then **Activate Plugin**.

### Method 3 - Install on the server

1. Unzip the plugin on your computer.
2. Upload the `vulopilot` folder to `/wp-content/plugins/` (FTP, SFTP or your host's file manager).
3. Open **Plugins** in WordPress and click **Activate** under VuloPilot.

After activation a **VuloPilot** item appears in the admin menu. The main modules (SEO/GEO analysis, content, brand visibility, knowledge graph and AI Copilot) are switched on automatically.

## 4. Your first scan

1. Open **VuloPilot → Dashboard**.
2. Click **Run scan** in the header. VuloPilot runs every scanner and refreshes all scores.
3. Read the score cards. Open the areas that need work from the menu.

> The Dashboard also has a **Getting started** card with links to docs and help.

## 5. Find your way around

The top-level menu, in order:

| Menu item | What it is for | Guide |
|---|---|---|
| **Dashboard** | Overall health, needs-attention list, recent activity | [DASHBOARD](DASHBOARD.md) |
| **AI Copilot** | Chat with an assistant that knows your scan data | [AI-COPILOT](AI-COPILOT.md) |
| **SEO & Visibility** | SEO score, robots.txt, redirects, 404s, AI visibility, schema | [SEO](SEO.md), [AI-VISIBILITY](AI-VISIBILITY.md) |
| **Content** | AI content tools and content quality | [CONTENT](CONTENT.md) |
| **Performance** | Speed score, slow pages, caching and asset checks | [PERFORMANCE](PERFORMANCE.md) |
| **Site Health** | WordPress health checks and backups | [SITE-HEALTH-AND-BACKUPS](SITE-HEALTH-AND-BACKUPS.md) |
| **Accessibility** | WCAG-based checks | [ACCESSIBILITY](ACCESSIBILITY.md) |
| **Security** | Malware, firewall, login protection, vulnerabilities | [SECURITY](SECURITY.md) |
| **Commerce** | WooCommerce store checks (only shown when WooCommerce is active) | [COMMERCE](COMMERCE.md) |
| **Automations** | Scheduled scans and reports | [AUTOMATIONS](AUTOMATIONS.md) |
| **Reports** | Generated reports and the change history | [REPORTS](REPORTS.md) |
| **Settings** | Every setting, grouped by topic | [SETTINGS](SETTINGS.md) |

Direct links look like `wp-admin/admin.php?page=vulopilot#&tab=dashboard`. Only the tab name after `tab=` changes.

## 6. Ideas you will see everywhere

**Findings.** One specific problem on one page or item, with a severity (critical, high, medium, low). Findings stay open until a later scan no longer finds the problem.

**Scores.** Each area has a 0-100 score with a rating: **Good**, **Needs Work** or **At Risk**. Scores are calculated from your open findings and tracked over time, so you can see whether things are improving.

**Scans.** A scan re-checks your site. You can start one with a **Run ... scan** button on the page you are in, or let an automation run it on a schedule.

**AI suggestions and the approval flow.** When VuloPilot proposes a change, nothing on your site changes until you approve it:

```
Propose (AI drafts a change)  →  Preview (see before and after)  →  Approve  or  Reject
                                                     Approved changes can be rolled back afterwards
```

Some pages have an **Auto-applies** switch. It lets VuloPilot prepare the fix itself, but the change still waits for your approval before it goes live.

**Modules.** Optional features can be turned on or off in **Settings → Modules**. If you turn a module off, its scanning stops, but findings already found are kept.

## 7. Connect the optional services

None of these are required.

| Service | Why connect it | Where |
|---|---|---|
| **VuloCloud** | Enables AI features (suggestions, content generation, AI Copilot) and AI credits | Settings → Integrations → VuloCloud AI |
| **Google** | Search Console, Analytics (GA4), AdSense data inside VuloPilot | Settings → Integrations → Google Services |
| **Google PageSpeed Insights** | Real Mobile/Desktop speed scores | Settings → Integrations → PageSpeed Insights |
| **IndexNow** | Tell search engines about new content immediately | Settings → SEO → Instant Indexing |

Only the features you turn on contact outside services. The plugin readme's **External services** section lists what each one receives.

## 8. Where to go next

Recommended order for a new site:

1. [SETTINGS](SETTINGS.md) - fill in **Business Information** so scans and AI understand your business.
2. [SEO](SEO.md) - titles, sitemap, robots.txt, redirects.
3. [SITE-HEALTH-AND-BACKUPS](SITE-HEALTH-AND-BACKUPS.md) - turn on automatic backups.
4. [SECURITY](SECURITY.md) - login protection and malware checks.
5. [AUTOMATIONS](AUTOMATIONS.md) - schedule scans so the scores stay fresh.

Stuck? See [TROUBLESHOOTING](TROUBLESHOOTING.md).
