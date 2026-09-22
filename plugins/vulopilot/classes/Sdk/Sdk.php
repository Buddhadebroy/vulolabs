<?php
/**
 * Every class in this file used to be its own file under classes/Sdk/
 * (same names, docblocks, and behavior) - merged into one file to reduce
 * classes/'s file count, per direct instruction. Autoloading does not rely on
 * each class's own file matching its own name for this: composer.json's
 * autoload.classmap entry (alongside the existing psr-4 one) makes Composer
 * tokenize every file under classes/ and modules/ and map each class it finds
 * to its real file, however many classes share one file - run
 * `composer dump-autoload` (no `-o`/`--optimize-autoloader` needed) after any
 * further file merge/split here.
 *
 * @package VuloPilot
 */

namespace VuloPilot\Sdk;

use VuloPilot\Contracts\Extension\ExtensionInterface;
use VuloPilot\Repositories\ActivityLogRepository;

defined( 'ABSPATH' ) || exit;

/**
 * Optional base class an extension can use to organize its own internal
 * service wiring - the same plain-array-container-with-lazy-factories
 * shape every plugin bootstrap in this codebase already uses
 * (php-wordpress.md's singleton/container pattern), extracted into a
 * reusable base rather than every extension re-deriving it. This is
 * deliberately NOT a PHP-DI/Symfony container - that would be new
 * dependency-injection tooling the root CLAUDE.md's "Out of scope" section
 * says to flag rather than introduce silently; this is the existing
 * pattern's own logic, just given a name an SDK consumer can extend.
 *
 * Nothing in VuloPilot core resolves anything through this - it exists
 * purely for an extension's own internal use inside its register()/
 * ExtensionInterface implementation, one instance per extension, not a
 * shared application-wide container.
 *
 * @class       AbstractServiceProvider class
 * @version     1.0.0
 * @author      VuloLabs
 */
abstract class AbstractServiceProvider {

    /**
     * @var array<string, callable>
     */
    private array $factories = array();

    /**
     * @var array<string, mixed>
     */
    private array $resolved = array();

    /**
     * Registers this provider's services - call bind() here for
     * everything the extension wants resolvable through make().
     *
     * @return void
     */
    abstract public function register(): void;

    /**
     * @param string   $id      Service id.
     * @param callable $factory Called once, lazily, the first time make() asks for $id.
     * @return void
     */
    protected function bind( string $id, callable $factory ): void {
        $this->factories[ $id ] = $factory;
    }

    /**
     * @param string $id Service id previously bind()'d.
     * @return mixed
     * @throws \InvalidArgumentException When $id was never bind()'d.
     */
    public function make( string $id ) {
        if ( array_key_exists( $id, $this->resolved ) ) {
            return $this->resolved[ $id ];
        }

        if ( ! isset( $this->factories[ $id ] ) ) {
            throw new \InvalidArgumentException( esc_html( sprintf( 'No service registered for id "%s".', $id ) ) );
        }

        $this->resolved[ $id ] = ( $this->factories[ $id ] )();

        return $this->resolved[ $id ];
    }

    /**
     * @param string $id Service id.
     * @return bool
     */
    public function has( string $id ): bool {
        return isset( $this->factories[ $id ] );
    }
}

/**
 * Collects every registered extension (`vulopilot_extension_sources`
 * filter) and calls its register() - the SDK's discovery layer, same
 * discovery-by-filter shape as Scanners\ScannerRegistry/RuleEngine\RuleRegistry/
 * AutomationEngine\TriggerRegistry, but one level up: an extension doesn't
 * scan or rule anything itself, it's a bundle whose own register() method
 * calls those *existing* filters (ARCHITECTURE.md's "Extension system =
 * the discovery-by-filter mechanism itself" - this doesn't replace that,
 * it adds the one thing raw filter registration can't: a real version
 * compatibility gate).
 *
 * Unlike every other registry here, there are no Free-authored defaults -
 * Free doesn't extend itself, so the filter's base list is empty; every
 * registered extension is either vulopilot-pro or genuine third-party code.
 *
 * Hooked at `init` priority 15, one tick before the per-concern registries
 * (ScannerRegistry et al., all priority 20) read their own filters - so an
 * extension's register() call has already added its own scanner/rule/
 * automation/report classes to those filters by the time the
 * registries that consume them run.
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
     * Extensions found but skipped for failing the version check, keyed
     * by their own get_id() - what the admin notice and
     * `wp vulopilot extensions list` both read.
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
     * VersionGuard::meets_minimum(), and calls register() on the ones that
     * pass. A class that doesn't exist, doesn't implement
     * ExtensionInterface, or fails its own register() call is silently
     * skipped (the latter logged, not thrown) rather than fataling every
     * other extension - same defensive posture as every sibling registry.
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
     * Admin-facing warning for any extension skipped over a version
     * mismatch - the same "don't fail silently on a real problem" posture
     * VuloPilotPro's own is_vulopilot_loaded() notice already uses for a
     * missing Free plugin.
     *
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

/**
 * Compatibility-check helpers an extension's register() (or anything
 * else - a module, a Pro feature check) can call before doing something
 * that depends on a specific core/PHP/WordPress/WooCommerce version being
 * available, rather than each call site hand-rolling its own
 * version_compare() call with its own bug potential (a very easy place to
 * get the comparison operator direction backwards).
 *
 * @class       VersionGuard class
 * @version     1.0.0
 * @author      VuloLabs
 */
class VersionGuard {

    /**
     * @param string $current  The version actually installed/running.
     * @param string $required The lowest version that's acceptable.
     * @return bool True when $current satisfies $required (>=).
     */
    public static function meets_minimum( string $current, string $required ): bool {
        return version_compare( $current, $required, '>=' );
    }

    /**
     * @param string $required The lowest PHP version an extension needs.
     * @return bool
     */
    public static function is_php_compatible( string $required ): bool {
        return self::meets_minimum( PHP_VERSION, $required );
    }

    /**
     * @param string $required The lowest WordPress version an extension needs.
     * @return bool
     */
    public static function is_wp_compatible( string $required ): bool {
        return self::meets_minimum( $GLOBALS['wp_version'], $required );
    }

    /**
     * @param string|null $required The lowest WooCommerce version an extension needs, or null to only check WooCommerce is active at all.
     * @return bool
     */
    public static function is_woocommerce_compatible( ?string $required = null ): bool {
        if ( ! defined( 'WC_VERSION' ) ) {
            return false;
        }

        return null === $required || self::meets_minimum( WC_VERSION, $required );
    }
}
