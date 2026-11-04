<?php
/**
 * MigrationManager class file.
 *
 * @package VuloForm
 */

namespace VuloForm\Migration;

defined( 'ABSPATH' ) || exit;

/**
 * Registry of every supported "import forms from another plugin" migrator. Mirrors VuloPilot's
 * `Migration\MigrationManager` (list detected sources with a found-forms count, then run one on
 * demand) - the house pattern for this kind of migration tab across the monorepo.
 *
 * Adapters are added here one plugin at a time: WPForms, then Forminator.
 */
class MigrationManager {

	/**
	 * @var class-string<MigratorInterface>[]
	 */
	private const MIGRATOR_CLASSES = array(
		WpFormsMigrator::class,
		ForminatorMigrator::class,
	);

	/**
	 * @return MigratorInterface[] Keyed by `get_id()`.
	 */
	public function get_migrators(): array {
		$migrators = array();

		foreach ( self::MIGRATOR_CLASSES as $class ) {
			$migrator                         = new $class();
			$migrators[ $migrator->get_id() ] = $migrator;
		}

		return $migrators;
	}

	/**
	 * @param string $id One of `get_migrators()`'s keys.
	 * @return MigratorInterface|null
	 */
	public function get_migrator( string $id ): ?MigratorInterface {
		return $this->get_migrators()[ $id ] ?? null;
	}

	/**
	 * Every migrator, with its available forms already listed - the migration screen's source list.
	 *
	 * @return array<int, array{id: string, label: string, count: int, forms: array}>
	 */
	public function list_sources(): array {
		$sources = array();

		foreach ( $this->get_migrators() as $migrator ) {
			$forms = $migrator->list_available();

			$sources[] = array(
				'id'    => $migrator->get_id(),
				'label' => $migrator->get_label(),
				'count' => count( $forms ),
				'forms' => $forms,
			);
		}

		return $sources;
	}
}
