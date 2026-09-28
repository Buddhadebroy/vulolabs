<?php
/**
 * ExtensionManager class file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\Sdk;

use VuloPilot\Dashboard\ActivityLogRepository;

defined( 'ABSPATH' ) || exit;

/**
 * Collects every registered extension (`vulopilot_extension_sources` filter) and calls its
 * register().
 *
 * @class       ExtensionManager class
 * @version     1.0.0
 * @author      VuloLabs
 */
class ExtensionManager {

	/**
	 * Registered, compatible extensions, keyed by their own get_id().
	 *
	 * @var array<string, ExtensionInterface>
	 */
	private array $extensions = array();

	/**
	 * Extensions found but skipped for failing the version check, keyed by their own
	 * get_id().
	 *
	 * @var array<string, array{name: string, version: string, required: string}>
	 */
	private array $incompatible = array();

	/**
	 * ExtensionManager constructor.
	 */
	public function __construct() {
		add_action( 'init', array( $this, 'register_extensions' ), 15 );
		add_action( 'admin_notices', array( $this, 'render_incompatible_notice' ) );
	}

	/**
	 * Instantiates every registered extension class, gates each on
	 * VersionGuard::meets_minimum(), and calls register() on the ones that pass.
	 *
	 * @return void
	 */
	public function register_extensions(): void {
		$extension_classes = apply_filters( 'vulopilot_extension_sources', array() );

		foreach ( $extension_classes as $extension_class ) {
			if ( ! is_string( $extension_class ) || ! class_exists( $extension_class ) ) {
				continue;
			}

			$extension = new $extension_class();

			if ( ! $extension instanceof ExtensionInterface ) {
				continue;
			}

			if ( ! VersionGuard::meets_minimum( VuloPilot()->version, $extension->get_minimum_vulopilot_version() ) ) {
				$this->mark_incompatible( $extension );
				continue;
			}

			try {
				$extension->register();
			} catch ( \Throwable $exception ) {
				$this->log_registration_failure( $extension, $exception );
				continue;
			}

			$this->extensions[ $extension->get_id() ] = $extension;
		}
	}

	/**
	 * @param string $id An extension's get_id().
	 * @return ExtensionInterface|null
	 */
	public function get_extension( string $id ): ?ExtensionInterface {
		return $this->extensions[ $id ] ?? null;
	}

	/**
	 * @return array<string, ExtensionInterface>
	 */
	public function get_all_extensions(): array {
		return $this->extensions;
	}

	/**
	 * @return array<string, array{name: string, version: string, required: string}>
	 */
	public function get_incompatible_extensions(): array {
		return $this->incompatible;
	}

	/**
	 * @return void
	 */
	public function render_incompatible_notice(): void {
		if ( empty( $this->incompatible ) || ! current_user_can( 'manage_options' ) ) {
			return;
		}

		foreach ( $this->incompatible as $extension ) {
			printf(
				'<div class="notice notice-warning"><p>%s</p></div>',
				esc_html(
					sprintf(
						/* translators: 1: extension name, 2: extension version, 3: minimum required VuloPilot version, 4: installed VuloPilot version. */
						__( 'VuloPilot: "%1$s" (v%2$s) requires VuloPilot %3$s or newer - you have %4$s. This extension was not loaded.', 'vulopilot' ),
						$extension['name'],
						$extension['version'],
						$extension['required'],
						VuloPilot()->version
					)
				)
			);
		}
	}

	/**
	 * @param ExtensionInterface $extension The extension that failed the version check.
	 * @return void
	 */
	private function mark_incompatible( ExtensionInterface $extension ): void {
		$this->incompatible[ $extension->get_id() ] = array(
			'name'     => $extension->get_name(),
			'version'  => $extension->get_version(),
			'required' => $extension->get_minimum_vulopilot_version(),
		);

		( new ActivityLogRepository() )->log(
			'extension.incompatible',
			sprintf(
				/* translators: 1: extension name, 2: minimum required VuloPilot version. */
				__( 'Extension "%1$s" was not loaded - it requires VuloPilot %2$s or newer.', 'vulopilot' ),
				$extension->get_name(),
				$extension->get_minimum_vulopilot_version()
			),
			'medium',
			'system',
			'extension',
			$extension->get_id()
		);
	}

	/**
	 * @param ExtensionInterface $extension The extension whose register() threw.
	 * @param \Throwable         $exception What it threw.
	 * @return void
	 */
	private function log_registration_failure( ExtensionInterface $extension, \Throwable $exception ): void {
		( new ActivityLogRepository() )->log(
			'extension.registration_failed',
			sprintf(
				/* translators: 1: extension name, 2: exception message. */
				__( 'Extension "%1$s" failed to register: %2$s', 'vulopilot' ),
				$extension->get_name(),
				$exception->getMessage()
			),
			'high',
			'system',
			'extension',
			$extension->get_id()
		);
	}
}
