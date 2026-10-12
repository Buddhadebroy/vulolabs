# Troubleshooting and FAQ

Find what is going wrong, then follow the steps. Each answer points to the guide with more detail.

**Start with these two, whatever the problem:**

1. **Tools → Diagnostics.** It finds most setup problems and says what to do.
2. **Logs → View** on the failed message. It shows the provider's own reason.

**Jump to**

- [Email is not being sent through my connection](#email-is-not-being-sent-through-my-connection)
- [The test email fails](#the-test-email-fails)
- [Emails are sent but land in spam, or never arrive](#emails-are-sent-but-land-in-spam-or-never-arrive)
- [A connection shows Incomplete](#a-connection-shows-incomplete)
- [Text messages are not sent](#text-messages-are-not-sent)
- [An SMS alert did not arrive](#an-sms-alert-did-not-arrive)
- [The log is empty or missing things](#the-log-is-empty-or-missing-things)
- [Dates and times look wrong](#dates-and-times-look-wrong)
- [Another email plugin is installed](#another-email-plugin-is-installed)
- [Reset or remove VuloMail](#reset-or-remove-vulomail)
- [FAQ](#faq)

## Email is not being sent through my connection

1. Open **Settings → Connections**. Is your connection marked **Primary**? A new connection is saved but not used until you click **Set as primary**.
2. Open **Settings → Email**. Is **Send email through VuloMail** on?
3. Does the connection show **Incomplete** or **Disabled**? Edit it.
4. Run **Tools → Diagnostics** and read **wp_mail() delivery**. If another plugin handles your email, VuloMail never sees it.

## The test email fails

The message on screen is the provider's reason. Common ones:

| Message contains | Usual cause | Fix |
|---|---|---|
| "Could not authenticate" | Wrong SMTP username or password | Re-enter them. Google and Microsoft accounts often need an app password |
| "Could not connect to SMTP host" | Wrong host or port, or your web host blocks that port | Check the host and port. Try 587 with STARTTLS, or 465 with SSL/TLS. Ask your host whether outgoing SMTP is allowed |
| "HTTP 401" or "HTTP 403" | The API key is wrong, expired, or lacks permission to send | Create a new key with sending permission |
| "sender", "from address", "not verified" | Your sender email is not verified with the provider | Verify the address or domain with your provider, then set it under Settings → Email |
| "domain" (Mailgun) | The sending domain or region is wrong | Check the domain, and choose EU if it is in Mailgun's EU region |
| "timed out" | Your server could not reach the provider | Try again; ask your host if it keeps happening |

Test one connection on its own with **Send through → (the connection)** in Tools.

## Emails are sent but land in spam, or never arrive

The log says **Sent**, which means the provider accepted the message. What happens next is between the provider and the recipient's mailbox.

1. Run **Tools → Diagnostics** and read **Sender domain DNS**. Add any missing SPF or DMARC record.
2. In your email provider's dashboard, check that DKIM is set up for your domain.
3. Use a sender address on your own domain, not a free address such as Gmail.
4. Look up the message in your provider's dashboard using the **Provider ID** from the log entry. It shows bounces and blocks.

## A connection shows Incomplete

Either a required detail is empty, or a saved password or key can no longer be read. The second happens when the security keys in your site's `wp-config.php` were changed, for example after a migration or a security clean-up.

Fix: **Edit** the connection and type the password or key in again.

## Text messages are not sent

1. **Settings → Connections**: is there an SMS connection marked **Primary**?
2. **Settings → SMS**: is **Send SMS through VuloMail** on?
3. Is the number in international format (`+14155550123`)? If your numbers have no country code, set **Default country code**.
4. Send a test from **Tools** and read the reason.
5. Check your balance and sender approval in your SMS provider's dashboard. Some countries require a registered sender name.

## An SMS alert did not arrive

1. **SMS Alerts**: is that alert switched on?
2. For alerts to you: is **Admin phone number** set under Settings → SMS?
3. For customer alerts: did the customer give a billing phone number on the order?
4. Store and customer alerts need WooCommerce to be active.
5. **An email failed to send** is sent at most once every 15 minutes.
6. A customer gets one text per status change. If a specific alert such as "Order completed" is on, the general "Any other order status change" alert is not also sent for it.
7. Look in **Logs → SMS**. If the alert is there as **Failed**, the reason is shown.

## The log is empty or missing things

| What you see | Why |
|---|---|
| Nothing at all | **Keep a log of sent and failed messages** is off under Settings → Logging & Privacy |
| No message text | **Store message content** is off. It only applies to messages sent after you switch it on |
| Recipients shown as `j•••@example.com` | **Mask recipients in the log** is on |
| Older entries are gone | They passed the **Keep entries for** period |
| **Resend** is greyed out | The message text was not stored, or recipients were masked |

## Dates and times look wrong

VuloMail shows dates in the format and timezone set in WordPress under **Settings → General**. If the times are hours out, set the **Timezone** there.

## Another email plugin is installed

Two plugins delivering email compete for the same messages. Diagnostics lists the ones it recognises under **Other email plugins**.

Keep one. To move to VuloMail: add the same account as a connection, set it as primary, send a test, then deactivate the other plugin.

## Reset or remove VuloMail

| You want to | Do this |
|---|---|
| Stop VuloMail delivering email, keep everything | Settings → Email → switch off **Send email through VuloMail** |
| Stop all text messages | Settings → SMS → switch off **Send SMS through VuloMail** |
| Go back to the WordPress mailer but keep your connections | Settings → Connections → **Set as primary** on **WordPress default mailer** |
| Clear the log | Logs → **Delete all logs** |
| Remove the plugin but keep your data | Deactivate and delete it. With **Keep data** selected (the default) nothing is removed |
| Remove the plugin and all its data | Settings → Data → choose **Delete everything**, then deactivate and delete the plugin |

## FAQ

**Does activating VuloMail change how my site sends email?**
No. Nothing changes until you add a connection and set it as primary.

**Do I need a VuloLabs account or a paid plan?**
No.

**Does "Sent" mean the email was delivered?**
It means your provider accepted it. Delivery to the inbox is reported in your provider's own dashboard.

**Will a customer get the same email twice when the backup is used?**
Normally no: the backup is only tried when the primary reports a failure. In the rare case where a provider accepts a message but reports an error, the backup would send it again.

**Where are my passwords stored?**
In your WordPress database, encrypted. They are never shown again and never sent anywhere except to the provider they belong to.

**Does VuloMail send my data anywhere?**
Only to the providers you connect, and only the messages sent through them. It has no tracking and contacts no VuloLabs server.

**Can I use it for marketing text messages?**
VuloMail sends what your site asks it to. You are responsible for having your recipients' consent and for the rules on text messages in your country.

**Does it work with WooCommerce and contact form plugins?**
Yes. Anything that sends email the standard WordPress way is covered without any change to that plugin.
