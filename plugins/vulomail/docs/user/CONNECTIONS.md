# Connections

## What it does

A connection is one account with an email service or SMS provider. **Settings → Connections** is where you add them and choose which one your site uses.

## Why it matters

- The connection is what actually delivers your messages. No connection means email goes out the way WordPress sends it by default, and no text messages go out at all.
- A second connection as a backup keeps messages flowing when your main provider has a problem.

## How to use it

### Add an email connection

1. Go to **VuloMail → Settings → Connections**.
2. In the **Email** section click **Add email connection**.
3. Choose a **Provider**. You cannot change the provider later; add a new connection instead.
4. Give it a **Connection name**. This is only for you, to tell connections apart.
5. Fill in the provider's fields (see the tables below).
6. Click **Save connection**.

The list always starts with **WordPress default mailer**, marked **Primary** until you choose otherwise. A new connection is saved but not used until you set it as primary.

### Choose primary and backup

| Button on a connection's row | What it does |
|---|---|
| **Set as primary** | Sends every message through this connection |
| **Set as backup** | Uses this connection only when the primary fails. Appears once you have a primary |
| **Remove as backup** | Stops using it as the backup |
| **Set as primary** on the WordPress row | Goes back to the WordPress default mailer |

A connection cannot be both. Making the backup your primary frees the backup slot.

### Add an SMS connection

Same steps in the **SMS** section, with **Add SMS connection**. The first SMS connection you add becomes the primary straight away, because there is no built-in way to send text messages to fall back on.

### Test, edit, delete

| Button | What it does |
|---|---|
| **Test** | Opens **Tools** with this connection chosen, so you can send a test through it alone |
| **Edit** | Change the name or details. Saved passwords and keys are shown as dots; leave them alone to keep them, or type a new value to replace them |
| **Delete** | Removes the connection and its saved details. If it was the primary, the backup takes its place |

### Badges

| Badge | Meaning |
|---|---|
| **Primary** | In use for every message |
| **Backup** | Used when the primary fails |
| **Disabled** | Switched off in its Edit form; it is skipped |
| **Incomplete** | A required detail is missing, or a saved password can no longer be read. Edit the connection and enter it again |
| **Built in** | The WordPress default mailer, when it is not the primary |

## Settings explained

### Email providers

| Provider | What you need | Where to find it |
|---|---|---|
| **SMTP** | SMTP host, Port, Encryption, Username, Password | Your email host or service. Works with Google Workspace, Microsoft 365, Amazon SES, Zoho and most others |
| **SendGrid** | API key | SendGrid → Settings → API Keys. The key needs the "Mail Send" permission |
| **Mailgun** | API key, Sending domain, Region | Mailgun → Sending → Domains. Choose EU if your domain is in Mailgun's EU region |
| **Brevo** | API key | Brevo → SMTP & API. Use a v3 API key |
| **Postmark** | Server API token, Message stream | Postmark → your server → API Tokens. Leave the stream as `outbound` unless you created another |

SMTP settings in detail:

| Setting | What it does |
|---|---|
| **SMTP host** | The server name, for example `smtp.example.com` |
| **Port** | Usually 587 with STARTTLS, or 465 with SSL/TLS |
| **Encryption** | STARTTLS, SSL/TLS, or None. Use what your provider tells you. None sends your password unprotected |
| **Use authentication** | Leave on unless your provider says the server needs no login |
| **Username**, **Password** | Your SMTP login. Some services need an app password rather than your normal one |

### SMS providers

| Provider | What you need |
|---|---|
| **Twilio** | Account SID, Auth token, Sender (a Twilio number, a sender name, or a Messaging Service SID starting `MG`) |
| **Vonage** | API key, API secret, Sender (a Vonage number or a sender name of up to 11 characters) |
| **Plivo** | Auth ID, Auth token, Sender |
| **Clickatell** | API key. Sender is optional |

## Are my passwords safe?

- Passwords and API keys are encrypted before they are saved in your database.
- They are never shown again. The screen shows dots and the last four characters.
- VuloMail only contacts the providers you connect.

If your site's security keys in `wp-config.php` are changed, saved passwords can no longer be read. The connection shows **Incomplete**; edit it and enter the password again.

## Related

- [EMAIL](EMAIL.md) - sender address and what happens when a connection fails.
- [TOOLS](TOOLS.md) - test a connection.
- [TROUBLESHOOTING](TROUBLESHOOTING.md) - a connection that will not send.
