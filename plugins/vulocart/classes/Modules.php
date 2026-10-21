<?php
/**
 * Modules class file.
 *
 * @package VuloCart
 */

namespace VuloCart;

defined( 'ABSPATH' ) || exit;

/**
 * VuloCart Modules class.
 *
 * The folder-scan/reflection module loader module-architecture.md
 * documents - mirrors VuloPilot\Modules exactly
 * (same discovery mechanism, same activate/deactivate/is_available/
 * is_active API), so vulocart-pro and any third-party plugin extend
 * VuloCart the same way a Pro/catalogx-pro module extends its own free
 * plugin: a folder under `modules/` containing `Module.php`, registered via the
 * `vulocart_module_sources` filter, never instantiated directly.
 *
 * Distinct from Scanners\ScannerRegistry/RuleEngine\RuleRegistry/etc. -
 * those are a single class implementing one small interface (a plain
 * class-name filter is enough); a module is a whole package (potentially
 * `Module.php` + `Frontend.php`/`Rest.php`/`Admin.php`/`src/`), which is
 * why it needs the heavier folder-scan discovery this class provides
 * instead.
 *
 * @class       Modules class
 * @version     1.0.0
 * @author      VuloLabs
 */
class Modules {

    /**
     * Module ids that changed with their folder name: old id => new id. `load_active_modules()` moves a stored id
     * across, so the module stays on.
     *
     * @var array<string, string>
     */
    const RENAMED_MODULE_IDS = array(
        'shipping-engine' => 'fulfillment',
        'order-documents' => 'pdf-invoices',
    );

    /**
     * Every discovered module, keyed by its kebab-case id (or
     * `{namespace}_{id}` if two sources both register the same id).
     *
     * @var array
     */
    private $modules = array();

    /**
     * Currently active module ids, once loaded.
     *
     * @var array
     */
    private $active_modules = array();

    /**
     * Whether load_active_modules() has already run this request.
     *
     * @var bool
     */
    private static $module_activated = false;

    /**
     * Instantiated active module objects, keyed the same as $modules.
     *
     * @var array
     */
    private $container = array();

    /**
     * Modules the cart and checkout cannot work without. They have no card on the Modules screen and cannot be
     * switched off. Review is one of them: whether the checkout shows its Review step is a setting (Settings →
     * Checkout → Steps shown), not a module. Shipping and Taxes are real options - a store may not need them - so
     * they keep a card.
     */
    const CORE_MODULE_IDS = array( 'cart', 'order', 'customer', 'address', 'payment', 'confirmation', 'review' );

    /**
     * Modules constructor.
     */
    public function __construct() {}

    /**
     * Converts a PascalCase folder name into a kebab-case module id.
     *
     * @param string $string_param e.g. 'ComplianceReports'.
     * @return string e.g. 'compliance-reports'.
     */
    private function camel_to_kebab( string $string_param ): string {
        return strtolower(
            preg_replace(
                '/(?<=[a-z])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])/',
                '-',
                $string_param
            )
        );
    }

    /**
     * Scans every registered module source directory for a `{Folder}/Module.php`
     * and indexes what it finds - this never instantiates anything, see
     * load_active_modules() for that.
     *
     * @return array
     */
    public function get_all_modules(): array {
        if ( ! empty( $this->modules ) ) {
            return $this->modules;
        }

        $sources = apply_filters(
            'vulocart_module_sources',
            array(
                array(
                    'path'      => trailingslashit( VuloCart()->plugin_path . 'modules' ),
                    'namespace' => 'VuloCart',
                ),
            )
        );

        foreach ( $sources as $source ) {
            $base_path = $source['path'];
            $namespace = $source['namespace'];

            if ( ! is_dir( $base_path ) ) {
                continue;
            }

            $folders = scandir( $base_path );

            foreach ( $folders as $folder ) {
                if ( in_array( $folder, array( '.', '..' ), true ) ) {
                    continue;
                }

                $module_file = $base_path . $folder . '/Module.php';

                if ( ! is_dir( $base_path . $folder ) || ! file_exists( $module_file ) ) {
                    continue;
                }

                $module_id = $this->camel_to_kebab( $folder );

                $key = array_key_exists( $module_id, $this->modules )
                    ? $namespace . '_' . $module_id
                    : $module_id;

                $this->modules[ $key ] = array(
                    'id'           => $module_id,
                    'module_file'  => $module_file,
                    'module_class' => "{$namespace}\\{$folder}\\Module",
                );
            }
        }

        return $this->modules;
    }

