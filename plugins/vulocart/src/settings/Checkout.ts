import { __ } from '@wordpress/i18n';

/**
 * Settings → Checkout (a top-level tab: it is the only checkout page, so no folder). Merged from the former standalone `Cart.ts` +
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
	priority: 3,
	headerTitle: __( 'Checkout', 'vulocart' ),
	headerIcon: 'cart',
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
				'Which layout the storefront checkout shows your steps in. A checkout block can override this for its own page.',
				'vulocart'
			),
			options: [
				{ label: __( 'Multi-step (one step at a time)', 'vulocart' ), value: 'multi_step' },
				{ label: __( 'Single page (every step at once)', 'vulocart' ), value: 'single_page' },
			],
		},
		{
			key: 'checkout_delivery',
			// A toggle group, not a select: zyra only locks a single option (Pro tag, "module off" tag, popup) in this type.
			type: 'choice-toggle',
			label: __( 'Checkout opens as', 'vulocart' ),
			settingDescription: __(
				'Where "Proceed to checkout" and "Buy now" lead. Styles beyond the checkout page are part of VuloCart Pro.',
				'vulocart'
			),
			options: [
				{ key: 'page', label: __( 'Checkout page', 'vulocart' ), value: 'page' },
				{ key: 'popup', label: __( 'Popup', 'vulocart' ), value: 'popup', proSetting: true, moduleEnabled: 'popup-checkout' },
				{ key: 'drawer', label: __( 'Side drawer', 'vulocart' ), value: 'drawer', proSetting: true, moduleEnabled: 'drawer-checkout' },
				{ key: 'hosted', label: __( 'Hosted page', 'vulocart' ), value: 'hosted', proSetting: true, moduleEnabled: 'hosted-checkout' },
				{ key: 'one_click', label: __( 'One-click', 'vulocart' ), value: 'one_click', proSetting: true, moduleEnabled: 'one-click-checkout' },
			],
		},
		{
			key: 'checkout_steps',
			type: 'checkbox',
			label: __( 'Steps shown', 'vulocart' ),
			settingDescription: __(
				'Turn off the steps your checkout can skip. Customer and Payment are always shown. A checkout block can pick its own steps and their order.',
				'vulocart'
			),
			options: [
				{ key: 'customer', label: __( 'Customer', 'vulocart' ), value: 'customer', disabled: true },
				{ key: 'address', label: __( 'Address', 'vulocart' ), value: 'address' },
				{ key: 'shipping', label: __( 'Shipping', 'vulocart' ), value: 'shipping' },
				{ key: 'payment', label: __( 'Payment', 'vulocart' ), value: 'payment', disabled: true },
				{ key: 'review', label: __( 'Review', 'vulocart' ), value: 'review' },
			],
		},
		{
			key: 'checkout_fields',
			type: 'checkbox',
			label: __( 'Optional fields', 'vulocart' ),
			settingDescription: __(
				'Fields the buyer can fill in. A phone number is still asked for when "Require phone number" is on. A checkout block can switch these per page.',
				'vulocart'
			),
			options: [
				{ key: 'name', label: __( 'Name', 'vulocart' ), value: 'name' },
				{ key: 'phone', label: __( 'Phone number', 'vulocart' ), value: 'phone' },
				{ key: 'address_2', label: __( 'Apartment, suite, etc.', 'vulocart' ), value: 'address_2' },
			],
		},
		{
			key: 'checkout_extras',
			type: 'checkbox',
			label: __( 'Extras', 'vulocart' ),
			settingDescription: __(
				'Optional extras on the checkout. Order notes lets buyers leave a message with their order; address lookup suggests full addresses as they type.',
				'vulocart'
			),
			options: [
				{ key: 'order_notes', label: __( 'Order notes', 'vulocart' ), value: 'order_notes', proSetting: true },
				{ key: 'address_autocomplete', label: __( 'Address lookup', 'vulocart' ), value: 'address_autocomplete', proSetting: true },
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
