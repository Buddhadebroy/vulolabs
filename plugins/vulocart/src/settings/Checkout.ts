import { __ } from '@wordpress/i18n';

/**
 * Settings → Checkout. Four sections, in the order a store owner thinks about them: where checkout opens and how it
 * is laid out, what the shopper is asked for, who may buy and what they must accept, and how long a cart is kept.
 * Backed by the Cart and Checkout sections of `Utill::SETTINGS_DEFAULTS`. Guest checkout, the phone number and terms
 * acceptance are checked again on the server by `Order\Rest::create_item()`; `cart_expiry_days` is applied by
 * `Cart\Application\CartCleanupScheduler`.
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
			key: 'checkout-section-opening',
			type: 'section',
			icon: 'credit-card',
			title: __( 'How checkout opens', 'vulocart' ),
			desc: __( 'Where shoppers land when they press "Proceed to checkout" or "Buy now", and how the steps are laid out there.', 'vulocart' ),
		},
		{
			key: 'checkout_delivery',
			// A toggle group, not a select: zyra only locks a single option (Pro tag, "module off" tag, popup) in this type.
			type: 'choice-toggle',
			label: __( 'Open checkout as', 'vulocart' ),
			settingDescription: __( 'A page of its own by default. Popup, side drawer, hosted page and one-click need VuloCart Pro.', 'vulocart' ),
			options: [
				{ key: 'page', label: __( 'Checkout page', 'vulocart' ), value: 'page' },
				{ key: 'popup', label: __( 'Popup', 'vulocart' ), value: 'popup', proSetting: true, moduleEnabled: 'popup-checkout' },
				{ key: 'drawer', label: __( 'Side drawer', 'vulocart' ), value: 'drawer', proSetting: true, moduleEnabled: 'drawer-checkout' },
				{ key: 'hosted', label: __( 'Hosted page', 'vulocart' ), value: 'hosted', proSetting: true, moduleEnabled: 'hosted-checkout' },
				{ key: 'one_click', label: __( 'One-click', 'vulocart' ), value: 'one_click', proSetting: true, moduleEnabled: 'one-click-checkout' },
			],
		},
		{
			key: 'checkout_mode',
			type: 'select',
			label: __( 'Layout', 'vulocart' ),
			settingDescription: __( 'Show the steps one at a time, or all together on one page. A checkout block can choose its own layout.', 'vulocart' ),
			options: [
				{ label: __( 'One step at a time', 'vulocart' ), value: 'multi_step' },
				{ label: __( 'Everything on one page', 'vulocart' ), value: 'single_page' },
			],
		},
		{
			key: 'checkout-section-form',
			type: 'section',
			icon: 'form-section',
			title: __( 'What shoppers fill in', 'vulocart' ),
			desc: __( 'The steps they go through and the details you ask for. A checkout block can override these for its own page.', 'vulocart' ),
		},
		{
			key: 'checkout_steps',
			type: 'checkbox',
			label: __( 'Steps', 'vulocart' ),
			settingDescription: __( 'Untick the steps you can skip. Customer and Payment are always part of checkout.', 'vulocart' ),
			options: [
				{ key: 'customer', label: __( 'Customer', 'vulocart' ), value: 'customer', disabled: true },
				{ key: 'address', label: __( 'Address', 'vulocart' ), value: 'address' },
				{ key: 'shipping', label: __( 'Shipping', 'vulocart' ), value: 'shipping' },
				{ key: 'payment', label: __( 'Payment', 'vulocart' ), value: 'payment', disabled: true },
				{ key: 'review', label: __( 'Review', 'vulocart' ), value: 'review' },
			],
		},
		{
			key: 'checkout_phone',
			type: 'select',
			label: __( 'Phone number', 'vulocart' ),
			settingDescription: __( 'Whether the Customer step asks for a phone number, and whether the shopper must give one.', 'vulocart' ),
			options: [
				{ label: __( 'Do not ask', 'vulocart' ), value: 'hidden' },
				{ label: __( 'Ask, but optional', 'vulocart' ), value: 'optional' },
				{ label: __( 'Required', 'vulocart' ), value: 'required' },
			],
		},
		{
			key: 'checkout_fields',
			type: 'checkbox',
			label: __( 'Other details to ask for', 'vulocart' ),
			settingDescription: __( 'Extra, optional fields on the Customer and Address steps.', 'vulocart' ),
			options: [
				{ key: 'name', label: __( 'Name', 'vulocart' ), value: 'name' },
				{ key: 'address_2', label: __( 'Apartment, suite, etc.', 'vulocart' ), value: 'address_2' },
			],
		},
		{
			key: 'checkout_extras',
			type: 'checkbox',
			label: __( 'Extras (Pro)', 'vulocart' ),
			settingDescription: __( 'Order notes lets shoppers leave a message with their order. Address lookup suggests full addresses as they type.', 'vulocart' ),
			options: [
				{ key: 'order_notes', label: __( 'Order notes', 'vulocart' ), value: 'order_notes', proSetting: true },
				{ key: 'address_autocomplete', label: __( 'Address lookup', 'vulocart' ), value: 'address_autocomplete', proSetting: true },
			],
		},
		{
			key: 'checkout-section-buying',
			type: 'section',
			icon: 'identity-verification',
			title: __( 'Who can buy', 'vulocart' ),
			desc: __( 'Whether shoppers need an account, and what they must accept before an order is placed.', 'vulocart' ),
		},
		{
			key: 'guest_checkout_enabled',
			type: 'checkbox',
			look: 'toggle',
			label: __( 'Allow guest checkout', 'vulocart' ),
			settingDescription: __( 'Shoppers can order with just an email address. Turn off to require an account.', 'vulocart' ),
			options: [ { key: 'guest_checkout_enabled', label: '', value: 'guest_checkout_enabled' } ],
		},
		{
			key: 'require_terms_acceptance',
			type: 'checkbox',
			look: 'toggle',
			label: __( 'Ask shoppers to accept your terms', 'vulocart' ),
			settingDescription: __( 'A checkbox the shopper must tick before placing an order.', 'vulocart' ),
			options: [ { key: 'require_terms_acceptance', label: '', value: 'require_terms_acceptance' } ],
		},
		{
			key: 'checkout_terms_url',
			type: 'text',
			label: __( 'Terms & conditions page', 'vulocart' ),
			placeholder: __( 'https://yourstore.com/terms', 'vulocart' ),
			settingDescription: __( 'The checkbox links to this address.', 'vulocart' ),
			dependent: { key: 'require_terms_acceptance', set: true },
		},
		{
			key: 'checkout-section-cart',
			type: 'section',
			icon: 'cart',
			title: __( 'Carts', 'vulocart' ),
			desc: __( 'How long a cart is kept when the shopper does not finish.', 'vulocart' ),
		},
		{
			key: 'cart_expiry_days',
			type: 'number',
			label: __( 'Keep abandoned carts for (days)', 'vulocart' ),
			minNumber: 1,
			maxNumber: 365,
			settingDescription: __( 'After this many days without activity a cart is deleted.', 'vulocart' ),
		},
	],
};