    /**
     * Returns currently active module ids.
     *
     * @return array Active module ids - from the in-request cache once
     *               load_active_modules() has run, otherwise straight from
     *               the stored option.
     */
    public function get_active_modules() {
        if ( $this->active_modules ) {
            return $this->active_modules;
        }

        return get_option( Utill::ACTIVE_MODULES_DB_KEY, array() );
    }

    /**
     * Instantiates every currently-active, available module - the actual
     * "boot" step. Silently drops (and persists the drop of) any stored
     * active-module id that no longer resolves to a real, available
     * module, e.g. after a folder rename or a Pro deactivation
     * (backward-compatibility.md's module-rename caveat is about the
     * *id* silently no longer matching anything, not about this cleanup
     * step, which is deliberate here).
     *
     * @return void
     */
    public function load_active_modules() {
        if ( self::$module_activated ) {
            return;
        }

        $active_modules = $this->get_active_modules();

        // A module whose folder was renamed keeps its on/off state: its stored id moves to the new one.
        $renamed = array_values( array_unique( array_map( static fn( $id ) => self::RENAMED_MODULE_IDS[ $id ] ?? $id, $active_modules ) ) );

        if ( $renamed !== $active_modules ) {
            $active_modules       = $renamed;
            $this->active_modules = $renamed;
            update_option( Utill::ACTIVE_MODULES_DB_KEY, $renamed );
        }

        // Cart, checkout and its steps are the store itself, not options: they are always on.
        $missing_core = array_diff( self::CORE_MODULE_IDS, $active_modules );

        if ( $missing_core ) {
            $active_modules       = array_values( array_merge( $active_modules, $missing_core ) );
            $this->active_modules = $active_modules;
            update_option( Utill::ACTIVE_MODULES_DB_KEY, $active_modules );
        }

        // Marketing, Product tools, Inventory and AI used to be several cards. A store that had only some of their
        // modules on keeps that feature: its card goes on (and with it, the companions, below).
        foreach ( array( 'coupons', 'bulk-editor', 'inventory', 'ai' ) as $card ) {
            $companions = (array) ( $this->get_companion_map()[ $card ] ?? array() );

            if ( ! in_array( $card, $active_modules, true ) && array_intersect( $companions, $active_modules ) ) {
                $active_modules[]     = $card;
                $this->active_modules = $active_modules;
                update_option( Utill::ACTIVE_MODULES_DB_KEY, $active_modules );
            }
        }

        // A card stands for its module plus the companions that extend it (Shipping → Shipment, Taxes → Stripe Tax and
        // business tax IDs): keep them on together, so a store that switched the card on before the companion existed,
        // or before Pro was licensed, gets the whole feature.
        $with_companions = array();

        $companion_map = $this->get_companion_map();

        foreach ( $active_modules as $module_id ) {
            $with_companions = array_merge( $with_companions, array( $module_id ), (array) ( $companion_map[ $module_id ] ?? array() ) );
        }

        $with_companions = array_values( array_unique( $with_companions ) );

        if ( $with_companions !== $active_modules ) {
            $active_modules       = $with_companions;
            $this->active_modules = $with_companions;
            update_option( Utill::ACTIVE_MODULES_DB_KEY, $with_companions );
        }

        $all_modules    = $this->get_all_modules();

        $validated_active = array();

        foreach ( $active_modules as $module_id ) {
            $resolved = false;

            foreach ( $all_modules as $key => $module ) {
                if ( empty( $module['id'] ) || $module['id'] !== $module_id ) {
                    continue;
                }

                if ( ! $this->is_module_available( $module ) ) {
                    continue;
                }

                require_once $module['module_file'];

                try {
                    $class                   = $module['module_class'];
                    $this->container[ $key ] = new $class();
                } catch ( \Throwable $e ) {
                    VuloCart()->util->log( $e );
                    continue;
                }

                do_action( "vulocart_activated_module_{$module_id}", $this->container[ $key ] );

                $resolved = true;
            }

            if ( $resolved ) {
                $validated_active[] = $module_id;
            }
        }

        if ( $validated_active !== $active_modules ) {
            update_option( Utill::ACTIVE_MODULES_DB_KEY, $validated_active );
            $this->active_modules = $validated_active;
        }

        self::$module_activated = true;
    }

