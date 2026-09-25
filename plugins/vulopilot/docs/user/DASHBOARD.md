# Dashboard

The Dashboard is your starting point. It shows how healthy your site is right now, what needs attention and what VuloPilot did recently.

> New here? Read [GETTING-STARTED](GETTING-STARTED.md) first. It covers install, the first scan and the ideas (findings, scores, approvals) this page builds on.

**In this guide**

1. [What you see](#1-what-you-see)
2. [Run a scan](#2-run-a-scan)
3. [Read the scores](#3-read-the-scores)
4. [Act on "Needs your attention"](#4-act-on-needs-your-attention)
5. [Customize the layout](#5-customize-the-layout)
6. [Widget reference](#6-widget-reference)

## 1. What you see

The page greets you ("Good morning / afternoon / evening") and shows a set of widgets:

```
Header:  greeting + Run scan + Customize
Row 1:   Website Health Scores  |  Health timeline
Row 2:   Site snapshot          |  Automation status
Row 3:   Needs your attention   |  AI suggestions
Row 4:   AI crawler traffic     |  Recent activity  |  Latest reports  |  ...
```

A **Getting started** card at the top of a new install links to docs, help and support.

## 2. Run a scan

1. Click **Run scan** in the header.
2. VuloPilot runs every scanner and refreshes every score and finding on the page.
3. The **Health timeline** and **Recent activity** update with the result.

You can also schedule scans (see [AUTOMATIONS](AUTOMATIONS.md)).

## 3. Read the scores

The **Website Health Scores** widget shows one overall score plus a score per area:

| Score | Covers |
|---|---|
| **Visibility Score** | SEO and AI visibility |
| **Health Score** | WordPress and server health |
| **Commerce Score** | Store checks (WooCommerce sites) |
| **Performance Score** | Speed and Core Web Vitals |
| **Content Score** | Content quality |
| **Brand Score** | Trust and authority signals |

The rating labels are **Excellent, Good, Fair, Needs work** with a one-line message such as "Your site could use some improvement." Click **View full report** to open the detail. The **Health timeline** shows how these scores have trended; it fills in after your first scan.

## 4. Act on "Needs your attention"

This widget has three lists:

| List | What it means | What to do |
|---|---|---|
| **Open issues** | Findings still open from the last scans | Click an issue to open its page and fix it |
| **Quick fixes** | Simple problems AI can resolve, such as an image issue | Click **Fix with AI**, review the preview, approve or reject |
| **Pending approval** | AI changes waiting for you | Approve to apply, reject to discard |

After you approve or reject, you see "Action approved and executed." or "Action rejected." Approved changes appear in **Recent Changes**.

The **AI Suggestions** widget lists AI-generated fixes waiting for your review. It fills up once a scan finds something worth fixing.

## 5. Customize the layout

1. Click the **Customize** (pencil) icon in the header.
2. Drag a widget by its handle (**Drag to reorder**) to move it.
3. Click **Hide** on a widget to remove it. Hidden widgets are listed under **Hidden widgets:** so you can bring them back.
4. Click **Reset to default** to restore the original layout.

## 6. Widget reference

| Widget | Shows |
|---|---|
| **Website Health Scores** | Overall score and score per area |
| **Health timeline** | Score trend over time |
| **Site snapshot** | Counts of posts, pages, comments, users, active plugins, and a homepage thumbnail |
| **Automation status** | Which built-in automations are enabled |
| **Needs your attention** | Open issues, quick fixes, pending approvals |
| **AI Suggestions** | AI-generated fixes waiting for review |
| **Recent activity** | Scans, alerts and AI actions as they happen |
| **Recent Changes** | Changes VuloPilot made automatically |
| **AI crawler traffic** | Visits from GPTBot, ClaudeBot, PerplexityBot and other AI crawlers |
| **Brand Visibility breakdown** | Overall, Trust and Authority scores |
| **Knowledge Graph** | People, Organizations, Products, Services, Locations and Categories found on your site |
| **Latest reports** | Your most recent scan and audit reports |

## Related guides

- Fixing what the Dashboard flags: [SEO](SEO.md), [PERFORMANCE](PERFORMANCE.md), [SECURITY](SECURITY.md), [ACCESSIBILITY](ACCESSIBILITY.md)
- AI and approvals: [AI-COPILOT](AI-COPILOT.md)
