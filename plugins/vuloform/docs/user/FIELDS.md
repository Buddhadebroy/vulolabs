# Field types

## Questions

| Field | Use it for | Extra settings |
| --- | --- | --- |
| Short text | Short answers | Fewest and most characters |
| Long text | Longer messages | Fewest and most characters |
| Email | An email address. Checked for a valid format. | |
| Phone | A phone number | |
| Number | A quantity or amount | Smallest, largest, step |
| Website | A web address | |
| Dropdown | One choice from a list | Choices |
| Single choice | One choice, all visible | Choices |
| Multiple choice | Any number of choices | Choices |
| Consent | Agreement to something, such as being contacted. The help text is the sentence the visitor agrees to. | |
| Date | A date, with the browser's date picker | |
| Time | A time | |
| File upload | Documents or images | Allowed file types, largest size, number of files |

## Text and layout

| Field | Use it for |
| --- | --- |
| Heading | A title above a group of fields |
| Text block | A paragraph of explanation, with basic formatting |
| Divider | A line between sections |
| Page break | Starts a new step. The visitor sees **Next** and **Back** buttons and a step indicator. |

A page break cannot be the last field of a form.

## Special fields

| Field | Use it for |
| --- | --- |
| Name | First and last name as one field |
| Address | Street, city, state, postcode and country, as one field. Choose which parts to show. |
| Hidden value | A fixed value sent with every submission, such as a campaign name. Visitors do not see it. |
| Calculation | A number worked out from other answers, shown live to the visitor |

## Choices

For dropdowns, radio buttons and checkboxes, add one choice per row. A visitor can only submit a choice that is on your list.

## File uploads

You choose which file types are allowed from a fixed list of safe types: images, PDF, office documents, plain text, CSV, ZIP, MP3 and MP4. Programs and scripts can never be uploaded. Files are checked to make sure their content matches their type.

Uploaded files are stored privately. You download them from the submission; visitors get no link to them.

Your server also has its own upload size limit. If large files fail, ask your host to raise it.

## Calculations

Select the Calculation field and open **What to calculate**. Build the calculation with the buttons under it: your number fields by name, and plus, minus, times, divided by and brackets. You can also type it, with a field written as its name in curly brackets:

```
{quantity} * 25
({adults} * 40) + ({children} * 25)
```

Under the box, the calculation is said back in words, for example "Quantity × 25", so you can check it means what you intended. If something is wrong, such as a bracket that is not closed or a field that is not a number field, it says so there.

Only Number fields and other Calculation fields can be used. An empty field counts as 0. Choose how many digits to show after the point and, if you like, something to show before the result such as a currency symbol.

The result is worked out again on your server when the form is sent, so a visitor cannot change it.

## Filling a field in automatically

A field's starting value (and a **Hidden value** field's value) can be taken from where the form is shown and who is looking at it. Type one of these tags into the box, or select it under the box in the field's settings. A tag can be mixed with ordinary text.

| Tag | Becomes |
| --- | --- |
| `{query:utm_source}` | A value from the page address, here `?utm_source=newsletter`. Change the name after the colon to read any other one. |
| `{user:email}`, `{user:name}`, `{user:first_name}`, `{user:last_name}`, `{user:username}`, `{user:id}` | Details of the logged-in visitor. Empty for visitors who are not logged in. |
| `{page:title}`, `{page:url}`, `{page:id}` | The page the form is on. |
| `{site:name}`, `{site:url}` | This website. |
| `{date}` | Today's date, written as 2026-12-31. |

Typical uses: a hidden value of `{query:utm_source}` to see which campaign a lead came from, `{page:title}` to know which page a shared form was sent from, or an email field starting as `{user:email}` so members need not type it.

Things to know:

- Values from the page address work on cached pages and on forms shown on another website; the visitor's browser fills them in.
- On another website, the form cannot know who is logged in to this one, so `{user:…}` tags are empty there.
- These values are sent by the visitor's browser like any other answer, and a visitor can change them. Use them for convenience and tracking, not as proof of who someone is.

## Hidden fields are not secret

A hidden field is part of the page, and a technical visitor can change its value. Use it for tracking, not for anything that must be trusted.
