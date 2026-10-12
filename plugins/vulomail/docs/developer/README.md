# VuloMail Developer Documentation

Code-level documentation for developers who extend or maintain VuloMail. End-user guides are in [../user](../user/README.md).

## Start here

1. [ARCHITECTURE](ARCHITECTURE.md) - bootstrap, container, the delivery pipeline, hooks, REST, React.
2. [INTEGRATION-API](INTEGRATION-API.md) - the supported public surface: functions, hooks, provider interfaces.
3. [REST-API](REST-API.md) - every route.
4. [DATABASE](DATABASE.md) - the log table and the options.

## By area

| Area | Document | Covers |
|---|---|---|
| Email | [EMAIL-DELIVERY](EMAIL-DELIVERY.md) | `wp_mail()` interception, message parsing, dispatch, failover, provider adapters |
| SMS | [SMS-AND-ALERTS](SMS-AND-ALERTS.md) | Dispatch, phone numbers, gateway adapters, alert triggers |
| Connections | [CONNECTIONS-AND-SECURITY](CONNECTIONS-AND-SECURITY.md) | Provider registry, saved connections, encryption, HTTP client, redaction |
| Logging | [LOGGING](LOGGING.md) | What a log row holds, privacy rules, retention, date formatting |
| Settings | [SETTINGS-SYSTEM](SETTINGS-SYSTEM.md) | The settings option, validation, the auto-saving form and its wire format |
| Admin app | [ADMIN-UI](ADMIN-UI.md) | React structure, routing, screens, zyra usage, header search |
| Diagnostics | [DIAGNOSTICS](DIAGNOSTICS.md) | The checks and how to add one |
| Extending | [INTEGRATION-API](INTEGRATION-API.md) | Calling VuloMail, delegating another plugin's delivery to it, adding a provider, adding an alert |
| Quality | [TESTING](TESTING.md) | Unit tests, the end-to-end approach, linters, release |

## Working on the code

```bash
pnpm install                  # once, in the repository root
composer install              # once, in plugins/vulomail
pnpm run build                # from plugins/vulomail: rebuild assets/
pnpm run watch                # rebuild on change
pnpm run test:php             # PHPUnit
composer run-script phpcs     # coding standards
composer dump-autoload -o     # after moving or renaming a PHP class
pnpm run build:zip            # release/vulomail-v<version>.zip
```

Checklist before a release: PHPUnit green, `phpcs` clean, ESLint and stylelint clean, `pnpm run build`, `make-pot` with no warnings, and a run on a clean site with `WP_DEBUG` on.

## Conventions

- Namespace `VuloMail\`, PSR-4 from `classes/`. Global accessor `VuloMail()`.
- PHP 7.4 syntax. No union types, constructor promotion, `match` or named arguments.
- Hooks are prefixed `vulomail_`. Text domain `vulomail`.
- VuloMail contains no code for any specific third-party or VuloLabs plugin. A plugin that wants VuloMail to deliver for it calls the public API from its own side ([INTEGRATION-API](INTEGRATION-API.md#delegating-delivery-from-your-plugin)). WooCommerce is the one exception: the SMS alerts listen to its hooks when it is active.
- Anything not listed in [INTEGRATION-API](INTEGRATION-API.md) is internal and may change.
