<?php
/**
 * ProductTypes class file.
 *
 * @package VuloCart
 */

namespace VuloCart\RestAPI\Controllers;

use VuloCart\Domain\Product\ProductType;

defined( 'ABSPATH' ) || exit;

/**
 * VuloCart ProductTypes REST controller.
 *
 * Backs the Products menu's "Product Types" admin page
 * (`src/pages/ProductTypes/`) - deliberately read-only. Unlike
 * Categories/Brands/Collections/Attributes, a product *type* isn't a
 * merchant-managed record: it's a closed, PHP-registered set
 * (Domain\Product\ProductType's own docblock - "this class is only the closed
 * set of known `type` values") that drives real per-type behavior
 * elsewhere (ProductEdit.tsx's `TYPE_FIELD_CONFIG`,
 * classes/RestAPI/Controllers/Products.php's `TYPE_DETAIL_FIELDS`).
 * WooCommerce doesn't let you create a custom product type from wp-admin
 * either, for the identical reason - this page is a reference/dashboard
 * view (real per-type product counts), not a type builder.
 *
 * @class       ProductTypes class
 * @version     1.0.0
 * @author      VuloLabs
 */
class ProductTypes extends \WP_REST_Controller {

    /**
     * REST base for this controller's routes.
     *
     * @var string
     */
    protected $rest_base = 'product-types';

    /**
     * One short, merchant-facing description per ProductType constant -
     * same hand-maintained-list convention every other small, stable
     * lookup table in this codebase already uses (e.g.
     * src/modules-config.ts's module descriptions).
     *
     * @var array<string, string>
     */
    const DESCRIPTIONS = array(
        'physical'     => 'A tangible item that ships to the buyer - has weight, dimensions, and stock.',
        'digital'      => 'A downloadable file or licensed digital good - no shipping.',
        'subscription' => 'A recurring charge on a billing interval (e.g. monthly, yearly).',
        'course'       => 'Structured lessons a buyer enrolls in.',
        'service'      => 'A time-based service booked or scheduled with the buyer.',
        'membership'   => 'Ongoing access to gated content or benefits.',
        'booking'      => 'A reservable time slot (e.g. an appointment or table).',
        'rental'       => 'A physical item rented for a period, then returned.',
        'bundle'       => 'Multiple products sold together as one purchasable item.',
        'donation'     => 'A buyer-chosen or fixed contribution amount.',
        'gift_card'    => 'A stored-value card redeemable for a future purchase.',
        'license'      => 'A software/content license key.',
    );

    /**
     * Option holding the types a merchant has switched off (everything else is on).
     */
    const DISABLED_OPTION = 'vulocart_disabled_product_types';

    /**
     * Types that cannot be sold without a vulocart-pro module: type => the module and the page that manages it.
     *
     * @var array<string, array{module: string, label: string, page: string, view: string}>
     */
    const PRO_REQUIRED = array(
        'subscription' => array(
            'module' => 'subscriptions',
            'label'  => 'Subscriptions',
            'page'   => 'vulocart-orders',
            'view'   => 'subscriptions',
        ),
        'gift_card'    => array(
            'module' => 'gift-cards',
            'label'  => 'Gift Cards',
            'page'   => 'vulocart-products',
            'view'   => 'gift-cards',
        ),
    );

    /**
     * Pro pages that add to a type without being required for it: type => list of pages. Pricing Rules can target
     * any type, so it is listed for all of them (see `pro_extras()`).
     *
     * @var array<string, array<int, array{label: string, page: string, view: string}>>
     */
    const PRO_EXTRAS = array(
        'physical'   => array(
            array( 'label' => 'Warehouses', 'page' => 'vulocart-inventory', 'view' => 'warehouses' ),
            array( 'label' => 'Shipping zones', 'page' => 'vulocart-shipping', 'view' => 'zones' ),
        ),
        'rental'     => array(
            array( 'label' => 'Warehouses', 'page' => 'vulocart-inventory', 'view' => 'warehouses' ),
            array( 'label' => 'Shipping zones', 'page' => 'vulocart-shipping', 'view' => 'zones' ),
        ),
        'bundle'     => array(
            array( 'label' => 'Warehouses', 'page' => 'vulocart-inventory', 'view' => 'warehouses' ),
            array( 'label' => 'Shipping zones', 'page' => 'vulocart-shipping', 'view' => 'zones' ),
        ),
        'membership' => array(
            array( 'label' => 'Customer groups', 'page' => 'vulocart-customers', 'view' => 'groups' ),
        ),
    );

