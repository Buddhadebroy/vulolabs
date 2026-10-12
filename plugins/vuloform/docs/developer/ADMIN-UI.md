# Admin UI

One React 19 app, mounted by `src/index.tsx`, using the shared `@multivendorx/zyra` component kit like the other VuloLabs plugins. Screens are hash tabs of one WordPress page: `admin.php?page=vuloform#&tab=forms`.

| Tab | Component |
| --- | --- |
| `forms` | `pages/Forms.tsx`: list, new form (templates, import), duplicate, delete |
| `forms` + `&form={id}` | `builder/Builder.tsx` |
| `submissions` | `pages/Submissions.tsx` |
| `settings` | `pages/Settings.tsx`: zyra's navigator with sub-tabs Privacy, Spam protection and Data (each a slice of one schema, saved on change), then extension sub-tabs |

PHP passes data through the `vuloformAppLocalizer` global (`FrontendScripts`): REST URL and nonce, field type definitions, templates, default settings, allowed file types and whether VuloMail SMS is available.

## Builder

```
Builder.tsx        state, undo/redo, save, preview, tabs
  Canvas.tsx       field library (left) + form (middle), drag and drop
  Inspector.tsx    settings of the selected field (right)
  FormSettings.tsx the Settings tab: groups as sub-tabs, each a panel of sections
  Share.tsx        shortcode, embed snippet, export
  fields.ts        helpers: create, duplicate, unique keys
```

- **State** is one snapshot `{ title, fields, settings }`. Every change goes through `commit()`, which pushes the previous snapshot on the undo stack. Typing is coalesced so one word is one undo step.
- **Drag and drop** uses `react-sortablejs`: the library is a clone source, the form is a sortable list with a drag handle.
- **Keyboard and pointer alternatives**: clicking a library item appends the field; each field has move up, move down, duplicate and delete buttons.
- **Autosave**: `persist()` posts the snapshot 1.5 seconds after the last change (10 seconds after a failed attempt), and again when the builder unmounts with changes pending. Without a `status` the server keeps the form a draft or published as it was. If nothing changed while it was saving, the server's copy replaces local state, so the builder shows the sanitized result; otherwise what is on screen is kept and saved again. Publish and Unpublish call the same function with a status.
- **Preview** sends the unsaved schema to `POST forms/preview` and runs the real public script on the returned HTML. Nothing is submitted.
- "Unsaved" is worked out by comparing the snapshot with what the server last returned. Problems are shown for a published form, and for a draft once publishing was tried. Closing the browser tab with a save pending triggers the browser's confirmation.

## The form's Settings tab

Groups are sub-tabs, in the order people need them: Notifications, After submitting (id `confirmation`), Appearance, Integrations (the webhooks, plus whatever extensions place there), then one per extension. Spam protection is not a group: the trap field, fill time and rate limit are site settings (`pages/Settings.tsx`), and a form's only spam setting, `settings.spam.recaptcha`, is the switch under its fields on the Fields tab (`Canvas`'s `footer`, filled in by `Builder.tsx`). The open tab and group are kept in the URL (`builder/route.ts`: `&subtab=settings&section=integrations`). A notification or webhook is a collapsible line (`Item` in `FormSettings.tsx`); `Segmented` in `components/Section.tsx` is used for choices between a few options. Each group is a panel of sections in the layout the other VuloLabs settings screens use (title and explanation on the left, settings on the right), built from `components/Section.tsx` (`Sections`, `Section`, `Row`, `Wide`) with zyra's own class names, and `components/Switch.tsx` for on/off settings. A notification or a webhook is one section each.

## Conventions

- No type-check step: ESLint and the webpack build are the gates.
- No new state library. Fetching uses the small helpers in `services/api.ts`.
- Layout lives in `components/common.scss`; colours and spacing come from zyra's CSS custom properties.
