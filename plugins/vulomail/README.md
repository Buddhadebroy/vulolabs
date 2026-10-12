# VuloMail – SMTP, Email Logs & SMS Notifications #
**Contributors:** [vulolabs](https://profiles.wordpress.org/vulolabs/)  
**Tags:** smtp, email logs, sms, woocommerce, email  
**Requires at least:** 6.7  
**Tested up to:** 7.1.3  
**Requires PHP:** 8.1  
**Stable tag:** 1.0.0  
**License:** GPLv2 or later  
**License URI:** https://www.gnu.org/licenses/gpl-2.0.html  

WordPress SMTP, email logs and SMS notifications for WooCommerce, with backup email connections and tools to troubleshoot sending failures.

## Description ##

VuloMail is a WordPress SMTP, email logging and SMS notification plugin that helps you send website emails, troubleshoot sending failures and keep customers updated about their WooCommerce orders.

Connect WordPress to an SMTP server or a supported email service for password resets, order emails, contact form notifications and other transactional emails. Add a backup email connection, see what happened to each message and receive SMS alerts for important website and store activity.

WordPress not sending emails? VuloMail helps you check your email settings, send a test email and find the provider’s error message so you know what needs attention.

No VuloLabs account, subscription or additional plugin is required for core email functionality. You connect your own email or SMS provider. Provider charges and sending limits may apply.

### WordPress SMTP and email providers ###

Send WordPress emails through your chosen email service. Use SMTP or connect directly to SendGrid, Mailgun, Brevo or Postmark.

- **SMTP:** Configure your SMTP host, port, authentication and SSL/TLS or STARTTLS encryption.
- **SendGrid:** Send emails using your SendGrid API key.
- **Mailgun:** Connect your sending domain and select its US or EU region.
- **Brevo:** Send transactional emails through the Brevo API.
- **Postmark:** Connect your server API token and message stream.
- **Sender settings:** Set your sender email address and sender name, with optional overrides for values supplied by other plugins.

SMTP connections can use services such as Google Workspace, Microsoft 365, Amazon SES and Zoho, subject to the provider’s SMTP authentication requirements.

VuloMail works with emails sent through the standard WordPress wp_mail() function, including WooCommerce emails and contact form notifications. Plugins that send directly through their own email service are not affected.

### Backup email connections and automatic failover ###

Give important emails another sending route when your primary connection fails.

- **Choose a primary email connection** and a backup connection.
- **Automatically try the backup** if the primary connection reports a failure.
- Optionally use the **WordPress default mailer** as a final fallback.
- See **every sending attempt** within a single log entry.
- Identify **messages sent through your backup connection**.

### Email logs and SMS logs ###

See which messages were sent, which failed and what went wrong. Review email and SMS activity together in your WordPress dashboard.

- **Search logs** by recipient or email subject.
- **Filter messages** by channel, status and date range.
- View the **recipient, sender, provider, time and sending source**.
- Read **provider error messages** and inspect individual sending attempts.
- Find the **provider’s message ID** for further investigation.
- Optionally **store message content** and resend eligible messages.
- Choose **how long logs are kept**, with automatic cleanup of older entries.

Resending requires stored message content and unmasked recipients. A “Sent” status means the provider accepted the message; it does not confirm delivery to an inbox or phone.

### WordPress SMS notifications ###

Receive text alerts for important activity without checking your dashboard. Connect Twilio, Vonage, Plivo or Clickatell and choose which SMS alerts to enable.

- **New user registrations**.
- **Administrator logins**.
- **New comments**, excluding spam.
- **Email sending failures**, limited to one alert every 15 minutes.

Customize alert messages with supported placeholders, such as your site name, username or email subject.

### WooCommerce SMS alerts and order notifications ###

Keep your store team and customers informed about order activity.

- **Store alerts:** Receive SMS notifications for new orders, failed payments, cancellations and refunds.
- **Stock alerts:** Get notified about low stock, out-of-stock products and backorders.
- **Review alerts:** Receive a text when a new product review is submitted.
- **Customer order notifications:** Send SMS updates for processing, completed, refunded and cancelled orders.
- **Additional order updates:** Notify customers about other order status changes, including custom statuses, and customer-facing order notes.
- **Editable messages:** Personalize notifications with supported order, customer and product details.

Store and customer alerts require WooCommerce. All SMS alerts are off by default. Enable customer notifications only for customers who have consented to receive texts. Your SMS provider’s charges apply.

### Test emails and troubleshoot sending problems ###

Find configuration problems with built-in email tests and diagnostics.

- **Send a test email** through your live routing or a specific connection.
- **Test an SMS connection** using an international phone number.
- Check **primary and backup email routing**.
- Identify **missing connection details and conflicting email plugins**.
- Review sender settings and sender-domain **SPF and DMARC records**.
- Check **recent sending failures, logging, server requirements and scheduled tasks**.
- Follow relevant **troubleshooting hints** from the diagnostics screen.

DKIM verification is handled through your email provider’s dashboard.

### Privacy controls and local log storage ###

Control what VuloMail stores on your website.

- Keep email and SMS logs in **your own WordPress database**.
- Leave **message content storage** off, or enable it when needed.
- **Mask recipient details** in logs.
- Set **log retention** and delete entries.
- Store provider **passwords and API keys encrypted** in the database.
- Choose whether plugin data is **kept or removed when uninstalling**.

VuloMail makes no tracking calls and does not contact VuloLabs servers. Sending messages requires sharing the necessary message data with the providers you connect.

## Installation ##

1. Install and activate VuloMail.
2. Open Settings → Connections and add an email connection.
3. Set the connection as primary.
4. Configure a sender email address verified with your provider.
5. Send a test email from Tools.

You can then add a backup email connection, connect an SMS provider and enable the alerts you need.

Requires WordPress 6.4 or later and PHP 7.4 or later.

## Frequently Asked Questions ##

### What does VuloMail do? ###

VuloMail sends WordPress emails through your chosen SMTP or email API connection, records sending results and supports SMS notifications for website and WooCommerce activity.

### Can VuloMail help when WordPress is not sending emails? ###

Yes. Connect an email provider, set it as primary and send a test email. The diagnostics and logs help identify configuration problems and provider-reported errors.

### Which email providers are supported? ###

VuloMail supports SMTP, SendGrid, Mailgun, Brevo and Postmark. Other services can be connected through SMTP where their authentication requirements allow it.

### Does VuloMail work with WooCommerce and contact forms? ###

Yes. It handles emails sent through the standard WordPress wp_mail() function, including WooCommerce order emails and contact form notifications. Plugins that send directly through another service are not affected.

### What happens if my primary email connection fails? ###

VuloMail tries your configured backup connection. If enabled, the WordPress default mailer acts as a final fallback. Sending attempts appear together in one log entry.

### Does Sent mean the email reached the inbox? ###

No. Sent means the provider accepted the message. It does not confirm delivery to an inbox or phone.

### Which SMS providers can I connect? ###

Twilio, Vonage, Plivo and Clickatell. You need your own provider account, and provider charges apply.

### Can I send WooCommerce order notifications by SMS? ###

Yes. Enable supported customer order alerts and customize their messages. WooCommerce is required for store and customer alerts. All SMS alerts are off by default.

### Can I resend a logged message? ###

Yes, if its content was stored and its recipients were not masked. Resending uses your current routing settings.

### Where are logs stored? ###

Logs are stored in your own WordPress database. Message content storage is off by default. You can enable recipient masking and choose a retention period.

### Do I need a VuloLabs account? ###

No. VuloMail does not require a VuloLabs account or subscription. Connect your own email or SMS provider to send messages.

### Does activation change my email routing immediately? ###

No. Add an email connection and set it as primary to route WordPress emails through that connection.

### Will uninstalling delete my data? ###

Data is kept by default. You can choose Delete everything before deleting the plugin to remove its connections, settings and logs. Deactivation does not delete data.