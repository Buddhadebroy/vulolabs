# Conditional logic

Conditional logic changes a field depending on other answers. For example: show "Order number" only when the topic is "Problem with an order".

## Set it up

1. Select the field that should appear, disappear or become required.
2. In its settings, switch on **Conditional logic**. A first rule is added for you.
3. Under **This field is**, choose **Shown**, **Hidden** or **Required**.
4. Fill in the rule: the answer to look at, a comparison, and what to compare it with.
5. Select **+ Add another rule** for more. With more than one, choose whether **all** of them or **any** of them must be true.

A field with conditional logic shows a **Conditional** tag in the builder.

## Comparisons

| Comparison | Matches when the other answer |
| --- | --- |
| is | Equals the value. For checkboxes: the value is ticked. |
| is not | Does not equal the value |
| contains | Includes the text |
| does not contain | Does not include the text |
| is empty | Was left blank |
| is not empty | Has any answer |
| is greater than | Is a larger number |
| is less than | Is a smaller number |

For a dropdown, radio buttons or checkboxes, compare against the choice exactly as you wrote it.

## What happens to hidden fields

- A hidden field is never required, even if you ticked **Required**.
- If the visitor typed something and the field was then hidden, that answer is not saved or sent.

## Good to know

- Rules can only look at other fields, not at the field itself.
- If you delete a field that a rule depends on, the rule is removed when you save.
- Conditions are checked in the visitor's browser as they type and again on your server when the form is sent.
- Try your rules with **Preview** before publishing.

## Conditions on what happens after sending

The same kind of rules can decide what the form does once it is sent. These are set on the form's **Settings** tab, not on a field.

- **Notifications.** Open a notification, and under **When to send** switch on **Only for certain answers**. The notification is then sent only for submissions that meet its rules, so sales questions can go to one team and support questions to another. A notification that was skipped is listed as **Skipped** on the submission.
- **Webhooks.** The same switch on a webhook passes on only the submissions the other service should receive.
- **What visitors see.** Under **After submitting**, select **Add an exception** in the **Exceptions** section. Give it rules and its own message or page address. Visitors whose answers match see it instead of the usual message; when several exceptions match, the first is used, and everyone else sees the usual message.

A field hidden by its own conditional logic counts as empty in these rules. Rules about a field you later delete are removed when the form is saved.

