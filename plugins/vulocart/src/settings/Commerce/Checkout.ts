import { __ } from '@wordpress/i18n';

/**
 * Commerce → Checkout. Merged from the former standalone `Cart.ts` +
 * `Checkout.ts` pair - cart and checkout are one continuous buyer flow,
 * and neither tab had enough fields to earn its own place in the tab bar.
 * Backed by `Utill::SETTINGS_DEFAULTS`'s Cart and Checkout sections -
 * field keys are unchanged, so no PHP-side change was needed to merge
 * these two tabs into one. See the former Cart.ts/Checkout.ts for the
 * per-field enforcement notes (`cart_expiry_days` via
 * `Cart\Application\CartCleanupScheduler`, `guest_checkout_enabled` via
 * both the checkout wizard's Customer step and `Order\Rest::create_item()`,
 * `require_terms_acceptance`/`checkout_terms_url` rendering a real
 * storefront terms checkbox).
 */
export default {
	id: 'checkout',
	priority: 2,
	headerTitle: __( 'Checkout', 'vulocart' ),
	headerIcon: 'credit-card',
	groupBySections: true,
	hideSettingHeader: true,
	submitUrl: 'settings',
	modal: [
		{
			key: 'checkout-section-cart',
			type: 'section',
			icon: 'cart',
			title: __( 'Cart behavior', 'vulocart' ),
			desc: __(
				'Who can start a cart, and how long an abandoned one sticks around.',
				'vulocart'
			),
		},
		{
			key: 'allow_guest_cart',
			type: 'checkbox',
			look: 'toggle',
			label: __( 'Allow guest carts', 'vulocart' ),
			settingDescription: __(
				'Let a shopper add items to a cart before creating an account.',
				'vulocart'
			),
			options: [
				{ key: 'allow_guest_cart', label: '', value: 'allow_guest_cart' },
			],
		},
		{
			key: 'cart_expiry_days',
			type: 'number',
			label: __( 'Cart expiry (days)', 'vulocart' ),
			minNumber: 1,
			maxNumber: 365,
			settingDescription: __(
				'How long an abandoned cart is kept before it could be cleared out.',
				'vulocart'
			),
		},
		{
			key: 'checkout-section-flow',
			type: 'section',
			icon: 'credit-card',
			title: __( 'Checkout flow', 'vulocart' ),
			desc: __(
				'How the storefront checkout lays out its steps, and what it requires before an order can be placed.',
				'vulocart'
			),
		},
		{
			key: 'checkout_mode',
			type: 'select',
			label: __( 'Checkout layout', 'vulocart' ),
			settingDescription: __(
				'Which layout the storefront checkout shows your steps in.',
				'vulocart'
			),
			options: [
				{ label: __( 'Multi-step (one step at a time)', 'vulocart' ), value: 'multi_step' },
				{ label: __( 'Single page (every step at once)', 'vulocart' ), value: 'single_page' },
			],
		},
		{
			key: 'checkout_styles',
			type: 'checkbox',
			label: __( 'Extra checkout styles (Pro)', 'vulocart' ),
			settingDescription: __(
				'Open checkout somewhere other than the checkout page: in a popup, a side drawer, embedded in any page, or on a hosted page. Needs VuloCart Pro.',
				'vulocart'
			),
			options: [
				{ key: 'popup', label: __( 'Popup', 'vulocart' ), value: 'popup' },
				{ key: 'drawer', label: __( 'Side drawer', 'vulocart' ), value: 'drawer' },
				{ key: 'embedded', label: __( 'Embedded in a page', 'vulocart' ), value: 'embedded' },
				{ key: 'hosted', label: __( 'Hosted page', 'vulocart' ), value: 'hosted' },
			],
		},
		{
			key: 'checkout_features',
			type: 'checkbox',
			label: __( 'Checkout extras (Pro)', 'vulocart' ),
			settingDescription: __(
				'One-click reorder, shareable checkout links and QR codes, the checkout builder, a buyer note field, and address suggestions. Needs VuloCart Pro.',
				'vulocart'
			),
			options: [
				{ key: 'one-click', label: __( 'One-click checkout', 'vulocart' ), value: 'one-click' },
				{ key: 'links', label: __( 'Checkout links & QR codes', 'vulocart' ), value: 'links' },
				{ key: 'builder', label: __( 'Checkout builder', 'vulocart' ), value: 'builder' },
				{ key: 'notes', label: __( 'Order notes from the buyer', 'vulocart' ), value: 'notes' },
				{ key: 'autocomplete', label: __( 'Address autocomplete', 'vulocart' ), value: 'autocomplete' },
			],
		},
		{
			key: 'guest_checkout_enabled',
			type: 'checkbox',
			look: 'toggle',
			label: __( 'Enable guest checkout', 'vulocart' ),
			settingDescription: __(
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
			settingDescription: __(
				'Require a phone number on the Customer step before checkout can continue.',
				'vulocart'
			),
			options: [
				{ key: 'require_phone_number', label: '', value: 'require_phone_number' },
			],
		},
		{
			key: 'checkout-section-terms',
			type: 'section',
			icon: 'form-section',
			title: __( 'Terms & conditions', 'vulocart' ),
			desc: __(
				'Require the buyer to accept your terms before an order can be placed.',
				'vulocart'
			),
		},
		{
			key: 'require_terms_acceptance',
			type: 'checkbox',
			look: 'toggle',
			label: __( 'Require terms acceptance', 'vulocart' ),
			settingDescription: __(
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
			settingDescription: __(
				'Linked from the checkout terms-acceptance checkbox on the storefront.',
				'vulocart'
			),
			dependent: { key: 'require_terms_acceptance', set: true },
		},
	],
};
