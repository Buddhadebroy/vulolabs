<?php
/**
 * MigratorInterface class file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\Migration;

defined( 'ABSPATH' ) || exit;

/**
 * Contract for a single "import SEO data from another plugin" migrator. Each real competitor
 * (Rank Math, Yoast SEO, All in One SEO) gets its own class implementing this, registered in
 * `MigrationManager::MIGRATORS`.
 *
 * @class       MigratorInterface
 * @version     1.0.0
 * @author      VuloLabs
 */
interface MigratorInterface {

	/**
	 * Stable id, e.g. 'rank-math'.
	 *
	 * @return string
	 */
	public function get_id(): string;

	/**
	 * Human-readable source plugin name, e.g. 'Rank Math SEO'.
	 *
	 * @return string
	 */
	public function get_label(): string;

	/**
	 * How many of this site's posts have data this migrator could import, without writing
	 * anything. Backs the "12 posts found" count the migration UI shows before the user clicks
	 * Migrate.
	 *
	 * @return int
	 */
	public function count_available(): int;

	/**
	 * Imports every post this migrator finds data for into VuloPilot's own SEO postmeta
	 * (`VuloPilot\SeoVisibility\PostSeoMetaFields::META_KEYS`).
	 *
	 * @param bool $overwrite When false (default), a post that already has a VuloPilot focus
	 *                        keyword or social title saved is left alone rather than overwritten.
	 * @return array{migrated: int, skipped: int, errors: string[]}
	 */
	public function migrate( bool $overwrite = false ): array;
}
