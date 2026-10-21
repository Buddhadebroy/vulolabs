<?php
/**
 * OrderEmails class file.
 *
 * @package VuloCart
 */

namespace VuloCart\Notifications;

use VuloCart\Utill;

defined( 'ABSPATH' ) || exit;

/**
 * Sends the order emails: a confirmation when an order is created, and a status update when its payment or
 * fulfillment status changes.
 *
 * It only listens to the events the Order module dispatches (`vulocart_order_created`,
 * `vulocart_order_payment_status_changed`, `vulocart_order_fulfillment_status_changed`) and holds no order logic. It
 * is registered whether or not the Order module is active; the events simply never fire without it.
 *
 * Settings → Email controls whether each email is sent (`send_order_confirmation_email`, `send_status_update_email`)
 * and the From address (`notification_from_email`). They are read on every send, not cached.
 *
 * @class       OrderEmails class
 * @version     1.0.0
 * @author      VuloLabs
 */
class OrderEmails {

    /**
     * OrderEmails constructor.
     */
    public function __construct() {
        add_action( 'vulocart_order_created', array( $this, 'send_order_confirmation' ) );
        add_action( 'vulocart_order_fulfillment_status_changed', array( $this, 'send_fulfillment_status_update' ) );
        add_action( 'vulocart_order_payment_status_changed', array( $this, 'send_payment_status_update' ) );
    }

    /**
     * Reads the stored settings option, defaults filled in - a small,
     * local copy of RestAPI\Controllers\Settings::get_stored_settings()
     * rather than a shared helper, since that method is `private` on a
     * REST controller with a different lifecycle/responsibility.
     *
     * @return array Stored settings, defaults filled in for any never-saved key.
     */
    private function get_settings(): array {
        return wp_parse_args( get_option( Utill::SETTINGS_KEY, array() ), Utill::SETTINGS_DEFAULTS );
    }

    /**
     * `wp_mail()`'s optional headers array, carrying a `From:` header when
     * the Email tab's `notification_from_email` is set - omitted entirely
     * when blank so `wp_mail()` falls back to its own site-default sender
     * rather than this class asserting an empty/invalid From address.
     *
     * @param array $settings Stored settings, from get_settings().
     * @return string[]
     */
    private function get_mail_headers( array $settings ): array {
        if ( empty( $settings['notification_from_email'] ) ) {
            return array();
        }

        return array( sprintf( 'From: %s', sanitize_email( $settings['notification_from_email'] ) ) );
    }

    /**
     * Renders a line-item list as plain text for the email body.
     *
     * @param object[] $items Order\Domain\OrderItem[] belonging to the order.
     * @return string
     */
    private function format_items( $items ): string {
        $lines = array();

        foreach ( $items as $item ) {
            $lines[] = sprintf(
                '  - %s x%d (%s %s)',
                $item->title,
                $item->quantity,
                number_format( (float) $item->unit_price * $item->quantity, 2 ),
                $item->currency
            );
        }

        return implode( "\n", $lines );
    }

    /**
     * Sends the buyer a confirmation email right after an order is placed.
     * Silently does nothing for orders with no email on file - a cart
     * checked out with no customer_email is a valid, real state
     * (Rest::create_item()'s `customer_email` param is optional), not an
     * error to log.
     *
     * @param array{order: object} $payload Order\Domain\Order under the 'order' key.
     * @return void
     */
    public function send_order_confirmation( $payload ) {
        $order = $payload['order'];

        if ( empty( $order->customer_email ) ) {
            return;
        }

        $settings = $this->get_settings();

        if ( empty( $settings['send_order_confirmation_email'] ) ) {
            return;
        }

        $subject = sprintf(
        /* translators: %s: order number, e.g. VC-000042. */
            __( 'Order %s confirmed', 'vulocart' ),
            $order->order_number
        );

        $body = sprintf(
            /* translators: 1: customer name or "there", 2: order number, 3: line items, 4: total amount, 5: currency, 6: order number (repeated for tracking), 7: access token. */
            __(
                "Hi %1\$s,\n\nThanks for your order! Here's what you ordered:\n\n%3\$s\n\nTotal: %4\$s %5\$s\n\nYour order is currently pending review. You can check on its status any time using your order number and access token below:\n\nOrder number: %6\$s\nAccess token: %7\$s",
                'vulocart'
            ),
            $order->customer_name ? $order->customer_name : __( 'there', 'vulocart' ),
            $order->order_number,
            $this->format_items( $order->items ),
            number_format( (float) $order->total, 2 ),
            $order->currency,
            $order->order_number,
            $order->access_token
        );

        wp_mail( $order->customer_email, $subject, $body, $this->get_mail_headers( $settings ) );
    }

