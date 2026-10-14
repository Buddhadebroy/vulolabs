<?php
/**
 * Products class file.
 *
 * @package VuloCart
 */

namespace VuloCart\RestAPI\Controllers;

use VuloCart\Application\PriceCatalog;
use VuloCart\Domain\Product\Product;
use VuloCart\Domain\Product\ProductType;

defined( 'ABSPATH' ) || exit;

/**
 * VuloCart Products REST controller.
 *
 * `GET /vulocart/v1/products` (paginated) and `POST /vulocart/v1/products`.
 * Calls VuloCart()->product_service only - never
 * Infrastructure\Database\WPDBProductRepository directly (rest-api.md +
 * this plugin's own Application-layer convention).
 *
 * @class       Products class
 * @version     1.0.0
 * @author      VuloLabs
 */
class Products extends \WP_REST_Controller {

    /**
     * REST base for this controller's routes.
     *
     * @var string
     */
    protected $rest_base = 'products';

    /**
     * The type-specific fields ProductEdit.tsx's "Type Details" card shows
     * per product type - a real, per-type functionality layer on top of
     * the generic fields every type already has (title/price/description/
     * etc.), matching how WooCommerce's simple/variable/grouped/external
     * product types each expose different meta-box fields. Keyed by
     * ProductType constant, each value maps a field name to how it's
     * sanitized: 'text' (sanitize_text_field), 'int' (absint-able,
     * nullable), 'float' (nullable), 'bool', or 'key' (sanitize_key,
     * for a small fixed option set the frontend's own SelectInput
     * enumerates). Types with no entry here (physical, license) have no
     * type-specific fields - physical's "type-specific" behavior is
     * already the existing Stock/Shipping sections, and license has no
     * dedicated fields yet (kept only for backward compatibility with any
     * product created before this plugin's admin-UX brief specified its own
     * 11-type list, which doesn't include license).
     *
     * @var array<string, array<string, string>>
     */
    const TYPE_DETAIL_FIELDS = array(
        'physical'     => array(
            'release_date'   => 'text',
            'preorder_limit' => 'int',
            'lead_time_days' => 'int',
        ),
        'digital'      => array(
            'download_url'         => 'text',
            'download_limit'       => 'int',
            'download_expiry_days' => 'int',
            'activations_limit'    => 'int',
            'validity_days'        => 'int',
            'access_url'           => 'text',
        ),
        'subscription' => array(
            'billing_interval'           => 'key',
            'trial_period_days'          => 'int',
            'subscription_length_cycles' => 'int',
        ),
        'course'       => array(
            'lesson_count'     => 'int',
            'duration_hours'   => 'int',
            'skill_level'      => 'key',
            'enrollment_limit' => 'int',
            'start_date'       => 'text',
            'live_sessions'    => 'int',
        ),
        'service'      => array(
            'duration_minutes' => 'int',
            'location_type'    => 'key',
            'delivery_days'    => 'int',
            'revisions'        => 'int',
        ),
        'membership'   => array(
            'membership_duration_days' => 'int',
            'renewal_type'             => 'key',
        ),
        'booking'      => array(
            'slot_duration_minutes'  => 'int',
            'max_attendees_per_slot' => 'int',
            'event_date'             => 'text',
            'venue'                  => 'text',
            'capacity'               => 'int',
        ),
        'rental'       => array(
            'rental_period'    => 'key',
            'deposit_amount'   => 'float',
            'late_fee_per_day' => 'float',
            'capacity'         => 'int',
        ),
        'bundle'       => array(
            'bundle_items' => 'text',
            'pick_count'   => 'int',
        ),
        'donation'     => array(
            'suggested_amounts'   => 'text',
            'allow_custom_amount' => 'bool',
            'goal_amount'         => 'float',
        ),
        'gift_card'    => array(
            'denominations' => 'text',
            'expiry_days'   => 'int',
        ),
    );

