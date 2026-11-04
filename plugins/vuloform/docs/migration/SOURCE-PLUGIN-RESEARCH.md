# Source Plugin Research: Migrating Forms into VuloForm

Research pass for a future "migrate forms into VuloForm" feature. None of the 5 plugins below are installed locally; everything here comes from public docs, WordPress.org listings, public GitHub repos, and public developer blog posts. Treat concrete schema details as "best public evidence," not verified-against-a-live-DB fact, except where noted.

## WPForms (Lite / free)

**License & redistribution**: Lite is GPL and distributed via WordPress.org SVN; `github.com/awesomemotive/wpforms` mirrors real plugin code (a WordPress.org plugin-analysis tool found a substantial `WPForms_Lite` class with hundreds of lines, not a stub), and SVN commit history shows releases synced "from GitHub." Full Lite source is publicly available. WPForms **Pro** is a separate paid add-on layer on top of Lite and is not in that public repo.

**Storage mechanism**: Custom tables, not CPT+postmeta. Documented/observed tables: `wp_wpforms_entries` (entry field values), `wp_wpforms_entry_meta` (per-entry metadata, e.g. associated IDs/dates), and in some installs `wp_wpforms_entry_fields` (field-level breakout, likely a newer-version addition). Form **definitions** (not entries) are stored as a CPT (`wpforms` post type) with the field/settings structure serialized into post content/meta — this is widely known among WPForms devs but I could not pull a primary-source confirmation of the exact meta key in this pass.

