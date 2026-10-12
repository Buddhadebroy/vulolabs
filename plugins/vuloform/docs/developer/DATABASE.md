# Data

## Tables

`{prefix}vuloform_forms`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | bigint unsigned | Primary key |
| `title` | varchar(200) | |
| `status` | varchar(20) | `draft` or `published`. Indexed. |
| `form_schema` | longtext | JSON, see [FORM-SCHEMA.md](FORM-SCHEMA.md) |
| `created_at`, `updated_at` | datetime | UTC |

`{prefix}vuloform_submissions`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | bigint unsigned | Primary key |
| `form_id` | bigint unsigned | Indexed with `status` |
| `status` | varchar(20) | `unread`, `read`, `spam` |
| `user_id` | bigint unsigned | The logged-in user, 0 for a guest. Indexed. |
| `data` | longtext | JSON: field key => value |
| `meta` | longtext | JSON: page URL, IP (only if enabled), delivery events |
| `search_text` | text | Flattened values for searching |
| `created_at` | datetime | UTC. Indexed. |

Custom tables were chosen over a post type because submissions are numerous, are filtered by form, status and date, and should not load post meta or appear in anything that lists posts.

## Options

| Option | Content |
| --- | --- |
| `vuloform_settings` | `retention_days`, `store_ip`, `rate_limit`, `keep_data_uninstall` |
| `vuloform_plugin_db_version` | Version the tables were last updated for |
| `vuloform_active_modules` | Ids of the extension modules that are switched on |
| `vuloform_secret` | Random key that signs form tokens and hashes visitor addresses for the rate limit |

Transients: `vuloform_rl_*` (rate limit windows, one minute) and `vuloform_result_*` (outcome of a no-JavaScript submission, a few minutes).

## Files

`wp-content/uploads/vuloform/` holds uploaded files. See [SUBMISSIONS.md](SUBMISSIONS.md).

## Scheduled events

`vuloform_prune_submissions` (daily) and `vuloform_send_webhook` (single events). Deactivating the plugin clears the daily event.

## Migrations

Table changes go in `Install::create_database_tables()`; `dbDelta` applies the difference when the plugin version changes. Changes to the JSON schema go in `Schema::upgrade()` together with a bump of `VULOFORM_SCHEMA_VERSION`.

## Uninstall

Deleting the plugin keeps everything by default. With Settings set to "Delete everything", `Install::uninstall()` drops both tables, deletes the options and transients, removes the uploads folder and clears the scheduled events.
