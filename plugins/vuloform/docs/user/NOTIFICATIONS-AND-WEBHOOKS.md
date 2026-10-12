# Notifications and webhooks

Both are set per form: open the form, then the **Settings** tab. Notifications have their own group; webhooks are under **Integrations**.

## Email notifications

Select **Add notification**. A form can have up to ten. A new notification starts with nobody to send to: the **To** box shows your site's admin address in grey as an example only. Until you type an address, the line reads "Not saved yet" and the notification is not saved with the form. Each one is a line in the list: click its name to rename it (only you see the name), select the line to open it, use its switch to turn it off without deleting it, and the bin to remove it.

| Setting | What to enter |
| --- | --- |
| Send as | Email, Text message, or Both. With Both, the email settings below apply to the email, and two more boxes appear for the text message: its number and its own short text. |
| To | One or more email addresses, separated by commas |
| Subject | The subject line |
| Message | The text. `{all_fields}` lists every answer. Select a placeholder under the box to add it. |
| Replies go to | Your email field, so that replying to the notification writes to the visitor |

### Placeholders

Put these in the subject, message or "Send to":

- `{all_fields}`: every answer, one per line
- `{form_title}` and `{site_name}`
- `{field_key}`: one answer, for example `{email}` or `{name}`. The available keys are listed under the message box.

### Confirmation to the person who filled in the form

Select **Add a confirmation to the visitor**. It creates a notification addressed to your form's Email field, with a message you can rewrite. If the form has no Email field yet, one is added to the form for you.

### How email is sent

VuloForm hands email to your site's mail system. If the **VuloMail** plugin is active, it goes through the connection you set up there, which is more reliable than a web host's default mail. Without VuloMail, WordPress sends it the standard way.

If notifications do not arrive, see [TROUBLESHOOTING.md](TROUBLESHOOTING.md).

## Text message (SMS) notifications

Choose **Text message** under **Send as** and enter a phone number in international format, for example `+14155550123`, or the key of a phone field.

Text messages need the **VuloMail** plugin with an SMS connection. Without it, the notification is skipped and the submission says so. Your SMS provider charges for each message.

## Integrations and webhooks

Open the form's **Settings**, then **Integrations**. Everything the form passes submissions on to is in this one list, added with the **Add integration** button.

A **custom connector** is a webhook: it sends each submission to another service the moment it arrives, for example a CRM, a spreadsheet tool or an automation service.

1. Select **Add integration**. If you are offered a choice, pick **Custom connector**.
2. Paste the address the other service gave you. It must start with `https://`.
3. Optionally enter a **signing secret**. The other service can use it to check that the data really came from your site.
4. Optionally tick the fields to send. With none ticked, every field is sent.

A form can have up to five custom connectors. Click a connector's name to rename it.

### Delivery

Webhooks are sent in the background, so visitors never wait for them. If the other service is down, VuloForm tries again after 5 minutes and once more after 30 minutes. Each attempt is listed on the submission.

Background tasks on WordPress run when someone visits the site. On a very quiet site a webhook can be delayed until the next visit.

### Not allowed

For safety, a webhook cannot be sent to an address on your own server or private network, or to a plain `http://` address.
