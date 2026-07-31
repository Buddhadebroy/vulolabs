import { __ } from '@wordpress/i18n';

/**
 * Backed by `Utill::SETTINGS_DEFAULTS`'s Checkout section. There is no
 * dedicated Checkout module/table in this codebase — a Cart becomes an
 * Order directly via `Order\Application\OrderService::create_from_cart()`
 * — but every field here is genuinely enforced: `guest_checkout_enabled`
 * gates order placement both client-side (the checkout wizard's Customer
 * step, via `Block.php`'s `print_frontend_config()`) and server-side
 * (`Order\Rest::create_item()`, so a direct API call can't bypass the
 * client check); `require_terms_acceptance`/`checkout_terms_url` render a
 * real terms-acceptance checkbox on the storefront checkout wizard that
 * must be checked before "Place Order" is enabled; `require_phone_number`
 * is the Customer module's own step requirement, same client+server
 * enforcement pattern.
 */
export default {
	id: 'checkout',
	priority: 3,
	headerTitle: __( 'Checkout', 'vulocart' ),
	headerIcon: 'credit-card',
	submitUrl: 'settings',
	modal: [
		{
			key: 'checkout_mode',
			type: 'select',
			label: __( 'Checkout layout', 'vulocart' ),
			desc: __(
				'Domain\\Checkout\\CheckoutMode — which layout the storefront Checkout Engine renders its registered steps in.',
				'vulocart'
			),
			options: [
				{ label: __( 'Multi-step (one step at a time)', 'vulocart' ), value: 'multi_step' },
				{ label: __( 'Single page (every step at once)', 'vulocart' ), value: 'single_page' },
			],
		},
		{
			key: 'guest_checkout_enabled',
			type: 'checkbox',
			look: 'toggle',
			label: __( 'Enable guest checkout', 'vulocart' ),
			desc: __(
				'Allow an order to be placed with just an email address, no account required.',
				'vulocart'
			),
			options: [
				{ key: 'guest_checkout_enabled', label: '', value: 'guest_checkout_enabled' },
			],
		},
		{
			key: 'require_phone_number',
			type: 'checkbox',
			look: 'toggle',
			label: __( 'Require phone number', 'vulocart' ),
			desc: __(
				'Require a phone number on the Customer step before checkout can continue.',
				'vulocart'
			),
			options: [
				{ key: 'require_phone_number', label: '', value: 'require_phone_number' },
			],
		},
		{
			key: 'require_terms_acceptance',
			type: 'checkbox',
			look: 'toggle',
			label: __( 'Require terms acceptance', 'vulocart' ),
			desc: __(
				'Require the buyer to accept your terms before placing an order.',
				'vulocart'
			),
			options: [
				{ key: 'require_terms_acceptance', label: '', value: 'require_terms_acceptance' },
			],
		},
		{
			key: 'checkout_terms_url',
			type: 'text',
			label: __( 'Terms & conditions URL', 'vulocart' ),
			placeholder: __( 'https://yourstore.com/terms', 'vulocart' ),
			desc: __(
				'Linked from the checkout terms-acceptance checkbox on the storefront.',
				'vulocart'
			),
			dependent: { key: 'require_terms_acceptance', set: true },
		},
	],
};
