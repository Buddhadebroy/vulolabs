# Settings

Every VuloPilot setting lives under **VuloPilot → Settings**. This page is a map: it tells you what each group is for and links to the guide that explains it in depth.

> Install and the first scan are in [GETTING-STARTED](GETTING-STARTED.md). Settings save when you click **Save**; some panels save each change automatically and show "Settings saved."

**In this guide**

1. [The settings groups](#1-the-settings-groups)
2. [Business Information](#business-information)
3. [SEO](#seo)
4. [Scanning](#scanning)
5. [Automation](#automation)
6. [Reports](#reports)
7. [Notifications](#notifications)
8. [Integrations](#integrations)
9. [Backups](#backups)
10. [Developer Tools](#developer-tools)
11. [Modules](#modules)

## 1. The settings groups

In order: **Business Information, SEO, Scanning, Automation, Reports, Notifications, Integrations, Backups, Developer Tools, Modules.**

## Business Information

Tell VuloPilot about your business so it can build a complete Business Profile and Knowledge Graph.

| Field | Meaning |
|---|---|
| **Site tone** | How your site should sound (for example "Friendly and casual" or "Formal and technical"). Sent with every AI request |
| **Business type** | For example Software Company, Online Store, Consulting Agency |
| **Service pages** | Page URLs or page IDs for each service |
| **Business locations** | For example `Downtown Store | 123 Main St, Springfield` |
| **Competitors** | Used to calculate share of voice on the Brand Visibility page |

Guide: [AI-VISIBILITY](AI-VISIBILITY.md#2-set-up-your-business-first)

## SEO

Three panels: **SEO Titles**, **Sitemap** and **Instant Indexing**. Guide: [SEO](SEO.md).

## Scanning

What each scan checks and how often.

| Panel | Controls | Guide |
|---|---|---|
| **SEO & Content** | Titles/meta, images, links and schema, readability, robots.txt, redirects, About page | [SEO](SEO.md#choosing-which-checks-run) |
| **AI Visibility** | Entity clarity, freshness, answer-first, evidence, llms.txt | [AI-VISIBILITY](AI-VISIBILITY.md#11-settings-for-these-scans) |
| **Accessibility** | Frequency, WCAG level, WCAG scanner, link text | [ACCESSIBILITY](ACCESSIBILITY.md#5-choose-what-is-checked) |
| **Security** | Password, exposure, malware, login protection, firewall, email alerts | [SECURITY](SECURITY.md#4-turn-on-protection) |
| **WooCommerce** | Product schema check | [COMMERCE](COMMERCE.md#5-turn-checks-on-or-off) |

Each Scanning panel has a **Restore defaults** action where offered.

## Automation

Advanced settings for scheduled automations: cooldown, retry attempts and retry delay. Guide: [AUTOMATIONS](AUTOMATIONS.md#5-advanced-automation-settings).

## Reports

Default report format (PDF, CSV or Both) and default period (7 days, 30 days, 90 days, 6 months). Guide: [REPORTS](REPORTS.md#5-report-settings).

## Notifications

How and when VuloPilot contacts you.

**Email Settings**

| Field | Meaning |
|---|---|
| **Notification email** | Where alerts go |
| **Sender name / Sender email** | The "from" details on alert emails |
| **Send Test Email** | Sends a test so you can confirm delivery |

**Notification channels:** **Email** and **In-dashboard**.

**Alert groups** (each lets you pick what to be told about and how often - **Immediately**, **Daily digest** or **Weekly digest**):

| Group | Examples |
|---|---|
| **AI Crawler Alerts** | Crawler blocked, access limited, traffic drop, crawler inactive (3/7/14/30 days), new crawler detected |
| **Security Alerts** | Security vulnerabilities, malware detected, failed login attempts, new user created, file changes, SSL/certificate issues |
| **Visibility Alerts** | AI visibility score drop, Brand score drop, Knowledge Graph score drop (choose the drop size that triggers it) |
| **Critical issue alerts** | Security vulnerabilities, website down, critical performance issues, SEO indexing problems, data or functionality issues |

## Integrations

| Panel | What it does |
|---|---|
| **VuloCloud AI** | Connect the site to VuloCloud to enable AI features. Shows **Connected**, **Not Connected** or **Key needed** |
| **Google Services** | Connect one Google account for Search Console, Analytics (GA4) and AdSense. VuloPilot only reads data and stores it on your own site |
| **Tag Manager** | Enter a Google Tag Manager container ID (`GTM-XXXXXXX`) |
| **PageSpeed Insights** | Enter a Google API key for real speed scores |
| **Webmaster Tools** | Verification codes for Google, Bing, Pinterest, Baidu, Yandex, Norton Safe Web, plus custom `<meta>` tags |

Guides: [AI-COPILOT](AI-COPILOT.md), [SEO](SEO.md#site-verification-and-google-services), [PERFORMANCE](PERFORMANCE.md#1-connect-pagespeed-insights).

## Backups

Automatic backup switch, frequency (Daily or Weekly) and how many backups to keep. Guide: [SITE-HEALTH-AND-BACKUPS](SITE-HEALTH-AND-BACKUPS.md#5-set-up-automatic-backups).

## Developer Tools

Diagnostics and maintenance.

| Item | What it does |
|---|---|
| **Anonymous usage data** | Stores your preference to share anonymous usage information (nothing is collected yet) |
| **Cache → Clear cache** | Clears VuloPilot's cached results (extracted entities, schema snapshot, robots.txt parse). Everything rebuilds automatically |
| **Reset VuloPilot → Reset settings** | Restores every setting to its default. Scan reports and history are not deleted |
| **Keep VuloPilot data after uninstall** | **Keep data** (settings, scan history and reports stay if you reinstall) or **Delete everything** |

## Modules

Turn optional features on or off. Modules are grouped: **AI Visibility**, **Brand Visibility**, **SEO & Content**, **Site Health**, **Automations & AI** and **Commerce**. Turning a module off stops its scanning and hides its findings from the dashboard; findings already found are not deleted. The core modules (GEO analysis, technical SEO, content optimization, brand visibility, knowledge graph and AI Copilot) are on by default.
