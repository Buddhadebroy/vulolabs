# Migration

`classes/Migration/`. The "import forms from another plugin" system behind the migration notice on
the Forms list. Reads another plugin's stored forms and turns each one into an ordinary VuloForm
form (the same `Forms\Schema::sanitize()` every hand-built form goes through); never writes to, or
otherwise touches, the source plugin's own data.

## Classes

| Class | Role |
| --- | --- |
| `MigratorInterface` | The contract: `get_id()`, `get_label()`, `list_available()`, `migrate()`. |
| `AbstractMigrator` | Implements `migrate()` and shortcode rewriting once; a concrete migrator only supplies what differs between source plugins. |
| `MigrationManager` | Registry (`MIGRATOR_CLASSES`); `list_sources()` for the migration screen's source list. |
| `MigrationMap` | Persists source-id → VuloForm-form-id, in the `vuloform_migration_map` option, so re-running a migration updates rather than duplicates a form. |
| `ShortcodeReplacer` | Rewrites a source plugin's embed shortcode to `[vuloform id="M"]` site-wide, after migrating. |
| `WpFormsMigrator`, `ForminatorMigrator`, `GravityFormsMigrator`, `ContactForm7Migrator`, `NinjaFormsMigrator`, `FormidableMigrator`, `FluentFormsMigrator` | One per source plugin. |

`Rest\Migration` exposes this at `GET /migration/sources` (detected plugins with a found-forms
count) and `POST /migration/run` (`{ source, ids?, overwrite? }`).

## `AbstractMigrator`

Every migrator used to duplicate the same ~60-line `migrate()` loop and shortcode-rewrite method;
`AbstractMigrator` now implements both once, and a concrete migrator supplies only:

```php
class MyPluginMigrator extends AbstractMigrator {
	public function get_id(): string { return 'my-plugin'; }
	public function get_label(): string { return __( 'My Plugin', 'vuloform' ); }
	public function list_available(): array { /* every source form, without writing anything */ }

	protected function is_active() { /* is the source plugin installed/active right now? */ }
	protected function shortcode_tags() { return array( 'my_plugin_form' ); } // more than one for an alias, e.g. Gravity Forms' `gravityform`/`gravityforms`
	protected function migrate_one( $source_id, ?int $existing_form_id, array &$errors ) {
		// Build one VuloForm schema from one source form, create or update it, return its id (0 on failure).
	}
}
```

`AbstractMigrator::migrate()` handles, identically for every migrator: skip-if-already-migrated
(unless `$overwrite`), recording the mapping, one error message per failed source form (built from
`get_label()`, not hand-typed per migrator), and rewriting shortcodes afterwards via
`replace_shortcodes()` (itself built from `list_available()` + `MigrationMap` + `shortcode_tags()`).

## Writing `migrate_one()`

The usual shape: read the source form, map its title/status, build `fields` by mapping each source
field through a `FIELD_TYPE_MAP` constant (source type slug → VuloForm type), and build `settings`
(confirmation, notifications) separately. A source field type with no VuloForm equivalent is
**reported as a compatibility note in `$errors`, never silently dropped or guessed at** - this is
the house rule across every migrator. Settings a migrator genuinely cannot translate safely
(Gravity Forms' and Fluent Forms' routing-based notification "send to", which can target a field's
own answer rather than a fixed address) are reported the same way instead of being guessed at.

`VuloForm()->forms->update()`/`create()` are called directly; the returned schema still goes
through `Schema::sanitize()` inside `FormRepository`, so a migrator never has to fully trust its
own output.

## Source verifiability

WPForms, Forminator, Contact Form 7, Ninja Forms, Formidable and Fluent Forms are hosted on
wp.org/SVN, so their migrators are built against (and where practical verified against) that public
source. **Gravity Forms is not** - it has no free tier and isn't on wp.org - so
`GravityFormsMigrator` is built against `GFAPI`'s own long-documented, stable public object shape
instead, and says so in its own class doc comment. Fluent Forms is also not on wp.org as a plain
plugin the same way; its migrator is built from its publicly shared developer docs/snippets rather
than a source read, and says so too. Treat any future migrator the same way: state plainly in the
class doc comment whether field mappings were confirmed against source, or are built from docs
only, so the next person touching it knows how much to trust an assumption before changing it.

## Adding a migrator

1. Create `classes/Migration/{Plugin}Migrator.php` extending `AbstractMigrator`.
2. Add it to `MigrationManager::MIGRATOR_CLASSES`.
3. Write `tests/php/src/test-migration.php` coverage: known field types map correctly, an unsupported
   type is reported not dropped, and (if the source plugin uses one) a bootstrap stub for whatever
   global class/function its own SDK exposes - see `tests/php/bootstrap.php`'s `GFAPI` stub for the
   pattern when a plugin's own API can't be reached through `Functions\when()` (static methods, not
   plain functions).
