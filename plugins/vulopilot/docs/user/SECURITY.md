# Security

The Security page scans for weak spots, watches for attacks and blocks repeated login abuse. It shows a security score based on your open security findings.

> Install and the first scan are in [GETTING-STARTED](GETTING-STARTED.md). Turn on backups before you change security settings: [SITE-HEALTH-AND-BACKUPS](SITE-HEALTH-AND-BACKUPS.md).

**In this guide**

1. [Run a security scan](#1-run-a-security-scan)
2. [Read the score and the threat monitor](#2-read-the-score-and-the-threat-monitor)
3. [Work through the findings](#3-work-through-the-findings)
4. [Turn on protection](#4-turn-on-protection)
5. [Get email alerts](#5-get-email-alerts)
6. [Reference: what each check does](#6-reference-what-each-check-does)

## 1. Run a security scan

1. Open **VuloPilot → Security**.
2. Click **Run Security Scan** in the header.
3. Wait for the score and findings to update.

## 2. Read the score and the threat monitor

| Card | What it shows |
|---|---|
| **Security status** | Score and remaining points, with a rating: **Good**, **Needs Work** or **At Risk** ("I found N security issues." or "You're all caught up") |
| **Security Trend** | Daily security score over the last days (builds up after your first scan) |
| **Live Threat Monitor** | Status of each check: **Malware Scanning**, **Firewall**, **Login Protection**, **File Integrity** and **Spam Protection** |
| **Recent Activity** | The last few security-related events |
| **Backup protection** | Whether automatic backups are on |
| **Plugin Overlap** | Active plugins that duplicate a VuloPilot feature |

A check that has not run yet shows "Not tracked yet". A check with nothing wrong shows "No open findings".

## 3. Work through the findings

Findings are grouped:

| Group | What it covers |
|---|---|
| **Login & Accounts** | Weak or easily guessed admin credentials, plus IPs blocked by login protection |
| **Website Exposure** | Anonymous REST API user listing, `xmlrpc.php`, exposed backup or editor files, debug mode, the theme/plugin file editor |
| **Browser Protection** | Security response headers - clickjacking, MIME-sniffing and HTTPS enforcement |

The issues table has columns **Issue**, **Category**, **Severity**, **Affected** and **Resource type**. **Important** lists the critical and high-severity findings first. Fix a finding by following its recommendation, then run the scan again.

## 4. Turn on protection

Go to **Settings → Scanning → Security**.

### Scans

| Setting | What it does |
|---|---|
| **Weak password checks** | Finds users with weak passwords |
| **Exposed WordPress details** | Flags a visible WordPress version or the default `wp_` database prefix |
| **Core file changes** | Detects unauthorized changes in WordPress core files |
| **Malware checks** | Scans for suspicious code and harmful scripts (including PHP files hidden in your uploads folder) |
| **Exposed usernames** | Checks whether the REST API reveals usernames |

### Login protection

1. Turn on **Block repeated failed login attempts**.
2. Set **Failed attempts before lockout** - how many failures from one IP are allowed.
3. Set **Lockout window (minutes)** - how long a blocked IP waits, and how far back failures are counted.

### Firewall

1. Turn on **Log requests matching known attack patterns**. This checks each request's URL against known SQL-injection, path-traversal and direct-PHP-execution patterns and logs matches. It never blocks anyone on its own.
2. Review the log for a while to make sure nothing legitimate matches.
3. Then turn on **Enable active blocking**. A matched request now gets a 403 and is stopped. This is off by default on purpose.

## 5. Get email alerts

1. In the same settings page, turn on **Email me on new security alerts**.
2. Enter a **Security alert email**. Leave it blank to use the site admin email.
3. Choose the **Minimum alert severity** (for example **Critical only**).

An alert is sent when a scan finds a new finding at or above that severity. Findings that were already alerted and are still open are not re-sent on every scan.

## 6. Reference: what each check does

| Check | Detects |
|---|---|
| Malware and infection | PHP files in uploads and known backdoor patterns in your active theme |
| Core file integrity | Changed or missing WordPress core files |
| Weak passwords | Easily guessed user passwords |
| Basic vulnerabilities | Known-risk configuration |
| SSL monitoring | HTTPS and certificate problems |
| Firewall | Attack-pattern requests |
| Login protection | Repeated failed logins |

## Related guides

- [SITE-HEALTH-AND-BACKUPS](SITE-HEALTH-AND-BACKUPS.md)
- [SETTINGS](SETTINGS.md#scanning)
- [TROUBLESHOOTING](TROUBLESHOOTING.md) - if you lock yourself out
