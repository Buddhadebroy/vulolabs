# REST API

Namespace: `vuloform/v1`.

## Private routes

Require a logged-in user with `manage_options` and the REST nonce (`X-WP-Nonce`). Without a login the answer is 401; with a login but not the capability, 403.

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/forms` | List. `search`, `status`, `page`, `per_page`. |
| POST | `/forms` | Create: `{ "template": "contact" }`, `{ "title", "schema" }` (import) or blank. Always a draft. |
| GET | `/forms/{id}` | One form with its schema. |
| POST | `/forms/{id}` | Save `title`, `schema`, `status`. Returns the stored form and `problems`. Publishing a form with problems leaves it a draft. |
| DELETE | `/forms/{id}` | Delete the form, its submissions and their files. |
| POST | `/forms/{id}/duplicate` | Copy as a draft. |
| POST | `/forms/preview` | Render an unsaved `schema` to HTML for the builder preview. |
| GET | `/submissions` | List for `form_id`. `status` (`inbox`, `unread`, `read`, `spam`, `all`), `search`, `after`, `before` (YYYY-MM-DD), `page`, `per_page`. Returns `data`, `total`, `status_counts`. |
| GET | `/submissions/{id}` | Detail with labelled fields, files and delivery events. Marks it read. |
| POST | `/submissions/status` | `{ "ids": [], "status": "read" }` |
| DELETE | `/submissions` | `{ "ids": [] }`. Deletes files too. |
| GET | `/submissions/export` | CSV download with the same filters as the list. |
| GET | `/submissions/{id}/file` | Download one upload: `key`, `index`. |
| GET, POST | `/settings` | Site-wide settings. |
| GET | `/modules` | Extension modules: `available` and `active` ids. |
| POST | `/modules` | `{ "id": "payments", "active": true }`. 404 for an id no extension offers. |

### CSV

One column per input field plus ID, date and status, UTF-8 with a byte order mark so spreadsheet programs read accents correctly. A cell starting with `=`, `+`, `-`, `@`, tab or carriage return is prefixed with an apostrophe so a spreadsheet does not run it as a formula.

## Public routes

No login. Answer any origin, without credentials.

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/public/forms/{id}/token` | A fresh form token. `Cache-Control: no-store`. |
| POST | `/public/forms/{id}/submit` | Submit. `multipart/form-data`: `vf[field_key]`, `vf_file_{field_key}[]`, `vf_token`, the honeypot. Returns `success`, `message`, `errors`, `redirect`. |
| GET | `/public/forms/{id}/embed` | `html`, `style`, `script` for another website. |

A draft or missing form answers 404 on all three; the two cases cannot be told apart.

## Adding a controller

```php
add_filter( 'vuloform_rest_controllers', function ( $controllers ) {
	$controllers['my_thing'] = My_Controller::class; // extends VuloForm\Rest\Controller
	return $controllers;
} );
```

`Controller::route()` registers a route with the capability check unless its fourth argument marks it public.
