# Architecture

## 1. Layout

```
vulomail.php, config.php     bootstrap, constants
classes/
  VuloMail.php               singleton container
  Install.php                log table, uninstall routine
  Utill.php                  constants, date formatting
  Admin.php                  menu, enqueue
  FrontendScripts.php        asset registration, localized data
  Rest.php                   controller registry
  Security/                  Secrets, Redactor, HttpClient
  Settings/                  Settings (the one settings option)
  Connections/               ProviderRegistry, ConnectionRepository
  Delivery/                  Result
  Email/                     Message, MessageFactory, Dispatcher, WpMailInterceptor, Mailers/*
  Sms/                       Dispatcher, PhoneNumber, Triggers, Gateways/*
  Logging/                   LogRepository, Logger
  Diagnostics/               Diagnostics
  Integrations/              functions.php (public API)
  Rest/                      vulomail/v1 controllers
src/                         React admin, built to assets/
tests/php/                   PHPUnit (Brain\Monkey)
```

## 2. Bootstrap

`vulomail.php` requires the Composer autoloader and `classes/Integrations/functions.php`, then calls `VuloMail()`, which creates the singleton (`VuloMail\VuloMail::init()`).

The container is a plain array read through `__get` (`VuloMail()->settings`, `->email`, `->sms` ...). It boots in two stages:

| Stage | When | What |
|---|---|---|
| `init_services()` | In the constructor, as the plugin file loads | `secrets`, `settings`, `providers`, `connections`, `logs`, `logger`, `email`, `sms`, `wp_mail` |
| `init_classes()` | `init`, priority 0 | `admin`, `frontendScripts`, `diagnostics`, `sms_triggers`, `rest`; then `do_action( 'vulomail_loaded' )` |

The delivery services are built early on purpose: other plugins call `wp_mail()` as early as `plugins_loaded`, and those messages must reach the configured connection too. Nothing in `init_services()` touches the database until a message is sent.

`init_plugin()` (on `plugins_loaded`) runs `Install` when the stored `vulomail_plugin_db_version` differs from `VULOMAIL_PLUGIN_VERSION`.

Uninstall is a hook (`register_uninstall_hook` → `Install::uninstall()`), not an `uninstall.php`, because the shared release script packages a fixed list of top-level paths. For the same reason the public API file lives under `classes/`.

## 3. The delivery pipeline

```
wp_mail()  ──►  WpMailInterceptor (pre_wp_mail)  ──►  MessageFactory  ──►  Email\Dispatcher
                                                                              │
                                              primary connection  ──fail──►  backup connection
                                                                              │
                                                              Logger  ◄───────┘
vulomail_send_sms()  ──►  Sms\Dispatcher  ──►  primary gateway ──fail──► backup gateway ──► Logger
```

Each attempt returns a `Delivery\Result` (success, provider, connection id, provider message id, error code and message). The dispatcher's final `Result` carries every attempt in `->attempts`, and that is what gets logged: one log row per message, not per attempt.

Details: [EMAIL-DELIVERY](EMAIL-DELIVERY.md), [SMS-AND-ALERTS](SMS-AND-ALERTS.md).

## 4. Extension points

Everything a third party should use is in [INTEGRATION-API](INTEGRATION-API.md). In short:

- Functions: `vulomail_send_email()`, `vulomail_send_sms()`, `vulomail_is_email_ready()`, `vulomail_is_sms_ready()`, `vulomail_api_version()`.
- Provider adapters: `vulomail_email_providers`, `vulomail_sms_providers`.
- Message filters: `vulomail_should_handle_email`, `vulomail_email_message`, `vulomail_sms_message`.
- Outcome actions: `vulomail_email_sent`, `vulomail_email_failed`, `vulomail_sms_sent`, `vulomail_sms_failed`.
- Alerts, logging, diagnostics, REST: `vulomail_sms_triggers`, `vulomail_log_data`, `vulomail_diagnostics`, `vulomail_rest_controllers`.

## 5. REST

Controllers extend `VuloMail\Rest\Controller` (itself a `WP_REST_Controller`), register on `rest_api_init` through `classes/Rest.php`, and use the namespace from `VuloMail()->rest_namespace` (`vulomail/v1`). Every route's `permission_callback` is `check_permission()`: `manage_options` only. See [REST-API](REST-API.md).

## 6. Admin app

One React app mounted on `#admin-main-wrapper`, on the single admin page `admin.php?page=vulomail`. The active screen is read from the URL hash (`#&tab=logs`), as in the other VuloLabs plugins. It is built with the shared `tools/webpack/create-config.js` and uses the external `@multivendorx/zyra` component library. See [ADMIN-UI](ADMIN-UI.md).

Data reaches the app through the localized global `vulomailAppLocalizer` (`FrontendScripts::localize_scripts()`), which never contains a credential.

## 7. Design rules worth knowing before changing things

- **Unconfigured means untouched.** With no usable email connection, or with routing off, `pre_wp_mail` returns `null` and WordPress sends as it would without the plugin.
- **Adapters never throw and never leak.** A failure is a failed `Result` whose message has had credentials scrubbed. Dispatchers still wrap adapters in `try/catch \Throwable`.
- **Secrets never leave the server.** REST responses mask them; the browser never has the real value to send back.
- **One log row per message.**
- **Privacy by default.** Message content is not stored unless the site owner opts in.
