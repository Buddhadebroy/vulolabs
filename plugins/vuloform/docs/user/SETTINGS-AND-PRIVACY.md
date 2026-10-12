# Settings and privacy

## Site-wide settings

**VuloForm > Settings** has three sub-tabs: **Privacy** (the first two settings below), **Spam protection** (the visitor limit, the minimum fill time, the hidden trap field and the Google reCAPTCHA keys) and **Data** (what happens when VuloForm is deleted). Changes save by themselves.

| Setting | What it does | Default |
| --- | --- | --- |
| Keep submissions for | Submissions older than this many days are deleted automatically, with their files. 0 keeps them until you delete them. | 0 |
| Store the visitor's IP address | Saves the address with each submission. An IP address is personal data; only switch this on if you have a reason. | Off |
| Submissions allowed from one visitor | Per form, per minute. Further attempts in the same minute are refused. 0 switches the limit off. | 5 |
| When VuloForm is deleted | **Keep data** leaves forms and submissions in place for a reinstall. **Delete everything** removes forms, submissions and uploaded files. | Keep data |

Deactivating the plugin never deletes anything.

## Spam protection

Every form is protected by three checks that need no CAPTCHA and send no visitor data to another company:

- **Hidden trap field.** Invisible to people, filled in by many bots.
- **Minimum fill time.** A form sent faster than a person could fill it in is treated as spam. 0 switches the check off.
- **Rate limit.** How many submissions one visitor may send to one form per minute.

All three are set once, under **VuloForm > Settings > Spam protection**, and apply to every form.

Caught submissions go to the **Spam** list and trigger no notifications.

### Google reCAPTCHA (optional)

For a form that still gets spam, you can add Google reCAPTCHA on top.

1. Create a site key and a secret key at [google.com/recaptcha/admin](https://www.google.com/recaptcha/admin). Choose **v2 checkbox** (visitors tick "I'm not a robot") or **v3** (invisible, scores each visitor). Keys only work for the version they were created for.
2. Under **VuloForm > Settings > Google reCAPTCHA**, choose the same version and paste both keys. The secret key is kept on the server and is not shown again.
3. In each form that should use it, open the form and switch on **Google reCAPTCHA** under its fields, on the **Fields** tab.

Things to know:

- A form with reCAPTCHA loads a script from Google for everyone who opens it, and Google receives information about the visitor's device and behaviour. Forms without it load nothing from Google. Mention this in your privacy policy; the Policy guide suggests wording once the keys are saved.
- The visitor's IP address is not sent to Google by VuloForm's server when it checks an answer.
- reCAPTCHA needs JavaScript. A visitor without it is told the form cannot be sent.
- With v3, a submission scoring below the strictness you chose goes to the **Spam** list; the sender is not told.
- If Google cannot be reached when a form is sent, the submission is accepted and the three checks above still apply.
- A form shown on another website needs that website's address added to the key's allowed domains in the Google admin console.

## Privacy tools

VuloForm works with WordPress's own privacy tools:

- **Tools > Export Personal Data** includes a person's form submissions.
- **Tools > Erase Personal Data** deletes them, with their uploaded files.
- **Settings > Privacy > Policy guide** contains suggested text about forms for your privacy policy.

A submission belongs to a person when their email address appears in it, or when they were logged in while sending it.

## What VuloForm does not do

- It does not send your data or your visitors' data to VuloLabs or anyone else. The only outgoing messages are the emails, texts and webhooks you set up, and the reCAPTCHA check with Google if you switch that on.
- It does not make your site compliant with GDPR or any other law by itself. It gives you the tools: consent fields, retention, export and erasure. How you use them is your responsibility.

## Consent

Add a **Consent** field, write what the visitor agrees to in its help text and make it required. The answer is stored with the submission.
