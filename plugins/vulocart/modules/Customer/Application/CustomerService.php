<?php
/**
 * CustomerService class file.
 *
 * @package VuloCart
 */

namespace VuloCart\Customer\Application;

defined( 'ABSPATH' ) || exit;

/**
 * VuloCart Customer module CustomerService.
 *
 * Where Customer business logic lives — Rest calls only this class. No
 * repository, no domain entity: a "customer" in this plugin is either an
 * existing WP user (resolved live, never duplicated into a second table)
 * or a guest whose details are snapshotted straight onto the Order they
 * place (Order\Application\OrderService::create_from_cart()).
 *
 * @class       CustomerService class
 * @version     1.0.0
 * @author      VuloLabs
 */
class CustomerService {

    /**
     * Usermeta key a logged-in buyer's phone number is remembered under,
     * once they've given it at checkout — read back by resolve_current()
     * so a repeat logged-in buyer doesn't have to retype it.
     *
     * @var string
     */
    const PHONE_USER_META_KEY = 'vulocart_phone';

    /**
     * Resolves the checkout wizard's Customer step starting values: a
     * logged-in buyer gets their WP account's name/email (and remembered
     * phone, if any) prefilled; a guest gets an empty shape to fill in
     * themselves. Never blocks checkout either way — this is prefill data,
     * not an authorization check (guest checkout's own gate is the
     * Checkout tab's `guest_checkout_enabled` setting, enforced elsewhere).
     *
     * @return array{is_logged_in: bool, user_id: int|null, email: string, name: string, phone: string}
     */
    public function resolve_current(): array {
        if ( ! is_user_logged_in() ) {
            return array(
                'is_logged_in' => false,
                'user_id'      => null,
                'email'        => '',
                'name'         => '',
                'phone'        => '',
            );
        }

        $user = wp_get_current_user();

        return array(
            'is_logged_in' => true,
            'user_id'      => (int) $user->ID,
            'email'        => (string) $user->user_email,
            'name'         => (string) $user->display_name,
            'phone'        => (string) get_user_meta( $user->ID, self::PHONE_USER_META_KEY, true ),
        );
    }

    /**
     * Sanitizes a raw `{email, name, phone}` bag posted from the checkout
     * wizard's Customer step. `email`/`name` still ultimately flow through
     * Order\Rest::create_item()'s own `sanitize_email()`/
     * `sanitize_text_field()` calls (that route predates this module and
     * stays the source of truth for what actually gets persisted) — this
     * exists for the wizard's own step-validation call
     * (`POST /customer/me` isn't a write route; validation happens
     * client-side against this same shape) and for any other caller that
     * wants a clean, predictable bag back.
     *
     * @param array<string, mixed> $data Raw posted customer fields.
     * @return array{email: string, name: string, phone: string}
     */
    public function sanitize( array $data ): array {
        return array(
            'email' => isset( $data['email'] ) ? sanitize_email( (string) $data['email'] ) : '',
            'name'  => isset( $data['name'] ) ? sanitize_text_field( (string) $data['name'] ) : '',
            'phone' => isset( $data['phone'] ) ? sanitize_text_field( (string) $data['phone'] ) : '',
        );
    }

    /**
     * Remembers a logged-in buyer's phone number for next time — called
     * once an order has actually been placed (Order\Rest::create_item()),
     * not on every keystroke.
     *
     * @param int    $user_id WP user id.
     * @param string $phone   Phone number to remember.
     * @return void
     */
    public function remember_phone( int $user_id, string $phone ): void {
        if ( '' === $phone ) {
            return;
        }

        update_user_meta( $user_id, self::PHONE_USER_META_KEY, sanitize_text_field( $phone ) );
    }
}
