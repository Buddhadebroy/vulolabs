import { __ } from '@wordpress/i18n';

/**
 * Backed by `Utill::SETTINGS_DEFAULTS`'s Payments section. Read by the
 * Payment Framework's own `Payment\Application\GatewayRegistry`/
 * `Gateways\*` classes - each toggle here is a real
 * `PaymentGatewayInterface::is_configured()` check for this plugin's own
 * three offline gateways (`enable_manual_payment` → ManualGateway,
 * `enable_bank_transfer` → BankTransferGateway, `enable_cash_on_delivery`
 * → CashOnDeliveryGateway). `vulocart-pro`'s Stripe/PayPal/Razorpay
 * modules append their own credential fields onto this tab via the
 * `vulocart_settings_fields` filter (`pages/Settings/Settings.tsx`),
 * rather than editing this file.
 */
export default {
	id: 'payments',
	priority: 3,
	headerTitle: __( 'Payments', 'vulocart' ),
	headerIcon: 'payment',
	groupBySections: true,
	hideSettingHeader: true,
	submitUrl: 'settings',
	modal: [
		{
			key: 'payments-section-capture',
			type: 'section',
			icon: 'payment',
			title: __( 'Capture', 'vulocart' ),
			desc: __(
				'When an online gateway actually takes the buyer\'s money.',
				'vulocart'
			),
		},
		{
			key: 'payment_capture_mode',
			type: 'select',
			label: __( 'Capture mode', 'vulocart' ),
			settingDescription: __(
				'"Immediate" charges the card at checkout. "Manual" only authorizes it, letting you capture payment later from the order screen. Offline gateways are unaffected either way.',
				'vulocart'
			),
			options: [
				{ label: __( 'Immediate', 'vulocart' ), value: 'immediate' },
				{ label: __( 'Manual', 'vulocart' ), value: 'manual' },
			],
		},
		{
			key: 'payments-section-offline',
			type: 'section',
			icon: 'bank-payment',
			title: __( 'Offline payment methods', 'vulocart' ),
			desc: __(
				'This plugin\'s own three offline gateways - the buyer and store owner settle outside this software.',
				'vulocart'
			),
		},
		{
			key: 'enable_manual_payment',
			type: 'checkbox',
			look: 'toggle',
			label: __( 'Enable manual/offline payment', 'vulocart' ),
			settingDescription: __(
				'A generic offline settlement method - the buyer and store owner arrange payment outside this software.',
				'vulocart'
			),
			options: [
				{ key: 'enable_manual_payment', label: '', value: 'enable_manual_payment' },
			],
		},
		{
			key: 'default_payment_status',
			type: 'select',
			label: __( 'Manual payment: default status', 'vulocart' ),
			settingDescription: __(
				'Payment status a new manual-payment order starts at.',
				'vulocart'
			),
			dependent: 'enable_manual_payment',
			options: [
				{ label: __( 'Pending', 'vulocart' ), value: 'pending' },
				{ label: __( 'Paid', 'vulocart' ), value: 'paid' },
				{ label: __( 'Failed', 'vulocart' ), value: 'failed' },
				{ label: __( 'Refunded', 'vulocart' ), value: 'refunded' },
			],
		},
		{
			key: 'enable_bank_transfer',
			type: 'checkbox',
			look: 'toggle',
			label: __( 'Enable bank transfer', 'vulocart' ),
			settingDescription: __(
				'Buyer wires funds directly - order stays pending until the store owner confirms the transfer landed and marks it paid.',
				'vulocart'
			),
			options: [
				{ key: 'enable_bank_transfer', label: '', value: 'enable_bank_transfer' },
			],
		},
		{
			key: 'bank_transfer_instructions',
			type: 'textarea',
			label: __( 'Bank transfer instructions', 'vulocart' ),
			settingDescription: __( 'Shown to the buyer on the order confirmation screen - account number, bank name, reference format, etc.', 'vulocart' ),
			dependent: 'enable_bank_transfer',
		},
		{
			key: 'enable_cash_on_delivery',
			type: 'checkbox',
			look: 'toggle',
			label: __( 'Enable cash on delivery', 'vulocart' ),
			settingDescription: __( 'Buyer pays in cash when the order is delivered.', 'vulocart' ),
			options: [
				{ key: 'enable_cash_on_delivery', label: '', value: 'enable_cash_on_delivery' },
			],
		},
	],
};
