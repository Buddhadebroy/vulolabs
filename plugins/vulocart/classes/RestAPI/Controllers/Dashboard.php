<?php
/**
 * Dashboard class file.
 *
 * @package VuloCart
 */

namespace VuloCart\RestAPI\Controllers;

use VuloCart\Utill;

defined( 'ABSPATH' ) || exit;

/**
 * VuloCart Dashboard REST controller.
 *
 * One read-only summary for the VuloCart → Dashboard page (`src/pages/Dashboard/`): sales figures for a date range
 * (with the previous range for comparison), a daily series, what needs the merchant's attention, recent orders, top
 * products and low stock. One request instead of the page stitching six list endpoints together.
 *
 * Revenue counts paid orders only (`payment_status = paid`, less refunds); order counts leave drafts out. Dates are
 * grouped in the site's timezone.
 *
 * @class       Dashboard class
 * @version     1.0.0
 * @author      VuloLabs
 */
class Dashboard extends \WP_REST_Controller {

    /**
     * REST base for this controller's routes.
     *
     * @var string
     */
    protected $rest_base = 'dashboard';

    /**
     * Date ranges the page offers, in days.
     *
     * @var int[]
     */
    const RANGES = array( 7, 30, 90 );

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
                'callback'            => array( $this, 'get_summary' ),
                'permission_callback' => array( $this, 'admin_permissions_check' ),
                'args'                => array(
                    'range' => array(
                        'type'    => 'integer',
                        'default' => 30,
                        'enum'    => self::RANGES,
                    ),
                ),
            )
        );
    }

    /**
     * Checks whether the current user can see the store dashboard.
     *
     * @return bool
     */
    public function admin_permissions_check() {
        return current_user_can( 'manage_options' );
    }

    /**
     * Whether a VuloCart table exists (the Order/Customer/Review tables come from modules and may be missing).
     *
     * @param string $table Full table name.
     * @return bool
     */
    private function table_exists( string $table ): bool {
        global $wpdb;

        return $table === $wpdb->get_var( $wpdb->prepare( 'SHOW TABLES LIKE %s', $table ) ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery
    }

    /**
     * Builds the dashboard summary.
     *
     * @param \WP_REST_Request $request Full request object.
     * @return \WP_REST_Response
     */
    public function get_summary( $request ) {
        global $wpdb;

        $range    = in_array( (int) $request->get_param( 'range' ), self::RANGES, true ) ? (int) $request->get_param( 'range' ) : 30;
        $settings = wp_parse_args( get_option( Utill::SETTINGS_KEY, array() ), Utill::SETTINGS_DEFAULTS );

        // Range boundaries: midnight in the site's timezone, converted to UTC for the stored timestamps.
        $timezone   = wp_timezone();
        $today      = new \DateTimeImmutable( 'today', $timezone );
        $start      = $today->modify( '-' . ( $range - 1 ) . ' days' );
        $prev_start = $start->modify( '-' . $range . ' days' );
        $utc        = new \DateTimeZone( 'UTC' );
        $start_utc  = $start->setTimezone( $utc )->format( 'Y-m-d H:i:s' );
        $prev_utc   = $prev_start->setTimezone( $utc )->format( 'Y-m-d H:i:s' );
        $offset     = sprintf( '%+03d:%02d', intdiv( $timezone->getOffset( $today ), 3600 ), abs( $timezone->getOffset( $today ) % 3600 ) / 60 );

        $orders_table    = $wpdb->prefix . 'vulocart_orders';
        $items_table     = $wpdb->prefix . 'vulocart_order_items';
        $customers_table = $wpdb->prefix . 'vulocart_customers';
        $reviews_table   = $wpdb->prefix . 'vulocart_reviews';

        $has_orders    = $this->table_exists( $orders_table );
        $has_customers = $this->table_exists( $customers_table );
        $has_reviews   = $this->table_exists( $reviews_table );

        $empty_period = array(
            'revenue'       => 0.0,
            'orders'        => 0,
            'paid_orders'   => 0,
            'order_value'   => 0.0,
            'new_customers' => 0,
        );
        $current  = $empty_period;
        $previous = $empty_period;
        $series   = array();

        // phpcs:disable WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- table names are fixed prefixes; values are prepared.
        if ( $has_orders ) {
            $period_sql = "SELECT
                    COUNT(*) AS orders,
                    SUM( payment_status = 'paid' ) AS paid_orders,
                    COALESCE( SUM( CASE WHEN status <> 'cancelled' THEN total ELSE 0 END ), 0 ) AS order_value,
                    COALESCE( SUM( CASE WHEN payment_status = 'paid' THEN total - COALESCE( refunded_amount, 0 ) ELSE 0 END ), 0 ) AS revenue
                FROM `{$orders_table}`
                WHERE status <> 'draft' AND created_at >= %s AND created_at < %s";

            $read_period = static function ( array $period, $row ) {
                $period['revenue']     = (float) ( $row['revenue'] ?? 0 );
                $period['orders']      = (int) ( $row['orders'] ?? 0 );
                $period['paid_orders'] = (int) ( $row['paid_orders'] ?? 0 );
                $period['order_value'] = (float) ( $row['order_value'] ?? 0 );

                return $period;
            };

            $current  = $read_period( $current, $wpdb->get_row( $wpdb->prepare( $period_sql, $start_utc, gmdate( 'Y-m-d H:i:s', time() + DAY_IN_SECONDS ) ), ARRAY_A ) );
            $previous = $read_period( $previous, $wpdb->get_row( $wpdb->prepare( $period_sql, $prev_utc, $start_utc ), ARRAY_A ) );

            // Daily series in the site's timezone. CONVERT_TZ with numeric offsets needs no timezone tables.
            $rows = $wpdb->get_results(
                $wpdb->prepare(
                    "SELECT DATE( CONVERT_TZ( created_at, '+00:00', %s ) ) AS day,
                        COUNT(*) AS orders,
                        COALESCE( SUM( CASE WHEN payment_status = 'paid' THEN total - COALESCE( refunded_amount, 0 ) ELSE 0 END ), 0 ) AS revenue
                    FROM `{$orders_table}`
                    WHERE status <> 'draft' AND created_at >= %s
                    GROUP BY day",
                    $offset,
                    $start_utc
                ),
                ARRAY_A
            );

            $by_day = array();
            foreach ( $rows as $row ) {
                $by_day[ $row['day'] ] = $row;
            }

            for ( $day = $start; $day <= $today; $day = $day->modify( '+1 day' ) ) {
                $key      = $day->format( 'Y-m-d' );
                $series[] = array(
                    'date'    => $key,
                    'revenue' => (float) ( $by_day[ $key ]['revenue'] ?? 0 ),
                    'orders'  => (int) ( $by_day[ $key ]['orders'] ?? 0 ),
                );
            }
        }

        if ( $has_customers ) {
            $customer_sql = "SELECT COUNT(*) FROM `{$customers_table}` WHERE created_at >= %s AND created_at < %s";

            $current['new_customers']  = (int) $wpdb->get_var( $wpdb->prepare( $customer_sql, $start_utc, gmdate( 'Y-m-d H:i:s', time() + DAY_IN_SECONDS ) ) );
            $previous['new_customers'] = (int) $wpdb->get_var( $wpdb->prepare( $customer_sql, $prev_utc, $start_utc ) );
        }

        // What needs doing, regardless of the range.
        $attention = array(
            'to_fulfill'      => 0,
            'unpaid'          => 0,
            'pending_reviews' => 0,
            'low_stock'       => 0,
            'out_of_stock'    => 0,
        );

        $recent_orders = array();
        $top_products  = array();

        if ( $has_orders ) {
            $attention['to_fulfill'] = (int) $wpdb->get_var( "SELECT COUNT(*) FROM `{$orders_table}` WHERE status NOT IN ( 'draft', 'cancelled' ) AND fulfillment_status IN ( 'pending', 'processing' )" );
            $attention['unpaid']     = (int) $wpdb->get_var( "SELECT COUNT(*) FROM `{$orders_table}` WHERE status NOT IN ( 'draft', 'cancelled' ) AND payment_status IN ( 'pending', 'failed' )" );

            $recent_orders = array_map(
                static function ( $row ) {
                    return array(
                        'id'                 => (int) $row['id'],
                        'order_number'       => $row['order_number'],
                        'customer'           => $row['customer_name'] ? $row['customer_name'] : ( $row['customer_email'] ? $row['customer_email'] : '' ),
                        'total'              => (float) $row['total'],
                        'currency'           => $row['currency'],
                        'payment_status'     => $row['payment_status'],
                        'fulfillment_status' => $row['fulfillment_status'],
                        'created_at'         => $row['created_at'],
                    );
                },
                (array) $wpdb->get_results( "SELECT id, order_number, customer_name, customer_email, total, currency, payment_status, fulfillment_status, created_at FROM `{$orders_table}` WHERE status <> 'draft' ORDER BY created_at DESC, id DESC LIMIT 6", ARRAY_A )
            );

            if ( $this->table_exists( $items_table ) ) {
                $top_products = array_map(
                    static function ( $row ) {
                        return array(
                            'product_id' => (int) $row['product_id'],
                            'title'      => $row['title'],
                            'quantity'   => (int) $row['quantity'],
                            'revenue'    => (float) $row['revenue'],
                        );
                    },
                    (array) $wpdb->get_results(
                        $wpdb->prepare(
                            "SELECT i.product_id, MAX( i.title ) AS title, SUM( i.quantity ) AS quantity, COALESCE( SUM( i.quantity * i.unit_price ), 0 ) AS revenue
                            FROM `{$items_table}` i
                            INNER JOIN `{$orders_table}` o ON o.id = i.order_id
                            WHERE o.status NOT IN ( 'draft', 'cancelled' ) AND o.created_at >= %s
                            GROUP BY i.product_id
                            ORDER BY quantity DESC, revenue DESC
                            LIMIT 5",
                            $start_utc
                        ),
                        ARRAY_A
                    )
                );
            }
        }

        if ( $has_reviews && VuloCart()->modules->is_active( 'product-reviews' ) ) {
            $attention['pending_reviews'] = (int) $wpdb->get_var( "SELECT COUNT(*) FROM `{$reviews_table}` WHERE status = 'pending'" );
        }
        // phpcs:enable

        // Stock: same rules as the Inventory page (Controllers\Inventory).
        $threshold = (int) $settings['low_stock_threshold'];
        $low_stock = array();
        $products  = VuloCart()->product_service->list_products(
            array(
                'page'     => 1,
                'per_page' => 500,
            )
        );

        foreach ( $products['data'] as $product ) {
            if ( ! in_array( $product->type, Inventory::STOCK_TRACKED_TYPES, true ) || empty( $product->meta['stock_management'] ) ) {
                if ( 'out_of_stock' === ( $product->meta['stock_status'] ?? '' ) ) {
                    ++$attention['out_of_stock'];
                }
                continue;
            }

            $quantity = isset( $product->meta['stock_quantity'] ) ? (int) $product->meta['stock_quantity'] : null;

            if ( null === $quantity ) {
                continue;
            }

            if ( $quantity <= 0 ) {
                ++$attention['out_of_stock'];
            } elseif ( $quantity <= $threshold ) {
                ++$attention['low_stock'];
            } else {
                continue;
            }

            $low_stock[] = array(
                'id'       => $product->id,
                'title'    => $product->title,
                'sku'      => $product->sku,
                'quantity' => $quantity,
            );
        }

        usort(
            $low_stock,
            static function ( $a, $b ) {
                return $a['quantity'] <=> $b['quantity'];
            }
        );

        return rest_ensure_response(
            array(
                'range'         => $range,
                'currency'      => $settings['default_currency'],
                'current'       => $current,
                'previous'      => $previous,
                'series'        => $series,
                'attention'     => $attention,
                'recent_orders' => $recent_orders,
                'top_products'  => $top_products,
                'low_stock'     => array_slice( $low_stock, 0, 5 ),
                'catalog'       => array(
                    'products'  => (int) $products['total'],
                    'threshold' => $threshold,
                ),
            )
        );
    }
}
