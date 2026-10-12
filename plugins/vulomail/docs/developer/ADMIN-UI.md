# Admin UI

## 1. Stack

React 19 and TypeScript, built with `@wordpress/scripts` through the shared `tools/webpack/create-config.js`. Components come from the external `@multivendorx/zyra` package, imported through the aliases `@zyra/core`, `@zyra/components`, `@zyra/inputs` and `@zyra/table`. zyra injects its own styles at runtime.

`react`, `react-dom` and the `@wordpress/*` packages are externals supplied by WordPress.

Output: `assets/js/index.js`, `assets/js/vendors.js` (zyra and other dependencies), `assets/styles/index.css`.

`webpack.config.js` aliases `@react-pdf/renderer` to `false` and runs zyra through the `disable-remote-hosts` loader, as VuloPilot does, so the bundle loads nothing from another site.

## 2. Entry and routing

| File | Role |
|---|---|
| `src/index.tsx` | `configureZyra( vulomailAppLocalizer )`, then mounts `<App>` on `#admin-main-wrapper` |
| `src/app.tsx` | zyra's `HeaderComponent` plus the screen for the current tab |
| `src/routes.ts` | One entry per submenu tab: `tab`, `name`, `desc`, `component` |
| `src/searchIndex.ts` | What the header search can find |

Every admin URL is `admin.php?page=vulomail`; the screen is chosen by the hash: `#&tab=logs`, `#&tab=settings&subtab=email`. `classes/Admin.php` registers one submenu item per tab with the same hash, and `app.tsx` marks the matching item `current`.

`LEGACY_TABS` in `app.tsx` redirects old top-level tabs to their current address.

Adding a screen: add the component, add it to `routes.ts`, add the submenu entry in `Admin::add_menus()` (or through the `vulomail_submenus` filter).

## 3. Screens

| Tab | File | What it shows |
|---|---|---|
| `dashboard` | `pages/Dashboard.tsx` | Delivery totals for 7/30/90 days, channel status, recent failures as a day-grouped timeline, shortcuts |
| `logs` | `pages/Logs.tsx` | The delivery log table with channel switch, status pills, date range and search; a detail popup with resend and delete |
| `tools` | `pages/Tools.tsx` | Test email, test SMS, diagnostics |
| `sms-alerts` | `pages/SmsAlerts.tsx` | Every alert with its switch and message |
| `settings` | `pages/Settings.tsx` | Sub-tabs: Connections, Email, SMS, Logging & Privacy, Data |

`pages/Connections.tsx` and `pages/ConnectionForm.tsx` are the Connections sub-tab. The form is generated from the provider definitions in `vulomailAppLocalizer.providers`.

Deep links: `#&tab=logs&log=12` opens that log entry's detail popup; `#&tab=tools&connection={id}` preselects a connection in the test cards.

## 4. Data

`src/services/api.ts` is a thin axios client (`apiGet`, `apiPost`, `apiDelete`). Unlike zyra's `getApiResponse()`/`sendApiResponse()`, which resolve to `null` on any error, it rejects with the server's own message, so a failed save or test can say why.

The settings forms are the exception: zyra's `InputRenderer` saves them itself ([SETTINGS-SYSTEM](SETTINGS-SYSTEM.md)).

`src/services/notify.ts` shows a floating notice through zyra's `NoticeManager`.

### Localized data

`vulomailAppLocalizer`, typed in `src/global.d.ts`:

| Key | Content |
|---|---|
| `apiUrl`, `restUrl`, `nonce` | REST base, namespace, `wp_rest` nonce |
| `version`, `plugin_url`, `admin_url`, `site_url` | |
| `admin_email` | Prefills the test email recipient |
| `default_from` | WordPress's default sender address |
| `date_format_js` | The site's date format in zyra's token syntax |
| `providers` | Every provider definition (label, fields) |
| `sms_triggers` | Every alert definition |
| `active_plugins`, `plugins_url` | Which plugins a locked setting can depend on are active (WooCommerce), and where to get them |
| `khali_dabba`, `active_modules` | Read by zyra's shared components; always `false` and `[]` here |

## 5. Conventions

- **Dates are formatted on the server.** Show `created_at_display` (and friends) from the REST response; don't format in JavaScript ([LOGGING](LOGGING.md#5-dates)).
- **Untrusted text.** A logged subject, recipient or provider error is untrusted. Render it as a React child, or pass it through `escapeHtml()` when a zyra prop renders HTML. Message bodies go in a `<pre>`.
- **Styles.** `src/components/common.scss` holds layout glue only and uses zyra's CSS custom properties (`--color-primary`, `--text-color`, `--border-color` ...) rather than its own colours.
- **Booleans** in hand-built forms use `components/Switch.tsx`; in settings schemas use a `setting-row` toggle.
- **react-select and empty values.** zyra's `SelectInput` shows its placeholder for an option whose value is `''`. Give "none" options a real value.
- **Confirmation** uses a `PopupComponent`, not `window.confirm`.
- `HeaderComponent` always prints a "Pro: Not Installed" badge; `common.scss` hides it, because VuloMail has no Pro edition.

## 6. Checks

```bash
pnpm exec eslint plugins/vulomail/src --ext .ts,.tsx     # from the vulolabs/ root
pnpm exec stylelint "plugins/vulomail/src/**/*.scss"
pnpm run build                                           # from plugins/vulomail
```

`ts-loader` runs with `transpileOnly`, and the workspace has no React type definitions installed, so `tsc --noEmit` is not part of the workflow. ESLint and the build are the gates.
