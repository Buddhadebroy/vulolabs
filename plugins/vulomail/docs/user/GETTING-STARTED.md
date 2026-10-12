# Getting Started with VuloMail

## What VuloMail does

VuloMail makes sure the emails and text messages your WordPress site sends actually arrive. It sends your site's email through an email service you choose, sends text messages through an SMS provider you choose, keeps a log of everything, and tells you when something fails.

## Why use it

- WordPress sends email through your web server by default. Many hosts limit or block that, and mailbox providers such as Gmail often put those emails in spam.
- With VuloMail, order confirmations, password resets and form notifications go through a proper email service.
- If your email service has a problem, a backup can take over.
- You can see every message that was sent and why any message failed.
- You do not need a VuloLabs account, a subscription or any other plugin. You use providers you already have.

## About this page

This page covers what you only need once: requirements, installing, connecting your email, a first test and a map of the menu. The other guides do not repeat it.

**In this guide**

1. [How it works](#1-how-it-works)
2. [Requirements](#2-requirements)
3. [Install and activate](#3-install-and-activate)
4. [Connect your email](#4-connect-your-email)
5. [Send a test](#5-send-a-test)
6. [Find your way around](#6-find-your-way-around)
7. [Ideas you will see everywhere](#7-ideas-you-will-see-everywhere)
8. [Where to go next](#8-where-to-go-next)

## 1. How it works

```
Your site sends an email  ->  VuloMail  ->  your primary connection  ->  inbox
                                               │ if it fails
                                               └─►  your backup connection  ->  inbox
```

Every email from WordPress, WooCommerce, your forms and your other plugins takes this path. You do not change anything in those plugins.

**Nothing changes when you activate VuloMail.** WordPress keeps sending email the way it always has until you add a connection and set it as primary.

## 2. Requirements

| Requirement | Minimum |
|---|---|
| WordPress | 6.4 or greater |
| PHP | 7.4 or greater |
| Who can use it | Site administrators |
| An email service | Any SMTP account, or SendGrid, Mailgun, Brevo or Postmark |

Optional: an SMS provider account (Twilio, Vonage, Plivo or Clickatell) for text messages, and WooCommerce for store alerts.

## 3. Install and activate

1. In WordPress go to **Plugins → Add New**.
2. Search for **VuloMail**, or choose **Upload Plugin** and pick the zip file.
3. Click **Install Now**, then **Activate**.

A **VuloMail** item appears in the WordPress menu.

## 4. Connect your email

1. Go to **VuloMail → Settings**. It opens on **Connections**.
2. In the **Email** section click **Add email connection**.
3. Choose your **Provider** and fill in the details it asks for. [CONNECTIONS](CONNECTIONS.md) lists what each provider needs.
4. Click **Save connection**.
5. Your connection is saved but not in use yet. Click **Set as primary** on its row.
6. Open the **Email** sub-tab and enter a **Sender email**. Use an address your email service has verified, for example `hello@yourdomain.com`.

Changes on the Email sub-tab save by themselves a moment after you make them.

## 5. Send a test

1. Go to **VuloMail → Tools**.
2. In **Send a test email**, check the address and click **Send test**.
3. Look in that inbox. Check the spam folder too.

If the test fails, the message on screen says why. See [TROUBLESHOOTING](TROUBLESHOOTING.md).

## 6. Find your way around

| Menu item | What it is for | Guide |
|---|---|---|
| **Dashboard** | Totals, channel status, recent failures | [DASHBOARD](DASHBOARD.md) |
| **Logs** | Every email and text message | [LOGS](LOGS.md) |
| **Tools** | Test email, test SMS, diagnostics | [TOOLS](TOOLS.md) |
| **SMS Alerts** | Text messages for site, store and customer events | [SMS-ALERTS](SMS-ALERTS.md) |
| **Settings** | Connections, Email, SMS, Logging & Privacy, Data | [SETTINGS](SETTINGS.md) |

The search box at the top of every VuloMail screen finds tabs, settings and sections by name.

## 7. Ideas you will see everywhere

| Word | Meaning |
|---|---|
| **Connection** | One account with an email service or SMS provider that you have added to VuloMail |
| **Primary** | The connection used for every message |
| **Backup** | The connection tried when the primary fails |
| **WordPress default mailer** | The way WordPress sends email on its own, through your web server |
| **Last resort** | Handing an email to the WordPress default mailer when the primary and backup both fail |
| **Sent** | A provider accepted the message. It does not prove the message reached the inbox |
| **Failed** | No connection could send the message |
| **Sent via backup** | The primary failed and something else delivered the message |

## 8. Where to go next

- Add a second connection as a backup: [CONNECTIONS](CONNECTIONS.md).
- Get a text when an order comes in or an email fails: [SMS-ALERTS](SMS-ALERTS.md).
- Check your domain is set up so email is not marked as spam: [TOOLS](TOOLS.md).