    /**
     * Checks whether a discovered module is still usable.
     *
     * @param array $module One get_all_modules() entry.
     * @return bool False if the module's file vanished, or its own static
     *              `is_compatible()` (module-architecture.md's optional
     *              gate) says no.
     */
    private function is_module_available( $module ) {
        if ( ! file_exists( $module['module_file'] ) ) {
            return false;
        }

        require_once $module['module_file'];

        $class = $module['module_class'];

        if ( class_exists( $class ) && method_exists( $class, 'is_compatible' ) ) {
            if ( ! $class::is_compatible() ) {
                return false;
            }
        }

        return true;
    }

    /**
     * Returns every discovered module's id.
     *
     * @return array Every discovered module's id.
     */
    public function get_all_modules_ids() {
        return array_keys( $this->get_all_modules() );
    }

    /**
     * Returns every discovered module's id that's currently available.
     *
     * @return array Ids of every discovered module that's currently available (file exists, is_compatible() passes).
     */
    public function get_available_modules(): array {
        $available = array();

        foreach ( $this->get_all_modules() as $id => $module ) {
            if ( $this->is_module_available( $module ) ) {
                $available[] = $id;
            }
        }

        return $available;
    }

    /**
     * The companions map: card module => the modules that switch on and off with it. A single Modules-screen card
     * stands for the whole group (the free module plus the Pro modules that extend it, or one feature area made of
     * several modules), so toggling the card toggles all of them. An id that is not available - Pro not installed or
     * not licensed - is simply dropped by the loader.
     *
     * Filter `vulocart_module_companions` lets a plugin add to the map.
     *
     * @return array<string, string[]>
     */
    public function get_companion_map(): array {
        return (array) apply_filters(
            'vulocart_module_companions',
            array(
                'shipping'    => array( 'fulfillment' ),
                'taxes'       => array( 'stripe-tax', 'tax-ids' ),
                'bulk-editor' => array( 'csv-import', 'product-templates' ),
                'mcp'         => array( 'mcp-server' ),
                'coupons'     => array( 'gift-cards', 'pricing-rules', 'abandoned-checkout', 'checkout-links' ),
                'inventory'   => array( 'suppliers' ),
                'ai'          => array( 'catalog-ai', 'checkout-ai', 'support-ai', 'vector-search' ),
            )
        );
    }

    /**
     * Modules that switch on and off together with another one, as a whole group.
     *
     * Asking for a companion (e.g. an old "Gift Cards" prompt) returns the whole group, so activating it turns on the
     * card that owns it rather than one module of the group.
     *
     * @param string $module_id The module the merchant toggled.
     * @return string[] That module plus its companions (or its card and all of that card's companions).
     */
    public function with_companions( string $module_id ): array {
        $map = $this->get_companion_map();

        foreach ( $map as $card => $companions ) {
            if ( in_array( $module_id, (array) $companions, true ) ) {
                $module_id = $card;
                break;
            }
        }

        return array_values( array_unique( array_merge( array( $module_id ), (array) ( $map[ $module_id ] ?? array() ) ) ) );
    }

    /**
     * Adds module ids to the active list and loads them immediately.
     *
     * @param array $modules Module ids to add to the active list.
     * @return array The full, updated active-module id list.
     */
    public function activate_modules( $modules ) {
        $active_modules       = $this->get_active_modules();
        $this->active_modules = array_unique( array_merge( $active_modules, $modules ) );

        update_option( Utill::ACTIVE_MODULES_DB_KEY, $this->active_modules );

        self::$module_activated = false;

        $this->load_active_modules();

        return $this->active_modules;
    }

    /**
     * Removes module ids from the active list.
     *
     * @param array $modules Module ids to remove from the active list.
     * @return array The full, updated active-module id list.
     */
    public function deactivate_modules( array $modules ): array {
        $this->active_modules = array_values(
            array_diff( $this->get_active_modules(), $modules )
        );

        update_option( Utill::ACTIVE_MODULES_DB_KEY, $this->active_modules );

        add_action(
            'shutdown',
            function () use ( $modules ) {
                foreach ( $modules as $module_id ) {
                    if ( isset( $this->container[ $module_id ] ) ) {
                        do_action( "vulocart_deactivated_module_{$module_id}", $this->container[ $module_id ] );
                    }
                }
            }
        );

        return $this->active_modules;
    }

    /**
     * Checks whether a module id is currently available.
     *
     * @param string $module_id A module's id.
     * @return bool
     */
    public function is_available( $module_id ) {
        return in_array( $module_id, $this->get_available_modules(), true );
    }

    /**
     * Checks whether a module id is currently active.
     *
     * @param string $module_id A module's id.
     * @return bool
     */
    public function is_active( $module_id ) {
        return in_array( $module_id, $this->get_active_modules(), true );
    }
}
