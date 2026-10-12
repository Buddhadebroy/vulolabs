# Logging

## Classes

| Class | File | What it does |
|---|---|---|
| `Logger` | `classes/Logging/Logger.php` | Builds one log row per message, applies the privacy settings, schedules and runs retention |
| `LogRepository` | `classes/Logging/LogRepository.php` | Database access for the log table: insert, get, query, delete, daily counts |

Table and columns: [DATABASE](DATABASE.md).

## 1. What gets logged

One row per message, written by:

- `Email\Dispatcher::send()` - a success, or a final failure;
- `Email\WpMailInterceptor` - a send by WordPress's own mailer, including one handed back after VuloMail's connections failed;
- `Sms\Dispatcher::send()` - every SMS, including one refused for an invalid number;
- the test tools, for a test through one named connection.

`attempts` holds the JSON of every attempt in order (`Result::to_array()`): provider, connection id, success, provider message id, error code and message. `used_fallback` is 1 when something other than the primary delivered.

## 2. Privacy rules

Applied in `Logger::write()`:

| Setting | Effect |
|---|---|
| `log_enabled` off | Nothing is written; `write()` returns 0 |
| `log_content` off (default) | `body` is stored as `NULL` |
| `mask_recipients` on | Recipients are stored masked (`j•••@example.com`, `•••••••••123`) |

A row with no body, or with masked recipients, can't be resent (`Rest\Logs::can_resend()`).

`vulomail_log_data` filters the row before it is stored; return `false` to skip a message.

Error messages are already scrubbed of credentials by the adapters ([CONNECTIONS-AND-SECURITY](CONNECTIONS-AND-SECURITY.md#5-error-text)).

## 3. Retention

`Logger::register_retention()` schedules the daily `vulomail_prune_logs` event. `prune()` deletes rows older than `log_retention_days`; 0 keeps everything. The event is cleared on deactivation.

## 4. Querying

`LogRepository::query( $args )` accepts `channel`, `status`, `search` (recipients or subject), `after`, `before` (UTC datetimes), `page`, `per_page` (default 10, maximum 100), `orderby` (one of `SORTABLE`), `order`.

It returns `data`, `total` and `status_counts`. The counts are taken before the status filter is applied, so the status pills each show their own total within the current channel, search and date range.

List rows omit `body`; it is fetched per row by `GET /logs/{id}`.

## 5. Dates

`created_at` is stored in UTC. The REST layer adds display fields with `Utill::with_display_dates()`:

| Field | Content |
|---|---|
| `created_at_display` | Date and time in the site's date format, time format, timezone and language (`wp_date()`) |
| `created_at_time` | The time only |
| `created_at_day` | "Today", "Yesterday", or the date |

The admin app shows these and does no date formatting of its own. The date-range filter sends calendar days (`YYYY-MM-DD`); `Rest\Logs::day_boundary()` reads them in the site's timezone and converts to UTC.
