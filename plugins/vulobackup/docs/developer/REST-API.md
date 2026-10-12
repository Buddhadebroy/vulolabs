# REST API

Namespace `vulobackup/v1`. Every route requires an administrator and the `wp_rest` nonce. There are no public routes.

| Method | Route | Does |
| --- | --- | --- |
| GET | `/overview` | Last backup, next runs, storage, warnings, recent activity |
| GET | `/diagnostics` | Server checks and system information |
| GET | `/logs` | Activity log. `level`, `page`, `per_page` |
| DELETE | `/logs` | Empties the activity log |
| GET | `/backups` | List. `status` (`completed`, `failed`, `running`), `search`, `page`, `per_page` |
| POST | `/backups` | Start a backup. `type` (`full`, `database`, `files`), `areas[]`, `name`. 409 if a job is running |
| POST | `/backups/import` | Upload a bundle in pieces: multipart `chunk`, `offset`, `total`, `upload`, `last` |
| GET | `/backups/{id}` | One backup with manifest summary and log |
| DELETE | `/backups/{id}` | Delete. Body `scope`: `all`, `local` or a destination id |
| POST | `/backups/{id}/cancel` | Cancel a running backup |
| POST | `/backups/{id}/verify` | Integrity check. Repeat until `done` is true; `restart` to begin again |
| GET | `/backups/{id}/download` | Streams the backup as one zip |
| POST | `/jobs/run` | Runs one slice of the running job and returns it |
| GET | `/restores` | Recent restores |
| GET | `/restores/preview?backup={id}` | What a restore would replace, blockers, notes |
| POST | `/restores` | Start a restore. `backup`, `database`, `areas[]`, `safety`, `password`, `confirm` (must be `RESTORE`) |
| GET | `/restores/{id}` | One restore with its log |
| POST | `/restores/{id}/cancel` | Cancel before the switch |
| GET, POST | `/settings` | Read, update |
| POST | `/settings/encryption` | `enabled`, `password` |
| GET | `/settings/retention` | What retention would remove now |
| GET | `/destinations` | Destinations (no secrets) and provider definitions |
| POST | `/destinations` | Test and save. `id` to update, `provider`, `name`, `config` |
| POST | `/destinations/{id}/test` | Test again |
| POST | `/destinations/{id}/enabled` | `enabled` |
| DELETE | `/destinations/{id}` | Forget a destination |

Job objects are shaped by `Rest\Controller::view()`: display-ready dates and sizes, and no internal working state.
