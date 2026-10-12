# Building forms

Open **VuloForm > Forms** and select **Edit** next to a form.

## The three parts of the builder

- **Left: field library.** Every field type you can add, in three groups: basic, layout and advanced.
- **Middle: your form.** The fields in the order visitors will see them.
- **Right: field settings.** Settings of the field you selected.

On a narrow screen the three parts are stacked one under the other.

## Adding fields

- Drag a field type from the library and drop it where you want it, or
- click a field type to add it to the end of the form.

## Arranging fields

- Drag a field by the dotted handle on its left.
- Or use the up and down arrows on the field. These work with the keyboard too.

## Copying and removing

- The copy icon duplicates a field with all its settings.
- The bin icon removes it. If you remove one by mistake, select **Undo**.

## Undo and redo

The **Undo** and **Redo** arrows at the top step backwards and forwards through your changes since you opened the form.

## Field settings

Select a field to see its settings on the right. **Required** is at the top by itself: the form cannot be sent while a required field is empty. The rest is in groups you open and close:

| Group | Setting | What it does |
| --- | --- | --- |
| Label and hints | Field label | The question or name shown above the field |
| | Example inside the field | Grey sample text that disappears when the visitor starts typing |
| | Hint under the field | Extra guidance, such as the format you expect |
| | Pre-filled answer | Already in the field when the form opens; visitors can change it |
| Answer limits | Shortest / longest answer, lowest / highest number | Limits on what can be entered |
| Layout | Field width | Full, two thirds, half or a third. Narrower fields sit side by side on wide screens and stack on phones. |
| | Hide the field label | Hides the label visually. Screen readers still read it. |
| Conditional logic | | Show, hide or require the field depending on other answers |
| For developers | Name in emails and exports | The short name of this answer, used as a placeholder such as `{email}` |
| | CSS class | For your own stylesheet |

Changing a field's name in emails and exports later breaks any placeholder that uses the old name, so set it once.

Some field types have extra settings; see [FIELDS.md](FIELDS.md).

## Form settings

The **Settings** tab of the form is split into groups; choose one from the row of tabs at the top:

- **Notifications:** who gets an email or text for each submission. See [NOTIFICATIONS-AND-WEBHOOKS.md](NOTIFICATIONS-AND-WEBHOOKS.md).
- **After submitting:** what visitors see once the form is sent: a message, or another page. The message may include answers, for example `Thanks {name}!`. Under **Keep a copy**, switch off **Save submissions on this site** if you only want the email and nothing stored.
- **Appearance:** the design, the wording of the buttons and the error messages. The Next and Back buttons and the step indicator appear here once the form has a Page break. Design covers label position, spacing, accent colour, text colour, text size, corner roundness and button alignment. Leave a value empty and the form follows your theme.
- **Spam protection:** see [SETTINGS-AND-PRIVACY.md](SETTINGS-AND-PRIVACY.md).
- **Integrations:** send submissions to other services with webhooks. See [NOTIFICATIONS-AND-WEBHOOKS.md](NOTIFICATIONS-AND-WEBHOOKS.md). (VuloForm Pro adds ready-made connections to mailing lists and CRMs here.)

If a form saves nothing and has no notification or webhook switched on, a warning at the top says that submissions would be lost.

## Saving

Your changes save by themselves, a moment after you make them: the builder says **Saving…** and then **Saved** next to the form's name. There is no Save button. If you move to another VuloForm screen straight after a change, it is saved on the way out.

- A **draft** is saved as a draft. Select **Publish** when it is ready for visitors. If something would stop the form from working, VuloForm lists what to fix, each with a link to the place, and keeps the form a draft.
- A **published** form is live, so each change reaches visitors as soon as it is saved. To work on a larger change in private, select **Unpublish** first, or duplicate the form and edit the copy.

## Copying a form to another site

On the **Share** tab, **Download form (.json)** saves the fields and settings to a file. On the other site choose **New form > Import a form (.json)**. Submissions are not included.
