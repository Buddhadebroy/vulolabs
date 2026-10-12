# Submissions

## Pipeline

`Submissions\Processor::handle( $form, $post, $files )` is the only way a submission is accepted. Both entry points (the REST route and the no-JavaScript `admin-post.php` handler) pass it unslashed input.

1. **Published?** A draft answers "not accepting submissions".
2. **Spam checks** (`Security\Spam::check`), in this order: form token, rate limit, honeypot, minimum fill time, then the `vuloform_spam_check` filter. The verdict is `ok`, `spam` or `reject`.
3. **Clean** every value for its field type (`Processor::clean`). Anything posted that is not a field of the form is ignored.
4. **Visibility**: fields hidden by their conditions are dropped.
5. **Validate** visible fields (`Processor::validate`), then the `vuloform_validate_field` filter. Choice fields accept only values from their option list.
6. **Calculate** on the validated values.
7. **Store uploads**, then the `vuloform_submission_values` filter, then the insert.
8. Fire `vuloform_submission_created` (not for spam).

The result is `success`, `message`, `errors` (field id => message) and `redirect`. The submission id is removed before the result reaches the visitor.

A `spam` verdict returns the normal success message, stores the submission with status `spam` and sends nothing. A bot learns nothing from the response.

## Spam protection

| Check | How |
| --- | --- |
| Token | `Security\Token`: `timestamp.hmac` signed with a per-site secret (`vuloform_secret` option). Valid for one day. Fetched fresh from `/public/forms/{id}/token` so page caching does not break it. |
| Rate limit | Per form and visitor, per minute (Settings, default 5). The visitor is identified by an HMAC of `REMOTE_ADDR`; the address itself is not stored. Forwarded-for headers are ignored because a visitor can set them. |
| Honeypot | A hidden `vf_website` input. Filled in means spam. Site setting `honeypot` (default on). |
| Minimum time | The token's age must be at least the site setting `min_seconds` (default 2; 0 is off). |

Google reCAPTCHA is optional and switched on per form (`settings.spam.recaptcha`, checked last by `Security\Recaptcha`, keys in the site settings). Another anti-spam service can be plugged in with `vuloform_spam_check`.

## File uploads

`Submissions\Uploads` stores files under `wp-content/uploads/vuloform/<32 random chars>/<20 random chars>.<ext>`.

- The extension must be on the field's allow-list, which can only contain types from `Schema::FILE_TYPES`. No executable or script type is on that list.
- `wp_check_filetype_and_ext()` must agree that the content matches the extension.
- A name with a second, dangerous extension (`shell.php.png`) is refused.
- Size and file count are checked against the field's limits.
- Only files PHP itself received as uploads are accepted (`is_uploaded_file`).
- The folder gets an `.htaccess` that denies access and an empty `index.php`.

On nginx the `.htaccess` has no effect. The files are then protected by their unguessable path only; see [SECURITY-AND-PRIVACY.md](SECURITY-AND-PRIVACY.md).

Administrators download a file through `GET submissions/{id}/file`, which streams it after a capability check. Deleting a submission or a form deletes its files.

## Storage

`SubmissionRepository` keeps `data` (field key => value) and `meta` (page URL, optional IP, delivery events) as JSON. `search_text` is a flattened copy of the values for searching. Statuses are `unread`, `read` and `spam`.

A form can switch off storage (`store_submissions`). Notifications and webhooks still run; webhooks then get a single attempt because there is nothing to retry from.

## Retention

`Submissions\Retention` runs daily (`vuloform_prune_submissions`). When Settings has a retention period, it deletes older submissions and their files in batches of 200.
