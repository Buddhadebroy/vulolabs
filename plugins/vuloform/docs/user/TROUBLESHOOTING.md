# Troubleshooting

## The form does not appear on the page

- Is the form **Published**? Drafts show nothing to visitors. Logged-in editors see a short notice instead.
- Check the number in the shortcode against the form: open the form's **Share** tab and copy it again.
- If the form was deleted, the block or shortcode shows nothing.

## I cannot publish

VuloForm lists what is wrong above the builder. Typical causes: a dropdown, radio or checkbox field without choices; a calculation with a mistake in its formula; a page break as the last field; a webhook without an `https://` address; a notification without a recipient; no field for visitors to fill in.

## "This form has expired. Please reload the page and try again."

The page was open for more than a day, or a caching plugin served a very old copy and JavaScript is blocked. Reloading fixes it.

## "You are sending messages too quickly."

The rate limit was reached. Wait a minute. If real visitors hit it, raise **Submissions allowed from one visitor** in Settings. If your site is behind a proxy or CDN that hides visitor addresses from WordPress, all visitors may be counted as one; ask your host to pass on the real address.

## A real submission landed in Spam

The form was sent faster than the **minimum fill time**. Lower it under **VuloForm > Settings > Spam protection**. Mark the submission **Not spam** to move it to the inbox.

## Notification emails do not arrive

1. Open the submission. Does the notification say **Handed off**? Then VuloForm passed it on and the problem is delivery: check the spam folder, then your site's email setup. Web hosts' default mail is often unreliable; the VuloMail plugin or another SMTP plugin fixes that.
2. Does it say **Skipped**? The "To" address is missing or invalid. If you used a placeholder such as `{email}`, check that it matches the field's "Name in emails and exports" exactly.
3. Is there no line at all? The notification is switched off, or the submission was spam.

## Text messages are skipped

SMS needs the VuloMail plugin with a working SMS connection.

## A webhook failed

Open the submission to see the reason.

- **"That address is not allowed"**: the URL points to a private or local address, or its domain does not exist.
- **"The endpoint answered HTTP 4xx"**: the other service rejected the request. Check the URL and what that service expects. This is not retried.
- **"The endpoint answered HTTP 5xx"** or a timeout: the other service had a problem. VuloForm retries twice.
- Nothing listed yet: background tasks run on visits to your site. Visit any page and look again.

## A file upload is refused

- The type is not one you allowed for that field.
- The file is larger than the field's limit, or than your server's own upload limit.
- The file's content does not match its extension, for example a renamed file.

## The embedded form does not show on another site

- Open your browser's developer console on that page. A Content Security Policy error means that site must allow your WordPress site's address.
- Make sure your WordPress site is reachable from the internet and uses `https`.
- A security plugin or firewall that blocks the WordPress REST API also blocks embedded forms.

## The form looks different from my theme

The form inherits fonts and colours from your theme. Set an accent colour, text size and corner roundness in the form's **Settings > Design**, or add your own CSS using the form's CSS class.
