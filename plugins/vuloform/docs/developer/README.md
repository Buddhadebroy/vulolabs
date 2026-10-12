# VuloForm developer documentation

VuloForm is a standalone form builder for WordPress. It needs no other plugin, no account and no build step on the public site.

| Document | What it covers |
| --- | --- |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Bootstrap, the service container, folder layout, request flow |
| [FORM-SCHEMA.md](FORM-SCHEMA.md) | The versioned form schema, field types, conditions, calculations |
| [SUBMISSIONS.md](SUBMISSIONS.md) | The processing pipeline, spam protection, file uploads, retention |
| [NOTIFICATIONS-AND-WEBHOOKS.md](NOTIFICATIONS-AND-WEBHOOKS.md) | Email, SMS through VuloMail, webhook delivery and retries |
| [FRONTEND-AND-EMBED.md](FRONTEND-AND-EMBED.md) | Rendering, the block, the shortcode, the script for other sites |
| [REST-API.md](REST-API.md) | Every route, who may call it, what it returns |
| [HOOKS.md](HOOKS.md) | Actions, filters and public functions for integrations |
| [EXTENSIONS.md](EXTENSIONS.md) | Modules, per-form extension settings and admin-app slots, as used by VuloForm Pro |
| [DATABASE.md](DATABASE.md) | Tables, options, uploads folder, migrations, uninstall |
| [SECURITY-AND-PRIVACY.md](SECURITY-AND-PRIVACY.md) | Threats considered and how each is handled |
| [ADMIN-UI.md](ADMIN-UI.md) | The React admin app and the builder |
| [TESTING.md](TESTING.md) | Unit tests, how to run them, what is not covered |

## Quick facts

- Namespace `VuloForm\`, PSR-4 from `classes/`. Global accessor `VuloForm()`.
- Text domain `vuloform`. Hooks are prefixed `vuloform_`.
- REST namespace `vuloform/v1` (`VuloForm()->rest_namespace`).
- Admin capability: `manage_options` (`Utill::CAPABILITY`).
- PHP 7.4+, WordPress 6.4+.
- The public form uses plain JavaScript (`public/js/form.js`); React is only loaded in wp-admin.

## Commands

Run from `plugins/vuloform`:

```bash
pnpm run build          # admin bundle, block, public script and styles
pnpm run watch          # rebuild on change
vendor/bin/phpunit      # unit tests
composer run-script phpcs
pnpm run build:zip      # release zip in release/
```