    /**
     * Sends the buyer a notice whenever an admin changes their order's
     * fulfillment status (Rest::update_item()/bulk_update_fulfillment_status())
     * - never fires for the initial pending status, since
     * create_from_cart() sets that directly rather than going through
     * update_fulfillment_status().
     *
     * @param array{order: object} $payload Order\Domain\Order under the 'order' key.
     * @return void
     */
    public function send_fulfillment_status_update( $payload ) {
        $this->send_status_update_email(
            $payload['order'],
            /* translators: 1: customer name or "there", 2: order number, 3: new fulfillment status. */
            __( "Hi %1\$s,\n\nYour order %2\$s fulfillment status is now: %3\$s.", 'vulocart' ),
            $payload['order']->fulfillment_status
        );
    }

    /**
     * Sends the buyer a notice whenever an admin changes their order's
     * payment status (Rest::update_item()/bulk_update_payment_status()/
     * refund_item()) - never fires for the initial pending status.
     *
     * @param array{order: object} $payload Order\Domain\Order under the 'order' key.
     * @return void
     */
    public function send_payment_status_update( $payload ) {
        $this->send_status_update_email(
            $payload['order'],
            /* translators: 1: customer name or "there", 2: order number, 3: new payment status. */
            __( "Hi %1\$s,\n\nYour order %2\$s payment status is now: %3\$s.", 'vulocart' ),
            $payload['order']->payment_status
        );
    }

    /**
     * Shared body for send_fulfillment_status_update()/
     * send_payment_status_update() - same settings gate, same
     * silent-no-op-without-an-email rule, only the (already fully
     * translated, %1$s/%2$s/%3$s-placeholdered) body sentence and status
     * word differ.
     *
     * @param object $order         Order\Domain\Order.
     * @param string $body_template Translated body string with %1$s/%2$s/%3$s placeholders for name/order number/status.
     * @param string $status        The new status value to report.
     * @return void
     */
    private function send_status_update_email( $order, string $body_template, string $status ): void {
        if ( empty( $order->customer_email ) ) {
            return;
        }

        $settings = $this->get_settings();

        if ( empty( $settings['send_status_update_email'] ) ) {
            return;
        }

        $subject = sprintf(
        /* translators: %s: order number, e.g. VC-000042. */
            __( 'Update on your order %s', 'vulocart' ),
            $order->order_number
        );

        $body = sprintf(
            $body_template,
            $order->customer_name ? $order->customer_name : __( 'there', 'vulocart' ),
            $order->order_number,
            $status
        );

        wp_mail( $order->customer_email, $subject, $body, $this->get_mail_headers( $settings ) );
    }

    /**
     * Emails the customer a request to pay what is still owed on an order: what they bought, the amount due and,
     * when bank transfer is switched on, the transfer instructions. Static so the admin REST route can call it
     * without a second instance of this class (the constructor registers the order listeners).
     *
     * @param object $order Order\Domain\Order.
     * @return bool Whether the mail was handed to wp_mail() successfully.
     */
    public static function send_payment_request( $order ): bool {
        if ( empty( $order->customer_email ) ) {
            return false;
        }

        $settings = wp_parse_args( get_option( Utill::SETTINGS_KEY, array() ), Utill::SETTINGS_DEFAULTS );
        $headers  = empty( $settings['notification_from_email'] ) ? array() : array( 'From: ' . sanitize_email( $settings['notification_from_email'] ) );

        $lines = array();

        foreach ( $order->items as $item ) {
            $lines[] = sprintf( '- %1$s x %2$d', $item->title, $item->quantity );
        }

        $body = sprintf(
            /* translators: 1: customer name, 2: order number, 3: amount due with currency. */
            __( "Hi %1\$s,\n\nThis is a request for payment on order %2\$s.\n\nAmount due: %3\$s\n\n", 'vulocart' ),
            $order->customer_name ? $order->customer_name : __( 'there', 'vulocart' ),
            $order->order_number,
            number_format_i18n( (float) $order->total, 2 ) . ' ' . $order->currency
        ) . implode( "\n", $lines ) . "\n\n";

        if ( ! empty( $settings['enable_bank_transfer'] ) && ! empty( $settings['bank_transfer_instructions'] ) ) {
            $body .= __( 'How to pay (bank transfer):', 'vulocart' ) . "\n" . $settings['bank_transfer_instructions'] . "\n\n";
        }

        $body .= __( 'Reply to this email if you have any questions.', 'vulocart' ) . "\n" . get_bloginfo( 'name' );

        return wp_mail(
            $order->customer_email,
            /* translators: %s: order number. */
            sprintf( __( 'Payment request for order %s', 'vulocart' ), $order->order_number ),
            $body,
            $headers
        );
    }
}
