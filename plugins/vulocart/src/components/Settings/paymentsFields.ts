import { __ } from '@wordpress/i18n';

/**
 * The Payments tab's field schema, in zyra's settings-field format. A `section` starts a group; a
 * group that holds an on/off toggle is a payment method (a row in the list, its other fields in the
 * Configure popup), any other group is shown as a plain settings section.
 *
 * `vulocart-pro`'s Stripe/PayPal/Razorpay modules append their own sections through the
 * `vulocart_settings_fields` filter (`settingId: 'payments'`), which PaymentsPanel applies - so they
 * show up as methods here without this file knowing they exist.
 *
 * Backed by `Utill::SETTINGS_DEFAULTS`'s Payments section: each toggle is a real
 * `PaymentGatewayInterface::is_configured()` check for this plugin's offline gateways
 * (`enable_manual_payment` → ManualGateway, `enable_bank_transfer` → BankTransferGateway,
 * `enable_cash_on_delivery` → CashOnDeliveryGateway).
 */
export interface PaymentField {
	key: string;
	type: string;
	label?: string;
	icon?: string;
	title?: string;
	desc?: string;
	settingDescription?: string;
	options?: { key?: string; label: string; value: string }[];
	dependent?: string;
	[ key: string ]: unknown;
}

const paymentsFields: PaymentField[] = [
	{
		key: 'payments-section-capture',
		type: 'section',
		icon: 'payment',
		title: __( 'Card charging', 'vulocart' ),
		desc: __( 'When an online gateway (Stripe, PayPal, Razorpay) takes the money.', 'vulocart' ),
	},
	{
		key: 'payment_capture_mode',
		type: 'select',
		label: __( 'Charge the card', 'vulocart' ),
		settingDescription: __(
			'Charge at checkout, or only hold the amount and capture it yourself later from the order screen. Offline methods are not affected.',
			'vulocart'
		),
		options: [
			{ label: __( 'At checkout', 'vulocart' ), value: 'immediate' },
			{ label: __( 'Later, when I capture it', 'vulocart' ), value: 'manual' },
		],
	},
	{
		key: 'payments-section-manual',
		type: 'section',
		icon: 'payment',
		title: __( 'Manual payment', 'vulocart' ),
		desc: __( 'You and the buyer arrange payment outside the store, for example by phone or invoice.', 'vulocart' ),
	},
	{
		key: 'enable_manual_payment',
		type: 'checkbox',
		look: 'toggle',
		label: __( 'Enable manual payment', 'vulocart' ),
		options: [ { key: 'enable_manual_payment', label: '', value: 'enable_manual_payment' } ],
	},
	{
		key: 'default_payment_status',
		type: 'select',
		label: __( 'Payment status of new orders', 'vulocart' ),
		settingDescription: __( 'The payment status a new manual-payment order starts with. Choose Pending if you confirm payment yourself.', 'vulocart' ),
		options: [
			{ label: __( 'Pending', 'vulocart' ), value: 'pending' },
			{ label: __( 'Paid', 'vulocart' ), value: 'paid' },
			{ label: __( 'Failed', 'vulocart' ), value: 'failed' },
			{ label: __( 'Refunded', 'vulocart' ), value: 'refunded' },
		],
	},
	{
		key: 'payments-section-bank',
		type: 'section',
		icon: 'bank-payment',
		title: __( 'Bank transfer', 'vulocart' ),
		desc: __( 'The buyer sends the money to your bank. The order stays pending until you mark it paid.', 'vulocart' ),
	},
	{
		key: 'enable_bank_transfer',
		type: 'checkbox',
		look: 'toggle',
		label: __( 'Enable bank transfer', 'vulocart' ),
		options: [ { key: 'enable_bank_transfer', label: '', value: 'enable_bank_transfer' } ],
	},
	{
		key: 'bank_transfer_instructions',
		type: 'textarea',
		label: __( 'Payment instructions', 'vulocart' ),
		settingDescription: __( 'Shown to the buyer after they order: account number, bank name and the reference to use.', 'vulocart' ),
	},
	{
		key: 'payments-section-cod',
		type: 'section',
		icon: 'wallet',
		title: __( 'Cash on delivery', 'vulocart' ),
		desc: __( 'The buyer pays in cash when the order arrives.', 'vulocart' ),
	},
	{
		key: 'enable_cash_on_delivery',
		type: 'checkbox',
		look: 'toggle',
		label: __( 'Enable cash on delivery', 'vulocart' ),
		options: [ { key: 'enable_cash_on_delivery', label: '', value: 'enable_cash_on_delivery' } ],
	},
];

export default paymentsFields;
