# Dashboard

## What it does

The Dashboard is the first screen you see. It answers three questions at a glance: how much did my site send, did anything fail, and what is each channel sending through.

## Why it matters

Email and text messages fail quietly. A customer does not tell you they never got their order confirmation. The Dashboard puts failures in front of you.

## How to use it

1. Go to **VuloMail → Dashboard**.
2. Pick a period with **7D**, **30D** or **90D**.
3. Read the cards (below). Click anything with an arrow to go to the screen behind it.

At the top right, **Send a test** opens Tools and **Manage connections** opens Settings → Connections.

### Delivery

| Tile | Meaning |
|---|---|
| **Emails sent** | Emails a provider accepted in the period |
| **Emails failed** | Emails no connection could send |
| **SMS sent**, **SMS failed** | The same for text messages |

The line under the title gives the share that was delivered.

"Sent" means a provider accepted the message. It does not prove the message reached the inbox or the phone.

### Recent failures

The latest messages that could not be delivered, newest first, grouped by day.

| Part of a row | Meaning |
|---|---|
| Time | When it was attempted, in your site's timezone |
| Title and badge | The email subject, or "Text message"; **Email** or **SMS** |
| Line underneath | Why it failed, in the provider's words |
| Right side | Who it was for and which provider was used |
| **More Details** | Opens that entry in Logs |

**No failed messages** means nothing has failed to send.

### Channels & quick actions

Shows what Email and SMS are each sending through:

| Badge | Meaning |
|---|---|
| **Active** | A connection is set and in use |
| **Not set up** | No connection is set as primary. Email is going out through the WordPress default mailer; no text messages are sent |
| **Switched off** | Switched off under Settings |

Below are shortcuts to add a connection, send a test and open the log.

### SMS alerts

How many alerts are switched on, with a link to **Manage SMS alerts**.

### Notices at the top

| Notice | What to do |
|---|---|
| **Email is still using the WordPress default mailer** | Click **Add a connection**, add one and set it as primary |
| **Logging is switched off, so the totals below stay at zero** | Switch the log on under Settings → Logging & Privacy |

## Related

- [LOGS](LOGS.md) - the full history.
- [CONNECTIONS](CONNECTIONS.md) - add a provider.
- [TROUBLESHOOTING](TROUBLESHOOTING.md) - what a failure message means.
