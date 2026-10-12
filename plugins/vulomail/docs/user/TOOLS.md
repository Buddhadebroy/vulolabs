# Tools

## What it does

**Tools** has three things: send a test email, send a test text message, and run diagnostics on your setup.

## Why it matters

- A test proves a connection works before a real customer depends on it.
- Diagnostics finds the usual causes of email not arriving, such as a missing DNS record or two email plugins competing.

## How to use it

### Send a test email

1. Go to **VuloMail → Tools**.
2. In **Send a test email**, enter an address in **Send to**. It starts as your own.
3. Choose **Send through**:
   - **Live routing** follows the same path as every other email, including the backup.
   - A named connection sends through that one only. Use this to check a backup that is not normally used.
4. Click **Send test**.

| Result | Meaning |
|---|---|
| **Accepted by ...** | The provider took the message. Check the inbox, and the spam folder |
| **The test was not sent** | The reason is shown. With Live routing, each connection that was tried is listed |

### Send a test SMS

The same, in **Send a test SMS**. Enter the **Phone number** in international format, for example `+14155550123`. Your provider may charge for the message.

### Run diagnostics

The **Diagnostics** card runs when the page opens. Click **Run diagnostics again** after changing something.

Each check has a result:

| Result | Meaning |
|---|---|
| **Passed** | Nothing to do |
| **Needs attention** | Works, but something could cause trouble |
| **Problem** | Needs fixing |
| **Info** | For your information |

A check that needs action shows **What to do** and, where it helps, a button to the right screen.

Diagnostics only looks. It never changes a setting or sends a message.

## What diagnostics checks

| Check | What it looks at | If it flags something |
|---|---|---|
| Email routing | Whether your email goes through a connection, and whether you have a backup | Add a connection and set it as primary |
| wp_mail() delivery | What actually handles email on your site: VuloMail, another plugin, or WordPress itself | If another plugin handles it, VuloMail cannot see your email until that plugin is deactivated |
| Recent email delivery | Whether email has really been going out, from the log | Read the failures in Logs |
| Sender address | Whether you set a sender email | Set one under Settings → Email |
| Sender domain DNS | Whether your domain publishes SPF and DMARC records | Add the records your email provider gives you, at your domain registrar |
| Other email plugins | Other active plugins that also deliver email | Keep only one delivering email |
| SMS routing | Whether text messages have a gateway | Add an SMS connection |
| Connections | Connections with a missing detail or an unreadable password | Edit the connection and enter it again |
| Server | PHP, WordPress and encryption support | Ask your host |
| Delivery log | Whether the log is working and how long entries are kept | |
| Scheduled tasks | Whether WordPress's scheduler is disabled | Old log entries are only cleaned up if your server runs the scheduler another way |

### About SPF, DKIM and DMARC

These are records on your domain that tell mailbox providers your email is genuine. Gmail and Yahoo may reject or junk email from a domain without them.

- VuloMail can check **SPF** and **DMARC**.
- It cannot check **DKIM**; your email provider's dashboard shows whether that is set up.
- Your email provider gives you the exact records. You add them where your domain is registered.

## Related

- [CONNECTIONS](CONNECTIONS.md) - the **Test** button on a connection brings you here.
- [TROUBLESHOOTING](TROUBLESHOOTING.md) - when a test fails.
