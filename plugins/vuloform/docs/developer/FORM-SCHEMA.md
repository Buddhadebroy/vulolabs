# Form schema

A form is one row in `{prefix}vuloform_forms`. Its fields and settings are a JSON document in the `form_schema` column:

```json
{
  "version": 1,
  "fields": [ { "id": "f_ab12cd34", "key": "email", "type": "email", "label": "Email", "required": true, "...": "..." } ],
  "settings": { "submit_label": "Submit", "confirmation": {}, "notifications": [], "webhooks": [], "spam": {}, "style": {}, "messages": {} }
}
```

`version` is `VULOFORM_SCHEMA_VERSION`. `Forms\Schema::upgrade()` runs every time a form is read and fills in settings that were added after the form was saved, so old forms keep working without a migration.

## Nothing is stored unsanitized

`Schema::sanitize()` does not filter the input: it builds a new schema and copies over only what it recognises, each value sanitized for its purpose. An imported or hand-edited file therefore cannot add unknown keys, unknown field types or markup outside the HTML field (which goes through `wp_kses_post`).

Two things are kept without being understood, so that an extension's data survives while the extension is not running: fields whose type is unknown, and `settings.extensions`. Both are deep-cleaned (plain data, bounded depth and size, strings through `wp_kses_post`) rather than interpreted. An unknown field is never rendered and collects nothing. See [EXTENSIONS.md](EXTENSIONS.md).

`Schema::problems()` lists what stops a form being published: no input field, a choice field with no choices, an invalid formula, a page break in last position, an enabled webhook without an `https://` address, an enabled notification with no recipient. A form with problems is still saved, as a draft.

## Fields

Every field has `id`, `key`, `type`, `label`, `description`, `placeholder`, `required`, `default`, `width` (100, 66, 50 or 33), `css_class`, `hide_label`, `options` and `conditions`.

- `id` is stable and unique in the form (`f_` + 8 characters). The public HTML and validation errors use it.
- `key` names the answer in stored submissions, placeholders, CSV columns and webhook payloads. It is unique in the form; a clash gets a numeric suffix.

`Fields\Registry` defines the types and which settings each supports:

| Group | Types |
| --- | --- |
| Basic | `text`, `textarea`, `email`, `phone`, `number`, `url`, `select`, `radio`, `checkboxes`, `consent`, `date`, `time`, `file` |
| Layout | `heading`, `html`, `divider`, `page_break` |
| Advanced | `name`, `address`, `hidden`, `calculation` |

Type-specific keys: `minlength`/`maxlength` (text, textarea), `min`/`max`/`step` (number), `allowed_types`/`max_size_mb`/`max_files` (file), `parts` (name, address), `formula`/`decimals`/`prefix` (calculation), `content` (html), `level` (heading).

Add a type with the `vuloform_field_types` filter and render it with `vuloform_render_field`; see [HOOKS.md](HOOKS.md).

## Conditions

```json
{ "enabled": true, "action": "show", "match": "all", "rules": [ { "field": "topic", "operator": "is", "value": "support" } ] }
```

- `action`: `show`, `hide` or `require`.
- `match`: `all` or `any`.
- `operator`: `is`, `is_not`, `contains`, `not_contains`, `empty`, `not_empty`, `gt`, `lt`.

`Forms\Conditions` evaluates them on the server; `public/js/form.js` holds the same logic for the browser. A rule that points at a missing field or at the field itself is removed when the form is saved. A hidden field is never required and its value is never stored.

## Calculations

A formula is arithmetic over numbers and `{field_key}` placeholders: `+ - * /`, parentheses and unary minus. `Forms\Calculator` parses it with the shunting-yard algorithm. It never uses `eval`. A missing or non-numeric field counts as 0, division by zero gives 0, and an invalid formula evaluates to `null`.

The server recomputes every calculation from the validated values; whatever the browser posts for a calculation field is ignored.

## Templates

`Forms\Templates::all()` returns ten ready-made schemas (contact, inquiry, lead, newsletter, feedback, survey, event, job application, support, quote), each with an admin notification. The `vuloform_templates` filter adds more. A unit test asserts that every template can be published as it is.
