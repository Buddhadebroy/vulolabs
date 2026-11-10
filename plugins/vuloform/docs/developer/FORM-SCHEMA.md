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
| Basic | `text`, `textarea`, `email`, `phone`, `password`, `number`, `url`, `select`, `radio`, `checkboxes`, `consent`, `date`, `time`, `file` |
| Layout | `heading`, `html`, `divider`, `page_break` |
| Advanced | `name`, `address`, `hidden`, `calculation`, `signature`, `repeater` |

Type-specific keys: `minlength`/`maxlength` (text, textarea, password), `min`/`max`/`step` (number), `allowed_types`/`max_size_mb`/`max_files` (file; `signature` reuses this pipeline, fixed to a single PNG - see `Schema::sanitize_field()`'s `signature` case), `parts` (name, address), `formula`/`decimals`/`prefix` (calculation), `content` (html), `level` (heading).

`password` behaves exactly like `text` everywhere except the HTML control it renders (`type="password"`, `autocomplete="new-password"`) - it needed no new case in `Schema::sanitize_field()`, `Processor::clean()`/`validate()`, or the renderer's per-type switch, only entries in those methods' existing generic/shared branches.

### Repeater fields

`repeater` holds a configurable row of its own sub-fields, repeated `min_rows`..`max_rows` times (0-50, default 1-10):

```json
{ "type": "repeater", "key": "guests", "min_rows": 1, "max_rows": 10, "fields": [ { "id": "f_1", "key": "guest_name", "type": "text", "...": "..." } ] }
```

- A row's sub-fields are sanitized the same way top-level fields are (`Schema::sanitize_field()` calls itself recursively, with the row's own `$ids`/`$keys` namespace so a sub-field id never collides with a top-level one).
- A row cannot hold another `repeater` (no nesting), a `file`/`signature` (per-row uploads aren't wired into `Submissions\Processor`) or a `calculation` (no per-row formula scope) - these are silently dropped from `fields` on save, not reported as an error.
- `Processor::clean()`/`validate_repeater()` clean and validate each row's own sub-fields using their own type's rules, and enforce `min_rows`/`max_rows`; a row beyond `max_rows` in a submission is dropped, not an error.
- `Renderer::repeater()`/`repeater_row()` render `min_rows` (or one) static rows for the no-JavaScript case; `public/js/form.js`'s `setupRepeater()` adds the Add/Remove row behaviour, re-indexing each row's `name`/`id` attributes (`vf[key][N][subkey]`, `id__N__subid`) as rows are added or removed.
- `Schema::issues()` reports a repeater with an empty `fields` array as unpublishable.

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

`Forms\Templates::all()` returns 28 ready-made schemas (contact, general inquiry, lead generation, newsletter signup, feedback, survey, event registration, job application, support request, order/quote inquiry, donation, customer complaint, event feedback, home service request, restaurant reservation, RSVP, registration, appointment booking, order, volunteer sign-up, course enrollment, real estate inquiry, medical history, travel booking, return/RMA, course evaluation, conference registration, fitness class registration), each with an admin notification. `Templates::show_if( $field, $value )` builds the repeated "show this field only when another field's answer is X" conditions shape used by several of them (lead's Company field, the donation/RSVP templates' conditional fields).

The `vuloform_templates` filter adds more - VuloForm Pro's Payments module registers two of its own this way (a donation and an order form that use the Payments extension's `amount_field`), gated on nothing: the template itself is always offered, and is simply inert (the payment doesn't process) until the module is switched on and a provider is connected, the same "keep what it cannot interpret" rule as any other extension setting. See [EXTENSIONS.md](EXTENSIONS.md) and VuloForm Pro's own `docs/developer/PAYMENTS.md` (separate repo/plugin).

A unit test asserts that every template can be published as it is.
