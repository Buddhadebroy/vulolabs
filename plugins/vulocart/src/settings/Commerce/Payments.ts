import { __ } from '@wordpress/i18n';

/**
 * Backed by `Utill::SETTINGS_DEFAULTS`'s Payments section. Read by the
 * Payment module's own `Payment\Application\PaymentService`:
 * `enable_manual_payment` gates whether `manual` (pay on delivery, bank
 * transfer, or any other offline settlement) is offered at all — the
 * only method this plugin supports until a real gateway module exists —
 * and `default_payment_status` is the payment status a new order actually
 * starts at (`OrderService::create_from_cart()` resolves it from this
 * module when active).
 */
export default {
	id: 'payments',
	priority: 4,
	headerTitle: __( 'Payments', 'vulocart' ),
	headerIcon: 'payment',
	submitUrl: 'settings',
	modal: [
		{
			key: 'enable_manual_payment',
			type: 'checkbox',
			look: 'toggle',
			label: __( 'Enable manual/offline payment', 'vulocart' ),
			desc: __(
				'Accept orders without an online payment gateway — the only payment mode this plugin supports until a gateway module exists.',
				'vulocart'
			),
			options: [
				{ key: 'enable_manual_payment', label: '', value: 'enable_manual_payment' },
			],
		},
		{
			key: 'default_payment_status',
			type: 'select',
			label: __( 'Default payment status', 'vulocart' ),
			desc: __(
				'Payment status a new order would start at, once orders track payment status separately from fulfillment status.',
				'vulocart'
			),
			options: [
				{ label: __( 'Pending', 'vulocart' ), value: 'pending' },
				{ label: __( 'Paid', 'vulocart' ), value: 'paid' },
				{ label: __( 'Failed', 'vulocart' ), value: 'failed' },
				{ label: __( 'Refunded', 'vulocart' ), value: 'refunded' },
			],
		},
	],
};
