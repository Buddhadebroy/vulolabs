<?php
/**
 * MigratorInterface class file.
 *
 * @package VuloForm
 */

namespace VuloForm\Migration;

defined( 'ABSPATH' ) || exit;

/**
 * Contract for a single "import forms from another plugin" migrator. Each source plugin
 * (WPForms, Forminator, Gravity Forms, Fluent Forms, JetFormBuilder) gets its own class
 * implementing this, registered in `MigrationManager::MIGRATOR_CLASSES`. Mirrors VuloPilot's
 * own `Migration\MigratorInterface` (SEO plugin migration) - same contract, same house pattern.
 */
interface MigratorInterface {

	/**
	 * Stable id, e.g. 'wpforms'.
	 *
	 * @return string
	 */
	public function get_id(): string;

	/**
	 * Human-readable source plugin name, e.g. 'WPForms'.
	 *
	 * @return string
	 */
	public function get_label(): string;

	/**
	 * Every form this migrator can read from the source plugin right now, without writing
	 * anything - the "12 forms found" list the migration screen shows before Migrate is clicked.
	 *
	 * @return array<int, array{source_id: int|string, title: string, status: string, field_count: int, already_migrated: bool}>
	 */
	public function list_available(): array;

	/**
	 * Imports the given source forms into VuloForm's own form table.
	 *
	 * @param array<int, int|string> $source_ids Which source forms to migrate; empty migrates every form `list_available()` returns.
	 * @param bool                   $overwrite  When false (default), a source form already migrated before (per the stored mapping) is left alone rather than re-imported.
	 * @return array{migrated: int, skipped: int, errors: string[], posts_updated?: int, references_updated?: int} The last two, when present, count website content updated by a `ShortcodeReplacer` pass.
	 */
	public function migrate( array $source_ids = array(), bool $overwrite = false ): array;
}
