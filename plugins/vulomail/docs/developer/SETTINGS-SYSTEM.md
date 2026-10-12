# Settings System

## 1. Storage

One option, `vulomail_settings`, managed by `VuloMail\Settings\Settings`.

`Settings::DEFAULTS` is the single list of valid keys. Every key has a default and a type, and anything not in it is dropped on save.

| Key | Default | Meaning |
|---|---|---|
| `email_enabled` | `true` | Route `wp_mail()` through VuloMail |
| `from_email`, `from_name` | `''` | Sender |
| `force_from_email`, `force_from_name` | `false` | Apply the sender even when a plugin sets its own |
| `email_primary`, `email_backup` | `''` | Connection ids |
| `fallback_to_default` | `true` | Hand a message to WordPress's mailer when every connection fails |
| `sms_enabled` | `true` | Allow SMS |
| `sms_primary`, `sms_backup` | `''` | Connection ids |
| `sms_country_code` | `''` | Digits; applied to national numbers |
| `sms_admin_phone` | `''` | Where admin alerts go |
| `sms_triggers` | `array()` | `{ alert id: { enabled, template } }` |
| `log_enabled` | `true` | Keep the delivery log |
| `log_content` | `false` | Store message bodies |
| `mask_recipients` | `false` | Mask recipients in the log |
| `log_retention_days` | `30` | 0 keeps forever; maximum 3650 |
| `keep_data_uninstall` | `keep_data` | or `delete_everything` |

Methods: `all()`, `get( $key )`, `update( array $input )`. `update()` merges, sanitizes per key (`sanitize()`), saves and returns the full settings.

Sanitization worth knowing: `from_name` has line breaks removed (header injection); connection-id slots go through `sanitize_key`; every key without a specific rule is cast to bool.

To add a setting: add it to `DEFAULTS`, add a `sanitize()` case unless it is a boolean, and add a field to a schema (below).

## 2. The settings screen

`src/pages/Settings.tsx` is zyra's `NavigatorComponent` (the sub-tab shell) plus zyra's `InputRenderer` (the auto-saving form), the same pair VuloPilot's Settings uses.

Sub-tabs are declared in `src/components/Settings/index.ts` as schemas:

```ts
{
	id: 'logging',
	headerTitle: 'Logging & Privacy',
	headerIcon: 'clock',
	submitUrl: 'settings',        // REST route InputRenderer saves to
	hideSettingHeader: true,
	groupBySections: true,        // section title on the left, fields on the right
	modal: [ /* fields */ ],
}
```

| Sub-tab | Schema id | Notes |
|---|---|---|
| Connections | `connections` | A `PanelComponent` (`pages/Connections.tsx`), not a generated form |
| Email | `email` | |
| SMS | `sms` | |
| Logging & Privacy | `logging` | |
| Data | `advanced` | What happens on uninstall |

The SMS Alerts screen (`pages/SmsAlerts.tsx`) uses the same `InputRenderer` with its own schema (`notificationsSchema`) on a submenu tab of its own.

Field types in use: `section`, `setting-row`, `text`, `email`, `number`, `choice-toggle`, `notice`.

### Autosave

There is no Save button. `InputRenderer` posts a moment after each change:

```json
POST /vulomail/v1/settings
{ "settingName": "logging", "setting": { ...this sub-tab's field values... } }
```

It also posts once when a sub-tab opens, with nothing changed.

## 3. Wire format

Field values are not always the stored settings, so the two ends convert.

**On/off settings** are `setting-row` toggles. One field holds several switches, and its value is keyed by each row's `valueKey`:

```json
"log_options": {
	"log_enabled":     { "enable": true },
	"log_content":     { "enable": false },
	"mask_recipients": { "enable": true }
}
```

The field key (`log_options`) is only a container; each `valueKey` is the real setting name.

**Alerts.** A group whose key starts with `sms_triggers` holds alerts' on/off state keyed by alert id. `sms_template_{id}` holds one alert's message template.

| Direction | Where | What |
|---|---|---|
| Stored → form | `toFormValue()` / `schemaValues()` in `src/pages/Settings.tsx` | Builds each field's value from the flat settings |
| Form → stored | `Rest\Settings::from_form_values()` | Unpacks toggle groups, alert groups and templates into flat settings |

`from_form_values()` only accepts an inner key that is a boolean in `DEFAULTS`, so a crafted request can't set arbitrary keys.

## 4. The REST endpoint

`POST /settings` accepts two shapes:

- the form shape above, answered with `{ success, message }`. `message` is empty when nothing changed, so opening a sub-tab doesn't announce a save. A validation problem is answered with HTTP 200 and `{ success: false, type: 'error', message }`, because the form has no error path of its own;
- a flat `{ key: value }` body, answered with the full settings, or a `WP_Error` (HTTP 400) on a validation problem. The Connections panel uses this for the routing slots.

Validation (`validate()`): `from_email` must be a valid address or empty; a routing slot must point at an existing connection of the matching channel.

## 5. Locked fields

A field with `dependentPlugin: [{ plugin, name, link }]` is locked by `InputRenderer` when `plugin` is not in `vulomailAppLocalizer.active_plugins`. Clicking it opens the component passed as `Popup` (`RequiredPluginPopup.tsx`) with that plugin. `FrontendScripts::localize_scripts()` lists `woocommerce` there when WooCommerce is active.
