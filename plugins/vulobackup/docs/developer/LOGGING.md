# Logging

## 1. Two logs

`Logging\Logger` writes plain files inside the storage folder, one JSON object per line, so they survive a database restore.

| Log | File | Written by | Holds |
|---|---|---|---|
| Activity | `logs/activity.jsonl` | `log( $level, $event, $message, $context )` | What VuloBackup did: `time` (UTC), `level`, `event`, `message`, `job` |
| Job | `{job folder}/log.jsonl` | `job( $job_dir, $message, $level )` | The detail of one backup or restore: `time`, `level`, `message` |

Levels: `info`, `warning`, `error`.

Activity events: `backup_started`, `backup_completed`, `backup_failed`, `backup_cancelled`, `backup_imported`, `backup_downloaded`, `backup_deleted`, `upload_completed`, `upload_failed`, `verify_passed`, `verify_failed`, `retention`, `retention_failed`, `restore_started`, `restore_completed`, `restore_failed`, `restore_cancelled`, `schedule_failed`, `destination_saved`, `destination_removed`, `settings`, `notification`.

## 2. What is never logged

Every message passes through `Security\Redactor::scrub()`:

- values registered with `Logger::hide()` (the secrets of the destination in use) are removed verbatim,
- `Authorization` headers, signatures, and `key=`/`password=`/`secret=` style pairs are redacted,
- private keys are redacted,
- absolute server paths are shortened to `wp-content/…` or `[site]/…`,
- HTML is stripped.

Database contents, file contents and the encryption password are never passed to the logger.

## 3. Reading and retention

`Logger::read( $file, $limit, $level )` returns the newest lines first with `time_display` added. Only the last 2 MB of a file is read.

`prune()` drops activity older than `log_retention_days`; the watchdog calls it once a day. `clear()` deletes the activity log (`DELETE logs`). A job's log is deleted with the job.

## 4. Failure email

`notify_failure( $job, $subject )` sends one plain-text email with `wp_mail()` when `notify_failure` is on, to `notify_email` or the site administrator.

It is sent when a backup fails, and when a completed backup could not be copied to a destination. The job's `notified` flag prevents a second email for the same job.

The activity log then records that the message was "handed to WordPress for sending", or that WordPress refused it. That is all WordPress reports; delivery is not claimed.
