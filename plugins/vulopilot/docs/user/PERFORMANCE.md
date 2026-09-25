# Performance

The Performance page measures how fast your site loads, shows which pages are slow and explains what to fix first.

> Install and the first scan are in [GETTING-STARTED](GETTING-STARTED.md). For real Mobile and Desktop speed scores, connect Google PageSpeed Insights first (step 1 below).

**In this guide**

1. [Connect PageSpeed Insights](#1-connect-pagespeed-insights)
2. [Run a speed test](#2-run-a-speed-test)
3. [Read the Overview tab](#3-read-the-overview-tab)
4. [Find slow pages](#4-find-slow-pages)
5. [Fix the problems](#5-fix-the-problems)
6. [Track progress](#6-track-progress)

## 1. Connect PageSpeed Insights

1. Go to **Settings → Integrations → PageSpeed Insights**.
2. Enter your **Google API key** and click **Connect**. The status becomes **Connected** (or **Not Connected** if the key was rejected).
3. VuloPilot only reads performance data from Google. It never changes your site through this connection.

Without a key, the score card asks you to "Connect Google PageSpeed Insights for a real Mobile/Desktop breakdown."

## 2. Run a speed test

1. Open **VuloPilot → Performance**.
2. Click **Run Speed Test** (or **Scan Again** later). The button shows **Scanning...** and a message confirms "Scan started - results will appear here shortly."
3. Wait a short time and the cards fill in.

The page has two tabs: **Overview** and **Slow Pages**.

## 3. Read the Overview tab

| Card | What it tells you |
|---|---|
| **Overall Speed Score** | Your score from Google PageSpeed Insights, rated Good / Needs Work / At Risk, with a note when mobile is slower than desktop |
| **Core Web Vitals** | LCP, INP, CLS and FCP - the loading, interactivity and layout-stability measures Google uses |
| **Biggest Speed Opportunity** | The single fix with the biggest impact. Click **View Affected Pages** or **View Details** |
| **AI Speed Assistant** | A summary of your open speed findings. Use **Optimize with AI** or **Review First** |
| **PHP acceleration** | Whether OPcache is enabled to speed up PHP |
| **Real-time monitoring** | Server response time, page load time and bandwidth |
| **Speed history** | Score trend over time (builds up after your first scan) |

The metric tiles group the checks: **Core Web Vitals**, **Caching**, **CSS Optimization**, **JavaScript**, **Images**, **Fonts** and **Database Cleanup** (post revisions, transients and other bloat).

Findings are grouped so you can work through them one topic at a time:

| Group | What it checks |
|---|---|
| **Server & Response Time** | Homepage response time and autoloaded options |
| **Images & Media** | Oversized or unoptimized images |
| **Code Optimization** | Unused or render-blocking CSS and JavaScript |
| **Caching & Delivery** | Page caching effectiveness and CDN coverage |
| **Loading & Fonts** | Deferred loading for below-the-fold content and web font loading |

## 4. Find slow pages

1. Open the **Slow Pages** tab.
2. Pages are listed by type (Homepage, Page, Post, Shop, Cart, Checkout, Product, Category) with their score and **Load Time**.
3. Click a page to see its details and top issues. A page that has not been tested shows **Not scored yet**.

The summary line rates the whole site: "Your pages are loading excellently.", "...loading well, but a few pages can be improved.", "Several pages could use performance improvements." or "Many of your pages need performance attention."

## 5. Fix the problems

- **Quick Actions** and **Recommended Fixes** offer one-click shortcuts such as **Clear All Caches**, **Minify CSS & JS**, **Optimize Images**, **Database Cleanup**, **Image Cleanup**, **Preload Critical Resources** and **Enable Browser Caching**. Recommended Fixes suggests the ones that match your slowest pages.
- For bigger problems (for example an oversized image), open the finding, follow its recommendation, then re-run the speed test.

## 6. Track progress

Run the speed test again after each change. The **Overall Speed Score** and **Speed history** show whether you improved. To have it run on its own, use an automation ([AUTOMATIONS](AUTOMATIONS.md)).

## Related guides

- [SITE-HEALTH-AND-BACKUPS](SITE-HEALTH-AND-BACKUPS.md) - database size, cron and server checks
- [SETTINGS](SETTINGS.md#integrations) - PageSpeed key
