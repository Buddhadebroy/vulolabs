# Security

## What it does

Security looks for weak spots that hackers use, watches for attacks, and stops people who keep guessing passwords. It gives your site a security score based on the problems it finds, and a list of what to fix.

## Why it matters

A hacked site can lose customers, get blocked by browsers and search engines, and cost real money to clean up. Most attacks are automatic and target easy weaknesses: weak passwords, out-of-date software and files that should not be there. Finding those early is far cheaper than repairing damage.

**Tip.** Turn on backups before you change security settings. See [SITE-HEALTH-AND-BACKUPS](SITE-HEALTH-AND-BACKUPS.md). New to VuloPilot? See [GETTING-STARTED](GETTING-STARTED.md).

## How to use it

1. Open **VuloPilot → Security**.
2. Click **Run Security Scan**.
3. Look at the score. It is rated **Good**, **Needs Work** or **At Risk**.
4. Work through the findings, most serious first, then scan again.

## What you see

| Card | In plain words |
|---|---|
| **Security status** | Your score and how much is left to fix |
| **Security Trend** | Whether your security is improving day by day |
| **Live Threat Monitor** | A checklist of protections: **Malware Scanning**, **Firewall**, **Login Protection**, **File Integrity** and **Spam Protection**. "Not tracked yet" means it has not run |
| **Recent Activity** | The latest security events |
| **Backup protection** | Whether automatic backups are on |
| **Plugin Overlap** | Plugins you have installed that do something VuloPilot already does, so you can remove extras |

## The problems it finds

| Group | What it means |
|---|---|
| **Login & Accounts** | Passwords that are easy to guess, and addresses that were blocked for too many wrong logins |
| **Website Exposure** | Things visible to the public that should be hidden, such as a list of your usernames, leftover backup files or debug mode left on |
| **Browser Protection** | Missing safety settings your site should send to visitors' browsers, and whether the site forces a secure connection |

The list shows each problem's **Severity** (how serious it is) and what is **Affected**. **Important** shows the most serious problems first.

## Settings explained

Go to **Settings → Scanning → Security**.

### What to check

| Setting | What it does | Why turn it on |
|---|---|---|
| **Weak password checks** | Finds users with easy-to-guess passwords | Weak passwords are the most common way in |
| **Exposed WordPress details** | Reports a visible WordPress version and the default database name prefix | Hides clues attackers use |
| **Core file changes** | Reports changes to WordPress's own files | A changed core file can mean the site was tampered with |
| **Malware checks** | Looks for harmful code, including program files hiding in your uploads folder | Uploads should only hold pictures and documents |
| **Exposed usernames** | Checks whether visitors can list your usernames | Knowing usernames is the first step of a break-in attempt |

### Stop password guessing

| Setting | What it does | Why turn it on |
|---|---|---|
| **Block repeated failed login attempts** | Blocks an address that gets the password wrong too many times | Stops automated guessing |
| **Failed attempts before lockout** | How many wrong tries are allowed | Lower is stricter, but may lock out you or your staff by mistake |
| **Lockout window (minutes)** | How long a blocked address must wait | Longer is stricter |

### Attack filter (firewall)

| Setting | What it does | Why use it |
|---|---|---|
| **Log requests matching known attack patterns** | Watches web requests for well-known attack shapes and writes them down. It never blocks anyone by itself | A safe first step: see what is really happening |
| **Enable active blocking** | Actually stops matching requests | Turn it on only after you have reviewed the log for a while and seen nothing legitimate matched. It is off by default on purpose |

### Get warned

| Setting | What it does | Why turn it on |
|---|---|---|
| **Email me on new security alerts** | Emails you when a scan finds a new problem | You hear about trouble without opening the dashboard |
| **Security alert email** | Where the email goes. Blank uses the site admin address | Send it to whoever will act on it |
| **Minimum alert severity** | Only problems at or above this level trigger an email, for example **Critical only** | Avoids inbox noise. The same open problem is not emailed again on every scan |

## Suggested setup

1. Turn on backups.
2. Turn on **Weak password checks**, **Malware checks** and **Core file changes**.
3. Turn on **Block repeated failed login attempts**.
4. Turn on **Log requests matching known attack patterns**. Enable active blocking later.
5. Turn on email alerts with **Critical only**.

## Related

- [SITE-HEALTH-AND-BACKUPS](SITE-HEALTH-AND-BACKUPS.md)
- [SETTINGS](SETTINGS.md#scanning)
- [TROUBLESHOOTING](TROUBLESHOOTING.md#locked-out-after-failed-logins) - if you lock yourself out
