# Architecture

## Bootstrap

`vuloform.php` loads `config.php` and Composer's autoloader, then calls `VuloForm()` once. That creates the `VuloForm\VuloForm` singleton, which keeps its services in a plain array read through `__get`:

| Property | Class | Created on |
| --- | --- | --- |
| `forms` | `Forms\FormRepository` | `plugins_loaded` |
| `submissions` | `Submissions\SubmissionRepository` | `plugins_loaded` |
| `processor` | `Submissions\Processor` | `plugins_loaded` |
| `notifier` | `Notifications\Notifier` | `plugins_loaded` |
| `webhooks` | `Notifications\Webhooks` | `plugins_loaded` |
| `frontend` | `Frontend\Frontend` | `plugins_loaded` |
| `privacy` | `Security\Privacy` | `plugins_loaded` |
| `admin`, `rest`, `retention` | `Admin`, `Rest`, `Submissions\Retention` | `init` |

`vuloform_loaded` fires when the services exist. Other plugins should wait for it before calling `VuloForm()`.

`Install` runs on activation and whenever the stored `vuloform_plugin_db_version` differs from the plugin version. It creates or updates the tables with `dbDelta` and fires `vuloform_after_installed`.

## Folders

```
classes/
  Fields/Registry.php          field types and what each supports
  Forms/                       Schema, Conditions, Calculator, FormRepository, Templates
  Submissions/                 Processor, SubmissionRepository, Uploads, Formatter, Retention
  Security/                    Token, Spam, Privacy
  Notifications/               Notifier (email, SMS), Webhooks
  Frontend/                    Renderer (HTML), Frontend (shortcode, block, assets, no-JS post)
  Rest/                        Controller base + Forms, Submissions, Settings, PublicForms
  Integrations/functions.php   public PHP functions
public/js/form.js              the public form script (no dependencies)
public/js/embed.js             loader for forms on other websites
public/styles/form.scss        public form styles
src/                           React admin app (builder, submissions, settings)
src/blocks/form/               the Gutenberg block
tests/php/                     PHPUnit tests
```

## One submission, start to finish

1. The visitor's browser posts the form to `POST vuloform/v1/public/forms/{id}/submit` (or to `admin-post.php` when JavaScript is off).
2. `Submissions\Processor::handle()` runs the spam checks, cleans every value for its field type, works out which fields are visible, validates the visible ones, computes calculations, stores uploads and inserts the submission.
3. `vuloform_submission_created` fires. `Notifier` sends the form's email and SMS notifications; `Webhooks` schedules one background job per webhook.
4. The visitor gets the confirmation message or the redirect URL.

The browser runs the same visibility and validation rules for a faster experience, but the server never trusts the result: everything is decided again in step 2.

## Conventions

- Tabs, `defined( 'ABSPATH' ) || exit;` first in every PHP file, PHP 7.4 syntax.
- Constructors register hooks. No class is instantiated outside the container.
- Every string shown to a person goes through the `vuloform` text domain.
- Stored datetimes are UTC; `Utill::format_datetime()` converts to the site's date and time format for display.