    /**
     * The Settings screen that configures a type, where one applies: type => Settings subtab and its label.
     *
     * @var array<string, array{label: string, subtab: string}>
     */
    const SETTINGS = array(
        'physical'     => array( 'label' => 'Shipping settings', 'subtab' => 'shipping' ),
        'rental'       => array( 'label' => 'Shipping settings', 'subtab' => 'shipping' ),
        'bundle'       => array( 'label' => 'Shipping settings', 'subtab' => 'shipping' ),
        'subscription' => array( 'label' => 'Payment settings', 'subtab' => 'payments' ),
    );

    /**
     * Every Pro page related to a type: its own extras plus Pricing Rules, which applies to all types.
     *
     * @param string $type Product type.
     * @return array<int, array{label: string, page: string, view: string}>
     */
    private static function pro_extras( string $type ): array {
        return array_merge(
            self::PRO_EXTRAS[ $type ] ?? array(),
            array( array( 'label' => 'Pricing rules', 'page' => 'vulocart-products', 'view' => 'pricing-rules' ) )
        );
    }

    /**
     * The types switched off, as a clean list of known type values.
     *
     * @return string[]
     */
    public static function disabled_types(): array {
        $stored = get_option( self::DISABLED_OPTION, array() );

        return is_array( $stored ) ? array_values( array_intersect( ProductType::all(), $stored ) ) : array();
    }

    /**
     * Registers this controller's REST routes.
     *
     * @return void
     */
    public function register_routes() {
        register_rest_route(
            VuloCart()->rest_namespace,
            '/' . $this->rest_base,
            array(
                'methods'             => \WP_REST_Server::READABLE,
                'callback'            => array( $this, 'get_items' ),
                'permission_callback' => array( $this, 'admin_permissions_check' ),
            )
        );

        register_rest_route(
            VuloCart()->rest_namespace,
            '/' . $this->rest_base . '/(?P<type>[a-z_]+)',
            array(
                'methods'             => \WP_REST_Server::EDITABLE,
                'callback'            => array( $this, 'update_item' ),
                'permission_callback' => array( $this, 'admin_permissions_check' ),
            )
        );
    }

    /**
     * Switches one product type on or off. Existing products of a type that is switched off keep working;
     * the type just stops being offered when creating one. At least one type always stays on.
     *
     * @param \WP_REST_Request $request Full request object.
     * @return \WP_REST_Response|\WP_Error
     */
    public function update_item( $request ) {
        $type = sanitize_key( (string) $request->get_param( 'type' ) );

        if ( ! in_array( $type, ProductType::all(), true ) ) {
            return new \WP_Error( 'vulocart_unknown_product_type', esc_html__( 'Unknown product type.', 'vulocart' ), array( 'status' => 404 ) );
        }

        $disabled = self::disabled_types();

        if ( rest_sanitize_boolean( $request->get_param( 'enabled' ) ) ) {
            $disabled = array_values( array_diff( $disabled, array( $type ) ) );
        } else {
            $disabled = array_values( array_unique( array_merge( $disabled, array( $type ) ) ) );

            if ( count( $disabled ) >= count( ProductType::all() ) ) {
                return new \WP_Error( 'vulocart_last_product_type', esc_html__( 'At least one product type must stay enabled.', 'vulocart' ), array( 'status' => 400 ) );
            }
        }

        update_option( self::DISABLED_OPTION, $disabled );

        return $this->get_items( $request );
    }

    /**
     * Checks whether the current user can view the Product Types page.
     *
     * @return bool
     */
    public function admin_permissions_check() {
        return current_user_can( 'manage_options' );
    }

    /**
     * Lists every ProductType with its description and a real, live count
     * of products currently using it.
     *
     * @param \WP_REST_Request $request Full request object.
     * @return \WP_REST_Response
     */
    public function get_items( $request ) { // phpcs:ignore Generic.CodeAnalysis.UnusedFunctionParameter.Found
        $counts = VuloCart()->product_service->count_products_by_type();

        $disabled = self::disabled_types();
        $types    = array_map(
            function ( $type ) use ( $counts, $disabled ) {
                return array(
                    'type'           => $type,
                    'description'    => self::DESCRIPTIONS[ $type ] ?? '',
                    'product_count' => isset( $counts[ $type ] ) ? $counts[ $type ] : 0,
                    'enabled'        => ! in_array( $type, $disabled, true ),
                    'pro'            => self::PRO_REQUIRED[ $type ] ?? null,
                    'pro_extras'     => self::pro_extras( $type ),
                    'settings'       => self::SETTINGS[ $type ] ?? null,
                );
            },
            ProductType::all()
        );

        return rest_ensure_response( $types );
    }
}
