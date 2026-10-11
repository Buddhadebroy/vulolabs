# Admin UI

## 1. Stack

React 19 and TypeScript, built with `@wordpress/scripts` through the shared `tools/webpack/create-config.js`. Components come from the external `@multivendorx/zyra` package, imported through the aliases `@zyra/core`, `@zyra/components`, `@zyra/inputs` and `@zyra/table`. zyra injects its own styles at runtime.

`react`, `react-dom` and the `@wordpress/*` packages are externals supplied by WordPress.

Output: `assets/js/index.js`, `assets/js/vendors.js` (zyra and other dependencies), `assets/styles/index.css`.

`webpack.config.js` aliases `@react-pdf/renderer` to `false` and runs zyra through the `disable-remote-hosts` loader, as VuloPilot does, so the bundle loads nothing from another site.

## 2. Entry and routing

| File | Role |
|---|---|
| `src/index.tsx` | `configureZyra( vulobackupAppLocalizer )`, then mounts `<App>` on `#admin-main-wrapper` |
| `src/app.tsx` | `JobProvider`, zyra's `HeaderComponent`, and the screen for the current tab |
| `src/routes.ts` | One entry per submenu tab: `tab`, `name`, `desc`, `icon`, `component` |
| `src/searchIndex.ts` | What the header search can find: tabs and settings sub-tabs |

Every admin URL is `admin.php?page=vulobackup`; the screen is chosen by the hash: `#&tab=backups`, `#&tab=settings&subtab=storage`. `classes/Admin.php` registers one submenu item per tab with the same hash, and `app.tsx` marks the matching item `current`.

Adding a screen: add the component, add it to `routes.ts`, add the submenu entry in `Admin::add_menus()`.

## 3. Screens

| Tab | File | What it shows |
|---|---|---|
| `overview` | `pages/Overview.tsx` | Warnings, four tiles, the last backup, where backups are kept, recent activity |
| `backups` | `pages/Backups.tsx` | The table with status pills and search; the details popup (verify, download, restore, delete); the import popup |
| `restore` | `pages/Restore.tsx` | The wizard for one backup, or the list of restorable backups and past restores |
| `diagnostics` | `pages/Diagnostics.tsx` | Server checks, system information, the activity log |
| `settings` | `pages/Settings.tsx` | Sub-tabs ([SETTINGS-SYSTEM](SETTINGS-SYSTEM.md#3-the-settings-screen)) |

Shared: `components/JobBanner.tsx` (progress and result), `components/CreateBackup.tsx` (the "Back up now" popup).

Deep links: `#&tab=backups&backup={id}` opens that backup's details; `#&tab=restore&backup={id}` opens the wizard for it.

## 4. Data

`src/services/api.ts` is a thin axios client (`apiGet`, `apiPost`, `apiDelete`). Unlike zyra's `getApiResponse()`/`sendApiResponse()`, which resolve to `null` on any error, it rejects with the server's own message, so a failed action can say why.

`src/services/notify.ts` shows floating notices through zyra's `NoticeManager`.

`vulobackupAppLocalizer` (`FrontendScripts::localize_scripts()`, typed in `src/global.d.ts`) carries the REST address and nonce, `areas` (the folders that exist on this site) and `chunk_bytes` (the largest upload piece the server accepts). It carries no credential and no server path.

Dates and sizes arrive display-ready from the server (`created_at_display`, `size_display`), formatted with WordPress's own settings.

## 5. The running job

`src/services/JobContext.tsx` (`JobProvider`, `useJob()`):

- `kick()` starts a loop that posts `jobs/run` and stores the answer, until there is no job or it is final. It is called on mount and after anything that starts or cancels a job.
- `job` is the running job; `finished` the one that just ended; `finishedCount` goes up each time, and lists reload on it.
- If the job vanished between slices (WP-Cron finished it), the final state is fetched.
- If a request fails while a restore is at its last step, `sessionLost` is set: the database, and the session with it, has been replaced. The banner then offers to sign in again.

## 6. Importing

`Backups.tsx` cuts the chosen file into pieces of `chunk_bytes` and posts them in order to `backups/import` with `offset`, `total`, the `upload` id from the first answer, and `last` on the final piece. The server only appends a piece that starts exactly where the file ends.

## 7. Downloading

A plain navigation to `backups/{id}/download?_wpnonce=…`. The REST cookie check accepts the nonce in the address, and the response is streamed as an attachment.

## 8. Buttons and styles

In zyra a button with no `color` is the solid primary one; `color: 'purple'` is the light secondary one; `border-red` and `red` are for destructive actions. Each group of buttons has one primary.

`src/components/common.scss` holds only layout glue, using zyra's design tokens (`--color-primary`, `--border-color`, …). It declares no colours of its own apart from warning and error text in logs.

The logo is `src/assets/images/brand-logo.svg`.
