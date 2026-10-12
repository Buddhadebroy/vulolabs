# Email

## What it does

**Settings → Email** controls whether VuloMail delivers your site's email, who the email appears to come from, and what happens when your connections fail.

## Why it matters

- The sender address is the most common reason a provider rejects email. Most providers only accept an address you have verified with them.
- The "last resort" setting decides whether an email is dropped or still attempted when your providers are down.

## How to use it

1. Go to **VuloMail → Settings → Email**.
2. Set **Sender email** to an address on your own domain that your email service has verified.
3. Set **Sender name** to your site or business name.
4. Leave **Fall back to the WordPress default mailer** on unless you have a reason not to.

Every change saves by itself a moment after you make it.

## Settings explained

### Routing

| Setting | What it does | Why you might change it |
|---|---|---|
| **Send email through VuloMail** | When on, your site's email goes through your primary connection. When off, WordPress sends email exactly as it would without VuloMail | Switch off to rule VuloMail out while investigating a problem. Your connections are kept |
| **Fall back to the WordPress default mailer** | If the primary and backup both fail, hands the email to WordPress instead of dropping it | Switch off if your host's mailer is unreliable or your provider must be the only sender for your domain |

### Sender

| Setting | What it does | Why you might change it |
|---|---|---|
| **Sender email** | Replaces WordPress's default sender (`wordpress@yourdomain`) | Always set this. Use an address your provider has verified |
| **Sender name** | Replaces the default sender name "WordPress" | So recipients see your business name |
| **Always use this sender email** | Uses your sender email even when a plugin sets its own From address | Switch on if a plugin sends from an address your provider rejects |
| **Always use this sender name** | Uses your sender name even when a plugin sets its own | Switch on for one consistent name on every email |

Without the "always" switches, your sender only replaces the WordPress default. A plugin that sets its own From address keeps it.

## What happens when something fails

```
Primary fails  ->  Backup is tried  ->  (if last resort is on) WordPress default mailer is tried  ->  Failed
```

- The message appears **once** in the log, with every attempt listed.
- If the backup delivered it, the log shows **Sent via backup**.
- You can get a text when an email fails: see [SMS-ALERTS](SMS-ALERTS.md).

## Which emails does this cover?

Everything sent with WordPress's standard email function: password resets, new user emails, comment notifications, WooCommerce order emails, contact form notifications and emails from most plugins.

A plugin that talks to an email service directly, without using WordPress's email function, is not affected.

## Related

- [CONNECTIONS](CONNECTIONS.md) - add and choose providers.
- [TOOLS](TOOLS.md) - check your sender domain's SPF and DMARC records.
- [LOGS](LOGS.md) - see what was sent.
