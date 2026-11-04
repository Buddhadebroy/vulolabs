<?php
/**
 * MigrationMap class file.
 *
 * @package VuloForm
 */

namespace VuloForm\Migration;

defined( 'ABSPATH' ) || exit;

/**
 * Persistent source-form -> VuloForm-form mapping, so a migration can be retried without ever
 * creating duplicate forms. One `vuloform_migration_map` option holds every source plugin's
 * mapping, keyed `"{source}:{source_id}"` => VuloForm form id.
 */
class MigrationMap {

	const OPTION = 'vuloform_migration_map';

	/**
	 * @param string     $source    Migrator id, e.g. 'wpforms'.
	 * @param int|string $source_id Source plugin's own form id.
	 * @return int|null VuloForm form id, or null when not migrated yet.
	 */
	public function get( string $source, $source_id ): ?int {
		$map = get_option( self::OPTION, array() );
		$key = $this->key( $source, $source_id );

		return isset( $map[ $key ] ) ? (int) $map[ $key ] : null;
	}

	/**
	 * @param string     $source    Migrator id.
	 * @param int|string $source_id Source plugin's own form id.
	 * @param int        $form_id   The VuloForm form it was migrated into.
	 * @return void
	 */
	public function record( string $source, $source_id, int $form_id ): void {
		$map                                      = get_option( self::OPTION, array() );
		$map[ $this->key( $source, $source_id ) ] = $form_id;

		update_option( self::OPTION, $map );
	}

	/**
	 * @param string     $source    Migrator id.
	 * @param int|string $source_id Source plugin's own form id.
	 * @return string
	 */
	private function key( string $source, $source_id ): string {
		return $source . ':' . $source_id;
	}
}