    /**
     * The subtypes each type offers (first = default). `meta.subtype` is kept only if it belongs to the product's type;
     * the editor's typeProfiles.ts lists the same values with their labels and the cards each one needs.
     */
    const SUBTYPES = array(
        'physical'     => array( 'standard', 'variable', 'preorder', 'made_to_order' ),
        'digital'      => array( 'download', 'software', 'access' ),
        'subscription' => array( 'access', 'box' ),
        'course'       => array( 'self_paced', 'cohort' ),
        'service'      => array( 'project', 'session' ),
        'membership'   => array( 'fixed_term', 'recurring', 'lifetime' ),
        'booking'      => array( 'appointment', 'class', 'event' ),
        'rental'       => array( 'equipment', 'space' ),
        'bundle'       => array( 'fixed', 'mix_and_match' ),
        'donation'     => array( 'general', 'campaign' ),
        'gift_card'    => array( 'digital', 'physical' ),
        'license'      => array( 'standard' ),
    );

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
                array(
                    'methods'             => \WP_REST_Server::READABLE,
                    'callback'            => array( $this, 'get_items' ),
                    'permission_callback' => array( $this, 'get_items_permissions_check' ),
                ),
                array(
                    'methods'             => \WP_REST_Server::CREATABLE,
                    'callback'            => array( $this, 'create_item' ),
                    'permission_callback' => array( $this, 'create_item_permissions_check' ),
                ),
            )
        );

        register_rest_route(
            VuloCart()->rest_namespace,
            '/' . $this->rest_base . '/(?P<id>\d+)',
            array(
                array(
                    'methods'             => \WP_REST_Server::READABLE,
                    'callback'            => array( $this, 'get_item' ),
                    'permission_callback' => array( $this, 'get_items_permissions_check' ),
                ),
                array(
                    'methods'             => \WP_REST_Server::EDITABLE,
                    'callback'            => array( $this, 'update_item' ),
                    'permission_callback' => array( $this, 'create_item_permissions_check' ),
                ),
                array(
                    'methods'             => \WP_REST_Server::DELETABLE,
                    'callback'            => array( $this, 'delete_item' ),
                    'permission_callback' => array( $this, 'create_item_permissions_check' ),
                ),
            )
        );

        // Bulk endpoints - the Products list screen's bulk-actions bar
        // (src/pages/Products/ProductsList.tsx). Registered as their own
        // routes rather than teaching update_item()/delete_item() to accept
        // an array of ids, matching Order\Rest.php's own
        // `orders/bulk-payment-status`/`orders/bulk-fulfillment-status`
        // precedent (one route per bulk operation, same permission gate as
        // the single-item mutation it bulk-applies).
        register_rest_route(
            VuloCart()->rest_namespace,
            '/' . $this->rest_base . '/bulk-status',
            array(
                'methods'             => \WP_REST_Server::EDITABLE,
                'callback'            => array( $this, 'bulk_update_status' ),
                'permission_callback' => array( $this, 'create_item_permissions_check' ),
            )
        );

        register_rest_route(
            VuloCart()->rest_namespace,
            '/' . $this->rest_base . '/bulk-price',
            array(
                'methods'             => \WP_REST_Server::EDITABLE,
                'callback'            => array( $this, 'bulk_update_price' ),
                'permission_callback' => array( $this, 'create_item_permissions_check' ),
            )
        );

        register_rest_route(
            VuloCart()->rest_namespace,
            '/' . $this->rest_base . '/bulk-stock',
            array(
                'methods'             => \WP_REST_Server::EDITABLE,
                'callback'            => array( $this, 'bulk_update_stock' ),
                'permission_callback' => array( $this, 'create_item_permissions_check' ),
            )
        );

        register_rest_route(
            VuloCart()->rest_namespace,
            '/' . $this->rest_base . '/bulk-delete',
            array(
                'methods'             => \WP_REST_Server::DELETABLE,
                'callback'            => array( $this, 'bulk_delete' ),
                'permission_callback' => array( $this, 'create_item_permissions_check' ),
            )
        );

        register_rest_route(
            VuloCart()->rest_namespace,
            '/' . $this->rest_base . '/(?P<id>\d+)/duplicate',
            array(
                'methods'             => \WP_REST_Server::CREATABLE,
                'callback'            => array( $this, 'duplicate_item' ),
                'permission_callback' => array( $this, 'create_item_permissions_check' ),
            )
        );
    }

    /**
     * Copies a product into a new draft: same type, price, currency and details, the title ending in "(Copy)", and no
     * SKU (a SKU is unique to one product).
     *
     * @param \WP_REST_Request $request Full request object.
     * @return \WP_REST_Response|\WP_Error
     */
    public function duplicate_item( $request ) {
        $source = VuloCart()->product_service->get_product( absint( $request->get_param( 'id' ) ) );

        if ( ! $source ) {
            return new \WP_Error( 'vulocart_product_not_found', esc_html__( 'No product exists with this id.', 'vulocart' ), array( 'status' => 404 ) );
        }

        $meta = (array) $source->meta;
        unset( $meta['featured'] );

        $copy = VuloCart()->product_service->create_product(
            array(
                'type'     => $source->type,
                /* translators: %s: original product title. */
                'title'    => sprintf( esc_html__( '%s (Copy)', 'vulocart' ), $source->title ),
                'sku'      => null,
                'status'   => 'draft',
                'price'    => $source->price,
                'currency' => $source->currency,
                'meta'     => $meta,
            )
        );

        $response = rest_ensure_response(
            array(
                'id'    => $copy->id,
                'title' => $copy->title,
            )
        );
        $response->set_status( 201 );

        return $response;
    }

    /**
     * Reads and validates the `ids` param every bulk endpoint takes.
     *
     * @param \WP_REST_Request $request Full request object.
     * @return int[]|\WP_Error
     */
    private function get_bulk_ids( $request ) {
        $ids = $request->get_param( 'ids' );

        if ( ! is_array( $ids ) || empty( $ids ) ) {
            return new \WP_Error(
                'vulocart_missing_product_ids',
                esc_html__( 'At least one product id is required.', 'vulocart' ),
                array( 'status' => 400 )
            );
        }

        return array_values( array_filter( array_map( 'absint', $ids ) ) );
    }

    /**
     * Bulk-updates status (e.g. publish/draft/archive several products at
     * once from the list screen's bulk-actions dropdown).
     *
     * @param \WP_REST_Request $request Full request object.
     * @return \WP_REST_Response|\WP_Error
     */
    public function bulk_update_status( $request ) {
        $ids = $this->get_bulk_ids( $request );

        if ( is_wp_error( $ids ) ) {
            return $ids;
        }

        $status = sanitize_key( (string) $request->get_param( 'status' ) );

        if ( '' === $status ) {
            return new \WP_Error( 'vulocart_missing_status', esc_html__( 'A status is required.', 'vulocart' ), array( 'status' => 400 ) );
        }

        $updated = VuloCart()->product_service->bulk_update_status( $ids, $status );

        return rest_ensure_response( array( 'updated' => $updated ) );
    }

    /**
     * Bulk-sets price and/or sale price across several products -
     * "Bulk Price Update". At least one of `price`/`sale_price` must be
     * present; either can be sent alone.
     *
     * @param \WP_REST_Request $request Full request object.
     * @return \WP_REST_Response|\WP_Error
     */
    public function bulk_update_price( $request ) {
        $ids = $this->get_bulk_ids( $request );

        if ( is_wp_error( $ids ) ) {
            return $ids;
        }

        if ( null === $request->get_param( 'price' ) && null === $request->get_param( 'sale_price' ) ) {
            return new \WP_Error( 'vulocart_missing_price', esc_html__( 'A price or sale price is required.', 'vulocart' ), array( 'status' => 400 ) );
        }

        $price      = null !== $request->get_param( 'price' ) ? (float) $request->get_param( 'price' ) : null;
        $sale_price = null !== $request->get_param( 'sale_price' ) ? (float) $request->get_param( 'sale_price' ) : null;

        $updated = VuloCart()->product_service->bulk_update_price( $ids, $price, $sale_price );

        return rest_ensure_response( array( 'updated' => $updated ) );
    }

    /**
     * Bulk-sets stock status and/or stock quantity across several
     * products - "Bulk Inventory Update". Same fields Inventory.php's own
     * single-item `PATCH /inventory/{id}` already writes into
     * `meta.stock_status`/`meta.stock_quantity`, applied to many products
     * at once here instead.
     *
     * @param \WP_REST_Request $request Full request object.
     * @return \WP_REST_Response|\WP_Error
     */
    public function bulk_update_stock( $request ) {
        $ids = $this->get_bulk_ids( $request );

        if ( is_wp_error( $ids ) ) {
            return $ids;
        }

        if ( null === $request->get_param( 'stock_status' ) && null === $request->get_param( 'stock_quantity' ) ) {
            return new \WP_Error( 'vulocart_missing_stock_fields', esc_html__( 'A stock status or quantity is required.', 'vulocart' ), array( 'status' => 400 ) );
        }

        $stock_status = null;

        if ( null !== $request->get_param( 'stock_status' ) ) {
            $candidate = sanitize_key( (string) $request->get_param( 'stock_status' ) );

            if ( ! in_array( $candidate, array( 'in_stock', 'out_of_stock', 'backorder' ), true ) ) {
                return new \WP_Error( 'vulocart_invalid_stock_status', esc_html__( 'Invalid stock status.', 'vulocart' ), array( 'status' => 400 ) );
            }

            $stock_status = $candidate;
        }

        $stock_quantity = null !== $request->get_param( 'stock_quantity' ) ? max( 0, absint( $request->get_param( 'stock_quantity' ) ) ) : null;

        $updated = VuloCart()->product_service->bulk_update_stock( $ids, $stock_status, $stock_quantity );

        return rest_ensure_response( array( 'updated' => $updated ) );
    }

    /**
     * Bulk-deletes products.
     *
     * @param \WP_REST_Request $request Full request object.
     * @return \WP_REST_Response|\WP_Error
     */
    public function bulk_delete( $request ) {
        $ids = $this->get_bulk_ids( $request );

        if ( is_wp_error( $ids ) ) {
            return $ids;
        }

        $deleted = VuloCart()->product_service->bulk_delete( $ids );

        return rest_ensure_response( array( 'deleted' => $deleted ) );
    }

    /**
     * Deletes a single product - the Products list screen's per-row
     * delete action.
     *
     * @param \WP_REST_Request $request Full request object.
     * @return \WP_REST_Response|\WP_Error
     */
    public function delete_item( $request ) {
        $deleted = VuloCart()->product_service->delete_product( absint( $request->get_param( 'id' ) ) );

        if ( ! $deleted ) {
            return new \WP_Error( 'vulocart_product_not_found', esc_html__( 'No product exists with this id.', 'vulocart' ), array( 'status' => 404 ) );
        }

        return rest_ensure_response( array( 'deleted' => true ) );
    }

    /**
     * Whether product listing is open to everyone - genuinely public read
     * access, same "cart token is the access control, not a nonce"
     * posture RestAPI\Controllers\Cart's docblock explains for a
     * different reason: a storefront checkout page (src/blocks/checkout)
     * has no WordPress session at all and still needs to browse products to
     * add them to a cart. get_items() itself is what keeps this safe -
     * it force-scopes results to `status = published` for anyone without
     * `manage_options`, so a logged-out visitor can never see (or infer
     * the existence of) a draft/archived product just by passing a
     * different `status` query param.
     *
     * @param \WP_REST_Request $request Full request object.
     * @return bool
     */
    public function get_items_permissions_check( $request ) { // phpcs:ignore Generic.CodeAnalysis.UnusedFunctionParameter.Found
        return true;
    }

    /**
     * Checks whether the current user can create a product.
     *
     * @param \WP_REST_Request $request Full request object.
     * @return bool
     */
    public function create_item_permissions_check( $request ) { // phpcs:ignore Generic.CodeAnalysis.UnusedFunctionParameter.Found
        return current_user_can( 'manage_options' );
    }

    /**
     * Every price of a product with what a storefront needs to show and sell it: the amount it charges now (sale
     * amount when lower) and whether the cart will accept it at all (it can be inactive, or belong to a price type
     * whose plugin is off).
     *
     * @param Product $product Product to read prices from.
     * @return array<int, array<string, mixed>>
     */
    private function prepare_prices_for_response( Product $product ): array {
        return array_map(
            static function ( $price ) {
                $price['display_amount'] = Product::price_amount( $price );
                $price['purchasable']    = PriceCatalog::is_purchasable( $price );

                return $price;
            },
            $product->prices()
        );
    }

    /**
     * Converts a domain Product into the REST response shape.
     *
     * @param Product $product Product to convert to a REST response shape.
     * @return array<string, mixed>
     */
    private function prepare_product_for_response( Product $product ): array {
        return array(
            'id'         => $product->id,
            'type'       => $product->type,
            'title'      => $product->title,
            'slug'       => $product->slug,
            'sku'        => $product->sku,
            'status'     => $product->status,
            'price'      => $product->price,
            'currency'   => $product->currency,
            'meta'       => $product->meta,
            'prices'     => $this->prepare_prices_for_response( $product ),
            'created_at' => $product->created_at,
            'updated_at' => $product->updated_at,
            'published_at' => $product->published_at,
        );
    }

    /**
     * Lists products, paginated.
     *
     * @param \WP_REST_Request $request Full request object.
     * @return \WP_REST_Response
     */
    public function get_items( $request ) {
        $page_param     = $request->get_param( 'page' );
        $per_page_param = $request->get_param( 'per_page' );

        $page     = absint( $page_param ? $page_param : 1 );
        $per_page = absint( $per_page_param ? $per_page_param : 20 );
        $type     = sanitize_key( (string) $request->get_param( 'type' ) );
        $status   = sanitize_key( (string) $request->get_param( 'status' ) );
        $search   = sanitize_text_field( (string) $request->get_param( 'search' ) );
        $category = sanitize_key( (string) $request->get_param( 'category' ) );

        // Anyone without manage_options is a public storefront request
        // (see get_items_permissions_check()'s docblock) - force
        // `published` regardless of what `status` they passed, so a
        // logged-out visitor can never list/discover draft or archived
        // products by guessing a different status value.
        if ( ! current_user_can( 'manage_options' ) ) {
            $status = 'published';
        }

        $result = VuloCart()->product_service->list_products(
            array(
                'page'     => $page,
                'per_page' => $per_page,
                'type'     => $type,
                'status'   => $status,
                'search'   => $search,
                'category' => $category,
            )
        );

        $response = rest_ensure_response( array_map( array( $this, 'prepare_product_for_response' ), $result['data'] ) );
        $response->header( 'X-WP-Total', (string) $result['total'] );
        $response->header( 'X-WP-TotalPages', (string) ceil( $result['total'] / max( 1, $per_page ) ) );

        return $response;
    }

    /**
     * Fetches one product by id - backs the dedicated
     * `src/pages/Products/ProductEdit.tsx` page loading its initial data
     * directly from the URL's `id` query param (a real navigation, not a
     * client-side transition carrying the row already in memory - see
     * Menu.php's `add_products_menu()` docblock), so a fresh page load
     * needs a single-item lookup rather than only the list endpoint.
     * Same public-with-published-only-for-non-admins posture as
     * get_items() - see get_items_permissions_check()'s docblock.
     *
     * @param \WP_REST_Request $request Full request object.
     * @return \WP_REST_Response|\WP_Error
     */
    public function get_item( $request ) {
        $product = VuloCart()->product_service->get_product( absint( $request->get_param( 'id' ) ) );

        if ( ! $product ) {
            return new \WP_Error( 'vulocart_product_not_found', esc_html__( 'No product exists with this id.', 'vulocart' ), array( 'status' => 404 ) );
        }

        if ( ! current_user_can( 'manage_options' ) && 'published' !== $product->status ) {
            return new \WP_Error( 'vulocart_product_not_found', esc_html__( 'No product exists with this id.', 'vulocart' ), array( 'status' => 404 ) );
        }

        return rest_ensure_response( $this->prepare_product_for_response( $product ) );
    }

    /**
     * Creates a new product.
     *
     * @param \WP_REST_Request $request Full request object.
     * @return \WP_REST_Response|\WP_Error
     */
    public function create_item( $request ) {
        $type = sanitize_key( (string) $request->get_param( 'type' ) );

        if ( ! in_array( $type, ProductType::all(), true ) ) {
            return new \WP_Error(
                'vulocart_invalid_product_type',
                esc_html__( 'Invalid product type.', 'vulocart' ),
                array( 'status' => 400 )
            );
        }

        $title = sanitize_text_field( (string) $request->get_param( 'title' ) );

        if ( '' === $title ) {
            return new \WP_Error(
                'vulocart_missing_product_title',
                esc_html__( 'A product title is required.', 'vulocart' ),
                array( 'status' => 400 )
            );
        }

        $data = array(
            'type'  => $type,
            'title' => $title,
        );

        if ( null !== $request->get_param( 'sku' ) ) {
            $data['sku'] = sanitize_text_field( (string) $request->get_param( 'sku' ) );
        }

        $invalid = $this->validate_sku_and_price( $request, 0 );

        if ( $invalid ) {
            return $invalid;
        }

        if ( null !== $request->get_param( 'status' ) ) {
            $data['status'] = sanitize_key( (string) $request->get_param( 'status' ) );
        }

        if ( null !== $request->get_param( 'price' ) ) {
            $data['price'] = (float) $request->get_param( 'price' );
        }

        if ( null !== $request->get_param( 'currency' ) ) {
            $data['currency'] = sanitize_text_field( (string) $request->get_param( 'currency' ) );
        }

        if ( is_array( $request->get_param( 'meta' ) ) ) {
            $data['meta'] = $this->sanitize_product_meta( $request->get_param( 'meta' ), $type );

            list( $column_price, $data['meta'] ) = PriceCatalog::reconcile( isset( $data['price'] ) ? $data['price'] : null, $data['meta'] );

            if ( null !== $column_price ) {
                $data['price'] = $column_price;
            }
        }

        $product = VuloCart()->product_service->create_product( $data );

        $response = rest_ensure_response( $this->prepare_product_for_response( $product ) );
        $response->set_status( 201 );

        return $response;
    }

    /**
     * Updates an existing product - backs the Products table's inline cell
     * editing (title/sku/status/price) in src/app/routes/ProductsPage.tsx.
     * Only ever touches the fields actually present on the request, via
     * Application\ProductService::update_product()'s own partial-update
     * semantics - a cell edit for one field never clobbers the others.
     *
     * @param \WP_REST_Request $request Full request object.
     * @return \WP_REST_Response|\WP_Error
     */
    public function update_item( $request ) {
        $id = absint( $request->get_param( 'id' ) );

        $existing_product = VuloCart()->product_service->get_product( $id );

        if ( ! $existing_product ) {
            return new \WP_Error(
                'vulocart_product_not_found',
                esc_html__( 'No product exists with this id.', 'vulocart' ),
                array( 'status' => 404 )
            );
        }

        $data = array();

        if ( null !== $request->get_param( 'type' ) ) {
            $type = sanitize_key( (string) $request->get_param( 'type' ) );

            if ( ! in_array( $type, ProductType::all(), true ) ) {
                return new \WP_Error(
                    'vulocart_invalid_product_type',
                    esc_html__( 'Invalid product type.', 'vulocart' ),
                    array( 'status' => 400 )
                );
            }

            $data['type'] = $type;
        }

        if ( null !== $request->get_param( 'title' ) ) {
            $title = sanitize_text_field( (string) $request->get_param( 'title' ) );

            if ( '' === $title ) {
                return new \WP_Error(
                    'vulocart_missing_product_title',
                    esc_html__( 'A product title is required.', 'vulocart' ),
                    array( 'status' => 400 )
                );
            }

            $data['title'] = $title;
        }

        if ( null !== $request->get_param( 'sku' ) ) {
            $data['sku'] = sanitize_text_field( (string) $request->get_param( 'sku' ) );
        }

        $invalid = $this->validate_sku_and_price( $request, $id );

        if ( $invalid ) {
            return $invalid;
        }

        if ( null !== $request->get_param( 'status' ) ) {
            $data['status'] = sanitize_key( (string) $request->get_param( 'status' ) );
        }

        if ( null !== $request->get_param( 'price' ) ) {
            $data['price'] = (float) $request->get_param( 'price' );
        }

        if ( null !== $request->get_param( 'currency' ) ) {
            $data['currency'] = sanitize_text_field( (string) $request->get_param( 'currency' ) );
        }

        if ( is_array( $request->get_param( 'meta' ) ) ) {
            $effective_type = isset( $data['type'] ) ? $data['type'] : $existing_product->type;
            $data['meta']   = $this->sanitize_product_meta( $request->get_param( 'meta' ), $effective_type );

            list( $column_price, $data['meta'] ) = PriceCatalog::reconcile( isset( $data['price'] ) ? $data['price'] : null, $data['meta'] );

            if ( null !== $column_price ) {
                $data['price'] = $column_price;
            }
        }

        $product = VuloCart()->product_service->update_product( $id, $data );

        return rest_ensure_response( $this->prepare_product_for_response( $product ) );
    }

    /**
     * Rejects a negative price and a SKU another product already uses.
     *
     * @param \WP_REST_Request $request    Full request object.
     * @param int              $exclude_id Product being updated (0 when creating).
     * @return \WP_Error|null Null when both are fine.
     */
    private function validate_sku_and_price( $request, $exclude_id ) {
        global $wpdb;

        if ( null !== $request->get_param( 'price' ) && (float) $request->get_param( 'price' ) < 0 ) {
            return new \WP_Error( 'vulocart_invalid_price', esc_html__( 'The price cannot be negative.', 'vulocart' ), array( 'status' => 400 ) );
        }

        $sku = null !== $request->get_param( 'sku' ) ? sanitize_text_field( (string) $request->get_param( 'sku' ) ) : '';

        if ( '' === $sku ) {
            return null;
        }

        $table = $wpdb->prefix . 'vulocart_products';
        $taken = $wpdb->get_var( $wpdb->prepare( "SELECT id FROM {$table} WHERE sku = %s AND id <> %d LIMIT 1", $sku, (int) $exclude_id ) ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared

        if ( $taken ) {
            return new \WP_Error( 'vulocart_duplicate_sku', esc_html__( 'Another product already uses this SKU.', 'vulocart' ), array( 'status' => 409 ) );
        }

        return null;
    }

    /**
     * Sanitizes the product-detail-page's meta bag - a whitelist rather
     * than a generic recursive sanitizer, since this meta shape now holds
     * mixed types (bools, nested media objects, string arrays), not just
     * flat strings `map_deep(..., 'sanitize_text_field')` could handle
     * safely. Backs `src/pages/Products/ProductEdit.tsx`'s full
     * WooCommerce/Shopify-style edit screen - short/full description,
     * sale price, stock management, delivery method, package dimensions,
     * policies, simple related/add-on product lists (comma-separated ids,
     * no picker UI yet), featured/catalog-visibility flags, category/tag/
     * brand/collection references (real DB-backed Domain\Term\Term slugs -
     * classes/RestAPI/Controllers/Terms.php - stored by slug in this meta
     * bag rather than a join table, same tradeoff WPDBTermRepository::
     * count_products_for_term()'s own docblock explains), and featured
     * image/gallery (real `wp.media()` attachment id + url pairs, via
     * zyra's `FileInput`). Unknown keys are silently dropped - this is
     * deliberately whitelist-based, not "sanitize whatever keys show up.".
     *
     * @param array<string, mixed> $meta Raw meta payload from the request.
     * @param string               $type The product's type - determines which TYPE_DETAIL_FIELDS entry (if any) governs `meta.type_details`.
     * @return array<string, mixed>
     */
    private function sanitize_product_meta( $meta, $type ) {
        if ( ! is_array( $meta ) ) {
            return array();
        }

        $sanitized = array();

        // `seo_title` alongside `weight`/`length`/etc. - a plain scalar
        // field, same "already allowlisted, just unused until now"
        // reasoning `weight`'s own docblock documents. Authored by
        // vulocart-pro's CatalogAi module (`generate_seo()`), but the
        // allowlist itself has to live here regardless of which module
        // ends up writing to it - the same reason `weight` isn't
        // allowlisted only when ShippingEngine happens to be active.
        $text_fields = array( 'weight', 'length', 'width', 'height', 'shipping_class', 'related_products', 'addon_products', 'seo_title' );

        foreach ( $text_fields as $key ) {
            if ( isset( $meta[ $key ] ) ) {
                $sanitized[ $key ] = sanitize_text_field( (string) $meta[ $key ] );
            }
        }

        if ( isset( $meta['subtype'] ) && isset( self::SUBTYPES[ $type ] ) && in_array( $meta['subtype'], self::SUBTYPES[ $type ], true ) ) {
            $sanitized['subtype'] = $meta['subtype'];
        }

        $textarea_fields = array( 'short_description', 'full_description', 'shipping_policy', 'refund_policy', 'cancellation_policy', 'seo_description' );

        foreach ( $textarea_fields as $key ) {
            if ( isset( $meta[ $key ] ) ) {
                $sanitized[ $key ] = sanitize_textarea_field( (string) $meta[ $key ] );
            }
        }

        // The price list (Application\PriceCatalog explains the shape and which types exist).
        if ( isset( $meta['prices'] ) ) {
            $prices = PriceCatalog::sanitize( $meta['prices'] );

            if ( $prices ) {
                $sanitized['prices'] = $prices;
            }
        }

        if ( array_key_exists( 'sale_price', $meta ) ) {
            $sanitized['sale_price'] = ( '' === $meta['sale_price'] || null === $meta['sale_price'] ) ? null : (float) $meta['sale_price'];
        }

        if ( isset( $meta['stock_management'] ) ) {
            $sanitized['stock_management'] = (bool) $meta['stock_management'];
        }

        if ( isset( $meta['stock_status'] ) && in_array( $meta['stock_status'], array( 'in_stock', 'out_of_stock', 'backorder' ), true ) ) {
            $sanitized['stock_status'] = $meta['stock_status'];
        }

        if ( array_key_exists( 'stock_quantity', $meta ) ) {
            $sanitized['stock_quantity'] = ( '' === $meta['stock_quantity'] || null === $meta['stock_quantity'] ) ? null : max( 0, absint( $meta['stock_quantity'] ) );
        }

        if ( isset( $meta['delivery_method'] ) && in_array( $meta['delivery_method'], array( 'physical', 'downloadable', 'digital_service', 'other' ), true ) ) {
            $sanitized['delivery_method'] = $meta['delivery_method'];
        }

        if ( isset( $meta['featured'] ) ) {
            $sanitized['featured'] = (bool) $meta['featured'];
        }

        if ( isset( $meta['catalog_visibility'] ) && in_array( $meta['catalog_visibility'], array( 'shop_and_search', 'shop_only', 'search_only', 'hidden' ), true ) ) {
            $sanitized['catalog_visibility'] = $meta['catalog_visibility'];
        }

        if ( isset( $meta['categories'] ) && is_array( $meta['categories'] ) ) {
            $sanitized['categories'] = array_values( array_map( 'sanitize_key', $meta['categories'] ) );
        }

        // Domain\Term\Taxonomy::TAG - same slug-in-meta reference as
        // categories/brand/collections just below (Taxonomy::TAG's own
        // docblock explains the freetext-to-taxonomy promotion and its
        // backward-compat tradeoff).
        if ( isset( $meta['tags'] ) && is_array( $meta['tags'] ) ) {
            $sanitized['tags'] = array_values( array_map( 'sanitize_key', $meta['tags'] ) );
        }

        // Brand/Collections - Domain\Term\Taxonomy::BRAND/COLLECTION,
        // referenced by slug the same way `categories`/`tags` already are
        // above (WPDBTermRepository::count_products_for_term()'s own
        // docblock explains why a slug-in-meta reference, not a join
        // table).
        if ( array_key_exists( 'brand', $meta ) ) {
            $sanitized['brand'] = ( '' === $meta['brand'] || null === $meta['brand'] ) ? null : sanitize_key( (string) $meta['brand'] );
        }

        if ( isset( $meta['collections'] ) && is_array( $meta['collections'] ) ) {
            $sanitized['collections'] = array_values( array_map( 'sanitize_key', $meta['collections'] ) );
        }

        if ( array_key_exists( 'featured_image', $meta ) ) {
            $sanitized['featured_image'] = $this->sanitize_media_item( $meta['featured_image'] );
        }

        if ( isset( $meta['gallery'] ) && is_array( $meta['gallery'] ) ) {
            $sanitized['gallery'] = array_values( array_filter( array_map( array( $this, 'sanitize_media_item' ), $meta['gallery'] ) ) );
        }

        if ( isset( $meta['type_details'] ) && is_array( $meta['type_details'] ) ) {
            $sanitized['type_details'] = $this->sanitize_type_details( $type, $meta['type_details'] );
        }

        // Catalog AI's own generated fields (vulocart-pro's CatalogAi
        // module) - allowlisted here for the same reason `seo_title`/
        // `seo_description` are above: a value CatalogAi wrote via
        // `ProductService::update_product()` directly must still
        // survive a later, unrelated save through this REST controller's
        // own wholesale-meta-replace PATCH, or it's silently wiped the
        // next time a merchant edits anything else about this product.
        if ( isset( $meta['specifications'] ) && is_array( $meta['specifications'] ) ) {
            $sanitized['specifications'] = array_values(
                array_map(
                    static function ( $row ) {
                        return array(
                            'key'   => isset( $row['key'] ) ? sanitize_text_field( (string) $row['key'] ) : '',
                            'value' => isset( $row['value'] ) ? sanitize_text_field( (string) $row['value'] ) : '',
                        );
                    },
                    $meta['specifications']
                )
            );
        }

        if ( isset( $meta['faqs'] ) && is_array( $meta['faqs'] ) ) {
            $sanitized['faqs'] = array_values(
                array_map(
                    static function ( $row ) {
                        return array(
                            'question' => isset( $row['question'] ) ? sanitize_text_field( (string) $row['question'] ) : '',
                            'answer'   => isset( $row['answer'] ) ? sanitize_textarea_field( (string) $row['answer'] ) : '',
                        );
                    },
                    $meta['faqs']
                )
            );
        }

        if ( isset( $meta['translations'] ) && is_array( $meta['translations'] ) ) {
            $sanitized['translations'] = array();

            foreach ( $meta['translations'] as $locale => $translation ) {
                if ( ! is_array( $translation ) ) {
                    continue;
                }

                $sanitized['translations'][ sanitize_key( (string) $locale ) ] = array(
                    'title'             => isset( $translation['title'] ) ? sanitize_text_field( (string) $translation['title'] ) : '',
                    'short_description' => isset( $translation['short_description'] ) ? sanitize_textarea_field( (string) $translation['short_description'] ) : '',
                    'full_description'  => isset( $translation['full_description'] ) ? sanitize_textarea_field( (string) $translation['full_description'] ) : '',
                );
            }
        }

        if ( isset( $meta['pricing_suggestion'] ) && is_array( $meta['pricing_suggestion'] ) ) {
            $sanitized['pricing_suggestion'] = array(
                'suggested_price' => isset( $meta['pricing_suggestion']['suggested_price'] ) ? (float) $meta['pricing_suggestion']['suggested_price'] : null,
                'reasoning'       => isset( $meta['pricing_suggestion']['reasoning'] ) ? sanitize_textarea_field( (string) $meta['pricing_suggestion']['reasoning'] ) : '',
                'generated_at'    => isset( $meta['pricing_suggestion']['generated_at'] ) ? sanitize_text_field( (string) $meta['pricing_suggestion']['generated_at'] ) : '',
            );
        }

        if ( isset( $meta['inventory_prediction'] ) && is_array( $meta['inventory_prediction'] ) ) {
            $sanitized['inventory_prediction'] = array(
                'days_until_stockout' => isset( $meta['inventory_prediction']['days_until_stockout'] ) ? (int) $meta['inventory_prediction']['days_until_stockout'] : null,
                'reorder_point'       => isset( $meta['inventory_prediction']['reorder_point'] ) ? (int) $meta['inventory_prediction']['reorder_point'] : null,
                'reasoning'           => isset( $meta['inventory_prediction']['reasoning'] ) ? sanitize_textarea_field( (string) $meta['inventory_prediction']['reasoning'] ) : '',
                'generated_at'        => isset( $meta['inventory_prediction']['generated_at'] ) ? sanitize_text_field( (string) $meta['inventory_prediction']['generated_at'] ) : '',
            );
        }

        return $sanitized;
    }

    /**
     * Sanitizes `meta.type_details` against TYPE_DETAIL_FIELDS' whitelist
     * for this specific product type - a field the current type doesn't
     * declare (e.g. `download_url` submitted for a `service` product,
     * which has no such field) is silently dropped rather than stored,
     * same "whitelist, not generic sanitize-whatever-shows-up" posture
     * sanitize_product_meta() already documents.
     *
     * @param string               $type    One of ProductType's constants.
     * @param array<string, mixed> $details Raw `type_details` payload.
     * @return array<string, mixed>
     */
    private function sanitize_type_details( $type, $details ) {
        if ( ! isset( self::TYPE_DETAIL_FIELDS[ $type ] ) ) {
            return array();
        }

        $sanitized = array();

        foreach ( self::TYPE_DETAIL_FIELDS[ $type ] as $key => $kind ) {
            if ( ! array_key_exists( $key, $details ) ) {
                continue;
            }

            $value = $details[ $key ];

            switch ( $kind ) {
                case 'int':
                    $sanitized[ $key ] = ( '' === $value || null === $value ) ? null : absint( $value );
                    break;

                case 'float':
                    $sanitized[ $key ] = ( '' === $value || null === $value ) ? null : (float) $value;
                    break;

                case 'bool':
                    $sanitized[ $key ] = (bool) $value;
                    break;

                case 'key':
                    $sanitized[ $key ] = sanitize_key( (string) $value );
                    break;

                default:
                    $sanitized[ $key ] = sanitize_text_field( (string) $value );
                    break;
            }
        }

        return $sanitized;
    }

    /**
     * Sanitizes one `{id, url}` media attachment reference - used for both
     * `featured_image` (single) and each entry of `gallery` (array).
     *
     * @param mixed $item Raw media item, expected shape `{id?: int, url: string}`.
     * @return array{id: int, url: string}|null Null if $item has no usable url.
     */
    private function sanitize_media_item( $item ) {
        if ( ! is_array( $item ) || empty( $item['url'] ) ) {
            return null;
        }

        return array(
            'id'  => isset( $item['id'] ) ? absint( $item['id'] ) : 0,
            'url' => esc_url_raw( (string) $item['url'] ),
        );
    }
}