**Form/field schema**: Entry field values are JSON-encoded, keyed by field ID (confirmed via a developer gist decoding `wp_wpforms_entries` rows with `json_decode`, matching decoded field IDs against the form's field definitions). Field types (text, name, email, checkboxes, multiple choice, dropdown, etc.) are documented at a user level (wpforms.com field-type docs) but the concrete PHP array shape (per-field `choices`, `required`, conditional-logic ruleset) is **not** confirmed from public sources in this pass — WPForms exposes a "Smart Logic" UI (AND/OR rules per field) but the serialized rule shape wasn't found.

**Status handling**: Entries have read/unread and starred status, plus trash vs. permanent delete, plus optional spam storage gated by a form setting. Form-level draft vs. published status was not confirmed from public sources.

**Shortcode pattern**: `[wpforms id="123"]` — confirmed, standard single numeric `id` attribute (shown directly in the WPForms admin's "Shortcode" column).

**Block/page-builder embedding**: WPForms ships a Gutenberg block, but its attribute shape (block.json) was not confirmed from public sources in this pass.

**APIs/hooks**: No official REST API for form definitions was found. Hooks found: a documented custom `[wpforms_entries_table]` shortcode pattern (community snippet, not core), and action/filter hooks around form fields exist but weren't enumerated with confidence.

**Version differences**: Entry table shape appears to have changed across versions (`wp_wpforms_entry_fields` referenced only in some sources) — unconfirmed which version introduced it.

**Research limitations & gaps**: Core entry-storage SQL schema (full column lists) and the form-definition serialization format are not reliably documented publicly. **Recommend installing WPForms Lite on a disposable test site and inspecting `wp_wpforms_entries`/`_entry_meta` and the `wpforms` CPT's postmeta directly before building an adapter.**

## Forminator (free, WPMU DEV)

**License & redistribution**: GPL, free plugin distributed on WordPress.org; `github.com/wpmudev/forminator` is a public mirror. Forminator Pro add-ons are a separate paid layer.

**Storage mechanism**: CPT + postmeta. Form definitions are stored as posts with a `forminator_form_meta` meta key (confirmed via community/WPMU-DEV-authored Gists that read and `unserialize()` this key to get a `fields` array). This points to **PHP-serialized**, not JSON, storage for the form definition — though this wasn't confirmed against an official schema doc. Submission export to JSON is not a built-in feature; developers hook `forminator_form_after_save_entry` to push JSON elsewhere themselves, implying entries are not natively exposed as a clean JSON blob either.

**Form/field schema**: Fields live in the `forminator_form_meta.fields` array (serialized PHP). Concrete per-field-type shape (required flags, validation, choices, conditional logic) not found in public sources in this pass — the official reference is Forminator's own API docs (`wpmudev.com/docs/api-plugin-development/forminator-api-docs/`), which were not fetched.

**Status handling**: Not confirmed from public sources (draft vs. published form representation unknown).

**Shortcode pattern**: `[forminator_form id="123"]` — confirmed via WPMU DEV support content, same `do_shortcode`-compatible single-id pattern as Contact Form 7/WPForms.

**Block/page-builder embedding**: Forminator ships a Gutenberg block per its WordPress.org listing ("add forms without shortcodes"); attribute shape not confirmed.

**APIs/hooks**: Action hooks confirmed by name: `forminator_custom_form_after_handle_submit`, `forminator_custom_form_before_save_entry`, `forminator_custom_form_after_save_entry`, `forminator_custom_form_submit_before_set_fields`, and a `forminator_custom_form_submit_field_data` filter (field-data array + form ID). An `add_form_field` method exists on Forminator's own API per support references. The official developer API docs page exists but wasn't fetched in this pass.

**Version differences**: Not found.

**Research limitations & gaps**: Field-type/config schema and the form-definition serialization format (JSON vs PHP-serialize, and whether that's changed across versions) are not reliably confirmed. **Recommend installing Forminator on a test site, dumping a form's `forminator_form_meta` postmeta, and reading the official Forminator API docs page directly** before building an adapter.

## Gravity Forms (proprietary, Rocketgenius)

**License & redistribution**: Verified as **not free/GPL-distributed via WordPress.org**. Gravity Forms core is sold directly by Rocketgenius Inc. (gravityforms.com) under paid license tiers (Basic/Pro/Elite, $59–$259+), and no public core-plugin GitHub repo was found — `github.com/gravityforms` appears to host add-on-adjacent material at most; the actual core plugin source is not publicly browsable. (Note: Gravity Forms, like most WP plugins, is GPL-licensed code once purchased — WordPress's GPL requirements mean a customer who owns a copy can legally redistribute it — but there is no public, freely-downloadable copy of the core plugin to inspect without a purchase.) This matches the task's expectation: verify-per-plugin rather than assume, and Gravity Forms is confirmed proprietary-distribution even though GPL-licensed.

**Storage mechanism**: Not independently verified in this pass beyond what the documented API implies (forms are objects with an ID and a `fields` array; GFAPI is the documented access layer). Gravity Forms is widely known in the WP ecosystem to use custom tables for entries (`wp_gf_entry`, `wp_gf_entry_meta`, etc. per long-standing community knowledge) but that was not re-confirmed via public docs in this pass — flagging it as recalled-but-unverified rather than sourced.

**Form/field schema**: **Well documented via the official GFAPI and REST API v2**, which is the key finding for Gravity Forms. `GFAPI::get_form( $id )` returns a Form Object; `GFAPI::get_fields_by_type()` / `GFAPI::get_field()` fetch fields. REST API v2 exposes `GET /gf/v2/forms` and `GET /gf/v2/forms/[FORM_ID]`, gated by the `gravityforms_edit_forms` capability (filterable via `gform_rest_api_capability_get_forms`), returning a JSON response that includes a `fields` array. This is the single most migration-friendly path of the five plugins, specifically **because** direct schema reverse-engineering isn't the recommended approach anyway.

**Status handling**: Not confirmed from public sources in this pass.

**Shortcode pattern**: Not confirmed in this pass (Gravity Forms is known to primarily rely on its block/Gutenberg integration and the `gravityforms_edit_forms`-style admin UI rather than a commonly-advertised shortcode, but this needs direct verification).

**Block/page-builder embedding**: Not confirmed in this pass; Gravity Forms ships Gutenberg block support per general ecosystem knowledge, attribute shape unconfirmed.

**APIs/hooks**: **Best-documented of all 5 plugins.** Official docs: `docs.gravityforms.com` covers GFAPI (PHP, in-process) and REST API v2 (`/gf/v2/forms`, `/gf/v2/forms/[ID]`, `/gf/v2/entries`) with authentication, capability, and filter details.

**Version differences**: Not found; GFAPI/REST v2 are the current stable surfaces.

**Research limitations & gaps**: Core plugin source is not publicly available without a purchased license — correctly out of scope to bypass per the task instructions. Raw DB schema (custom table names/columns) is community lore, not verified here. **Recommend building the Gravity Forms adapter entirely against the documented GFAPI/REST v2 surfaces** (this is both the safest and, per Gravity Forms' own docs, the only supported path) rather than attempting direct DB access, and use a trial/licensed install only to validate the adapter's output, not to reverse-engineer schema.

## Fluent Forms (free, WPManageNinja)

**License & redistribution**: GPL, free plugin on WordPress.org; `github.com/fluentform/fluentform` is the public source repo. Fluent Forms Pro is a separate paid add-on layer.

**Storage mechanism**: Custom tables, confirmed in detail via official docs (`fluentforms.com/docs/database-tables-of-fluent-forms`):
- `fluentform_forms`: `id`, `title`, `status` (varchar, default "Draft"), `appearance_settings` (text), `form_fields` (**longtext, JSON** — full field definitions), `has_payment` (tinyint), `type`, `conditions` (text), `created_by`, `created_at`, `updated_at`.
- `fluentform_form_meta`: `id`, `form_id`, `meta_key`, `value` (longtext) — key/value settings and integration feeds (JSON-encoded per-row, confirmed via a community Gist calling `json_decode` on `value`).
- `fluentform_submissions`: `id`, `form_id`, `serial_number`, `response` (longtext — full submission response, JSON in older docs), `source_url`, `user_id`, `status` (default "unread"), `is_favourite`, browser/device/ip/geo columns, payment columns, timestamps.
- `fluentform_submission_meta`: per-field breakout — `response_id`, `form_id`, `meta_key`/`field_name`-style column, `value`/`field_value`, `name` (sub-field), timestamps. (Docs across versions name these columns slightly differently; see Version differences.)
- `fluentform_entry_details`: `form_id`, `submission_id`, `field_name`, `sub_field_name`, `field_value` — a flattened key/value reporting table.

**Form/field schema**: `fluentform_forms.form_fields` is a **longtext JSON** column holding the complete field tree for a form (confirmed directly from official docs) — this is the most concretely-documented form-definition schema of the five plugins. Per-field-type internal shape (choices array, conditional-logic ruleset) is implied to live inside that same JSON blob but the field-type-by-field-type structure wasn't enumerated in public docs during this pass.

**Status handling**: `fluentform_forms.status` defaults to `"Draft"` (string column, not boolean) — confirmed directly from official docs. Submission-level `status` defaults to `"unread"` (separate from form draft/published state).

**Shortcode pattern**: Not directly confirmed in this pass, but Fluent Forms' well-known convention (consistent with ecosystem norms and its own docs structure) is `[fluentform id="123"]`; treat as high-confidence but not doc-quoted here.

**Block/page-builder embedding**: Fluent Forms ships a Gutenberg block; attribute shape not confirmed in this pass.

**APIs/hooks**: Extensively documented action-hook lifecycle, e.g. `fluentform/submission_inserted` (fires after a submission is written; callback receives insert ID, form-data array keyed by input name, and the form object) and `fluentform/before_insert_submission`. A full "Action Hooks" doc category exists at `fluentforms.com/docs-category/action-hooks`. No REST API confirmed in this pass (not found, not ruled out).

**Version differences**: The docs explicitly flag drift — an older docs page describes `fluentform_submissions.response` as holding the *entire* submission response as JSON, while current docs split that into `fluentform_submission_meta` (per-field rows) and describe `fluentform_entry_details` as a separate reporting table. The official docs also warn `fluentform_transactions` is not yet stable for external use. **Confirm live column names against the installed version** before coding an adapter.

**Research limitations & gaps**: Official docs are good for the DB schema and action hooks but field-type-level config shape (inside the `form_fields` JSON) and the shortcode weren't independently confirmed from primary sources in this pass. Overall this plugin has the best public documentation of the five for storage.

## JetFormBuilder (Crocoblock / Jetimpex)

**License & redistribution**: Confirmed as GPL-compatible-but-not-pure-GPL per the vendor's own FAQ: "JetFormBuilder by Crocoblock owns distributed GPL-compatible code and commercial-based services included in the product subscription," and resale is explicitly disallowed because of bundled commercial services — the vendor itself says this does not align with GPL rules. The **core plugin is free** (distributed on WordPress.org as "JetFormBuilder — Dynamic Blocks Form Builder" and mirrored at `github.com/Crocoblock/jetformbuilder`, which is a public, active repo), while **PRO add-ons are a separate paid Crocoblock-subscription layer**. So unlike Gravity Forms, the JetFormBuilder *core* is publicly inspectable; only the PRO add-ons are gated.

**Storage mechanism**: Not confirmed in detail from public sources. JetFormBuilder is block-editor-native: forms are built as WordPress blocks inside the editor (not a separate custom-table-backed form builder), which strongly implies form **definitions** live as Gutenberg block markup in a CPT's `post_content` (standard WP block pattern), but this was not directly confirmed against documentation. Submissions can optionally be routed through a "Save Form Record" post-submit action and/or an "Insert/Update Post" action that writes to postmeta on an arbitrary CPT — the public repo's changelog references postmeta handling fixes for the Insert/Update Post action, consistent with this.

**Form/field schema**: Not confirmed from public sources in this pass. Because forms are block-based, field definitions most likely live as block attributes (per-block JSON in `post_content` comments, standard Gutenberg serialization) rather than a plugin-specific meta key, but this is an inference, not a documented fact.

**Status handling**: Not confirmed.

**Shortcode pattern**: Not confirmed — and plausibly **none**, since JetFormBuilder is advertised as block-editor-only ("Dynamic Blocks Form Builder"), unlike the other four plugins which all lead with a shortcode.

**Block/page-builder embedding**: This **is** the primary embedding mechanism (the plugin's entire premise), but the specific block names/attributes were not confirmed from public sources in this pass.

**APIs/hooks**: None confirmed in this pass beyond the public GitHub repo's changelog entries (which show active development and hook-adjacent fixes but weren't read in detail for hook names).

**Version differences**: Not found.

**Research limitations & gaps**: This is, along with Gravity Forms, the weakest-documented plugin of the five for internal schema — but for a different reason: Gravity Forms hides its *core source*, while JetFormBuilder's core source is public but its storage format simply isn't documented anywhere findable in this pass (no official developer/API docs page was located, only marketing/FAQ/help-center pages). **Recommend cloning `github.com/Crocoblock/jetformbuilder` and reading the source directly** (it's public, unlike Gravity Forms) to determine the actual block names, attribute shape, and any CPT/postmeta usage, and/or installing the free core plugin on a test site and inspecting a form's `post_content` directly, before building an adapter.

## Cross-plugin migration mapping notes

**Good public documentation, adapter can likely be scoped from docs alone:**
- **Gravity Forms** — not because of public source (there is none), but because its own GFAPI/REST v2 docs are thorough and are the vendor-sanctioned extraction path. Build against `GFAPI::get_form()`/`GET /gf/v2/forms` rather than any DB table.
- **Fluent Forms** — official docs give exact table/column names and confirm `form_fields` is a JSON longtext column; the action-hook lifecycle for entries is also well documented. Still verify live schema against the installed version given the docs' own drift between doc revisions.

**Partially documented — usable as a starting point, but needs live-instance verification before an adapter can be built with confidence:**
- **WPForms** — entry-table existence and JSON-encoded field values are confirmed, but the form-definition serialization format and field-type config shape are not; also uncertain which entry-table schema (`_entries` vs `_entry_fields`) a given install uses.
- **Forminator** — shortcode and several save/submit hooks are confirmed, and `forminator_form_meta` is confirmed as the storage key, but whether it's JSON or PHP-serialized, and the field-type schema, need either the official (unfetched) API docs or a live test install.

**Needs live-instance inspection (and/or direct docs reading not completed here) before an adapter can be built with any confidence:**
- **JetFormBuilder** — core source is public but undocumented for storage format; next step is reading the GitHub source directly rather than more web search.
- **Gravity Forms** core DB schema (as opposed to its API) — don't attempt to reverse-engineer `wp_gf_entry`-style tables; the vendor's own GFAPI/REST v2 is the only sanctioned and well-documented path, so the migration adapter should target that, not raw tables, even on a licensed test install.

General recommendation for implementation phase: for all five, before writing adapter code, install (trial/licensed where required) each plugin on a disposable WordPress test site, create one form per field type, and diff the actual DB rows / REST responses against this document — this document should be treated as a research-stage map of where to look, not a frozen schema spec.
