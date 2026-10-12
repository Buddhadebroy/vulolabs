# Extensions

VuloForm is complete by itself. Everything here exists so that a separate plugin, such as VuloForm Pro, can add features without VuloForm knowing about them, and can be removed again without damage.

## Modules

`VuloForm\Modules` loads modules that other plugins offer. VuloForm ships none.

```php
add_filter( 'vuloform_module_sources', function ( $sources ) {
	$sources[] = array( 'path' => __DIR__ . '/modules', 'namespace' => 'MyPlugin' );
	return $sources;
} );
```

Register the filter when your plugin file loads: VuloForm reads it on `plugins_loaded`, before `vuloform_loaded` fires.

- A module is a folder with a `Module.php` defining `{Namespace}\{Folder}\Module`. Its id is the folder name in kebab case (`CrmSync` is `crm-sync`).
- The ids that are switched on are stored in the `vuloform_active_modules` option and toggled with `POST vuloform/v1/modules`.
- A stored id whose module is not currently offered is ignored, not removed. When the source comes back (a license is renewed, a plugin reactivated), the module loads again without anyone switching it on.
- A module that throws while starting is logged and skipped. Forms keep working.
- `vuloform_activated_module_{id}` fires with the instance when a module has started.

## Per-form extension settings

A form's `settings.extensions` is a map of extension id to that extension's settings for the form:

```json
{ "extensions": { "payments": { "enabled": true, "needs_module": true, "amount": "20.00" } } }
```

- VuloForm keeps every entry, deep-cleaned, whether or not its extension is active. An active extension validates its own entry on the `vuloform_form_extensions` filter.
- **`needs_module`**: when an entry has both `enabled` and `needs_module` true and no active module has that id, the form refuses submissions ("This form is temporarily unavailable") and `Schema::problems()` reports it. Use it when accepting a submission without the extension would be wrong, such as a form that should take a payment.
- `vuloform_form_problems` lets an extension block publishing for its own reasons.

## Fields of extension types

A type added with `vuloform_field_types` is treated like any other. Its own settings are kept through `vuloform_sanitize_field`; it is drawn through `vuloform_render_field` and validated through `vuloform_validate_field`.

When the extension is gone, fields of its types stay in the form definition with all their settings. They are not rendered, collect nothing, and the builder shows them as needing an extension. Rules in other fields that depend on them are kept.

## Changing what happens on submit

| Filter | Use |
| --- | --- |
| `vuloform_refuse_submission` | Refuse before anything is checked or stored. Return a message. |
| `vuloform_submission_result` | Change the confirmation message or `redirect` of an accepted submission, for example to a payment page. Only `success`, `message`, `errors`, `redirect` and `submission_id` are read back. Not applied to spam. |

`Frontend::result_url( $page_url, $form_id, $success, $message )` returns an address that shows a message in place of the form on its own page. An extension that sends the visitor away and back uses it for the return.

`SubmissionRepository::add_event( $id, $event )` adds a line to a submission's log. For a type VuloForm does not know, give `label`, `status_label` and `color` and the submission detail shows them as they are.

## Admin app slots

The admin app reads these `@wordpress/hooks` filters when it renders (`src/services/slots.ts`). Each receives an array and returns it with entries added.

| Filter | Adds | Entry |
| --- | --- | --- |
| `vuloform_admin_tabs` | A top-level screen at `#&tab={tab}` | `tab`, `name`, `desc`, `Component` |
| `vuloform_settings_tabs` | A sub-tab under Settings | `id`, `title`, `desc`, `icon`, `Component` |
| `vuloform_form_settings_sections` | A group (sub-tab) on a form's Settings tab, or a block inside its Integrations group | `id`, `title`, `icon`, `placement?`, `connectors?`, `add?`, `Component({ ui, value, onChange, settings, fields })` |
| `vuloform_inspector_sections` | A section in a field's settings | `id`, `applies(field)`, `Component({ field, fields, onChange })` |

For a form-settings section, `id` is the extension id: `value` is `settings.extensions[id]` and `onChange` writes it back, so it takes part in undo, redo and save like everything else in the builder. `ui` holds the layout pieces the built-in groups are made of (`Section`, `Row`, `Wide`, `Switch`, `Segmented` from `src/components/`, and `Item`, the collapsible line notifications and webhooks use); render with those and the group looks like the rest of the tab.

With `placement: 'integrations'` the section gets no sub-tab of its own: it is drawn inside the form's **Integrations** group, which is where a connection to another service belongs. That group has a single **Add integration** button, so such a section does not draw its own: it lists what can be added in `connectors` (`{ id, label, desc, icon? }[]`) and returns the new stored value from `add( connector, value, fields )`. VuloForm shows the choices next to its own **Custom connector** (the webhook), saves what `add` returns under `settings.extensions.{id}`, and the section's `Component` draws the items already added. Keep its entries in an `items` array in its value; the number on the Integrations tab is the webhooks plus those.

An extension's script must depend on `vuloform-admin-script` so it loads after it. The app mounts on `DOMContentLoaded`, by which time the extension has registered. For a top-level tab, also add the submenu entry with the PHP filter `vuloform_submenus`.

`window.vuloform` gives extension scripts `apiGet`, `apiPost`, `apiDelete`, `notify` and `errorMessage`. Use these rather than a second copy of the notice component: the notice receiver is mounted in VuloForm's app.

`vuloform_localize_data` (PHP) adds to the `vuloformAppLocalizer` object.
