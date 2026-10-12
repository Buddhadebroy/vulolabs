# Testing

## Unit tests

```bash
cd plugins/vuloform
vendor/bin/phpunit
```

PHPUnit with Brain Monkey; WordPress is not loaded. `tests/php/src/TestCase.php` stubs the WordPress functions the code calls, `tests/php/src/dns.php` replaces DNS lookups for the webhook tests so they never use the network.

| File | Covers |
| --- | --- |
| `test-forms.php` | Schema sanitizing and upgrading, unique ids and keys, publish problems, conditions and operators, the calculator, every template, rendered markup, drafts |
| `test-submissions.php` | The processing pipeline, server-side validation, hidden conditional fields, calculations, spam checks, rate limit, uploads, placeholders, email building, webhook destinations, signing and retry classification, CSV safety |

## What unit tests do not cover

These need a real WordPress and were checked by hand-driven scripts during development, not by an automated suite in this repository:

- Table creation, activation, uninstall.
- REST permission checks through the real REST server.
- Real file uploads over HTTP.
- WP-Cron scheduling of webhook retries.
- The privacy exporter and eraser.
- The block in the editor, the builder UI, drag and drop.
- Cross-origin embedding in a browser.

There are no JavaScript unit tests yet. Email and SMS delivery through real providers is VuloMail's concern and is not tested here.
