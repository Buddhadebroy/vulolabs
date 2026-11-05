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
 * Adapters are added here one plugin at a time: WPForms, then Forminator, then Gravity Forms,
 * then Contact Form 7, then Ninja Forms, then Formidable Forms, then Fluent Forms.
 */
class MigrationManager {

	/**
	 * @var class-string<MigratorInterface>[]
	 */
	private const MIGRATOR_CLASSES = array(
		WpFormsMigrator::class,
		ForminatorMigrator::class,
		GravityFormsMigrator::class,
		ContactForm7Migrator::class,
		NinjaFormsMigrator::class,
		FormidableMigrator::class,
		FluentFormsMigrator::class,
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
				// Already-migrated forms stay listed (re-running an import can still update them),
				// but don't count toward "forms found" - that count drives the forms list's own
				// detection notice, which should go away once there is nothing new left to migrate.
				'count' => count(
					array_filter(
						$forms,
						static function ( $form ) {
							return empty( $form['already_migrated'] );
						}
					)
				),
				'forms' => $forms,
			);
		}

		return $sources;
	}
}
