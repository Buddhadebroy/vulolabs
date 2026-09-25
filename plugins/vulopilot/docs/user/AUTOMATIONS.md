# Automations

Automations run VuloPilot tasks on a schedule so your scores stay fresh without you opening the dashboard. This plugin includes two ready-made automations.

> Install and the first scan are in [GETTING-STARTED](GETTING-STARTED.md).

**In this guide**

1. [The two included automations](#1-the-two-included-automations)
2. [Turn one on and set its schedule](#2-turn-one-on-and-set-its-schedule)
3. [Check that they are running](#3-check-that-they-are-running)
4. [Fix a failed run](#4-fix-a-failed-run)
5. [Advanced automation settings](#5-advanced-automation-settings)
6. [How scheduling works](#6-how-scheduling-works)

## 1. The two included automations

| Automation | What it does |
|---|---|
| **Run Full Site Scan** | Automatically scans your website and refreshes your VuloPilot insights |
| **Send Visibility Report** | Emails you a summary of your website's visibility, issues and opportunities |

Both are always listed at the top of **VuloPilot → Automations**. There is no template picker or wizard for these two.

## 2. Turn one on and set its schedule

1. Open **VuloPilot → Automations**.
2. Find the automation card.
3. Switch it on.
4. Choose the schedule: **daily, weekly, monthly** or **manual** (only when you run it).
5. Save.

For the email report, set the recipient address and sender in **Settings → Notifications → Email Settings** first, and use **Send Test Email** to confirm delivery.

## 3. Check that they are running

The top of the page has two cards:

| Card | Shows |
|---|---|
| **Automation status** | Counts of **Active**, **Not active**, needs setup and **Errors** |
| **Needs your attention** | Automations that failed. "Great job! Your automations are running smoothly." means none |

The **Automation status** widget on the Dashboard shows the same enabled/not active state.

## 4. Fix a failed run

If a scheduled run did not complete, the attention card says "The last scheduled run didn't complete successfully."

1. Click **Try Again** (it shows **Retrying...**).
2. If it fails again, read the error shown with the run.
3. For the email report, common causes are a missing recipient ("No recipient configured, or the report failed to generate") or report delivery not being available on the site ("No report delivery extension is active").

## 5. Advanced automation settings

Go to **Settings → Automation**. The defaults are safe; only change them if you have a reason.

| Setting | Meaning |
|---|---|
| **Cooldown duration (minutes)** | Minimum wait before another automated action for the same issue (1-1440) |
| **Maximum retry attempts (times)** | How many times a failed automation is retried (0-5) |
| **Delay between retries (minutes)** | Wait between retries (1-1440) |

## 6. How scheduling works

Scheduled runs use WordPress's own scheduler (WP-Cron). WP-Cron runs when someone visits your site, so on very quiet sites a run can start late. If **Site Health → Background Tasks** reports overdue events, see [TROUBLESHOOTING](TROUBLESHOOTING.md#scheduled-scans-or-emails-do-not-run).

## Related guides

- [REPORTS](REPORTS.md)
- [SETTINGS](SETTINGS.md#notifications)
