import { __ } from '@wordpress/i18n';

/**
 * Backed by `Utill::SETTINGS_DEFAULTS`'s Shipping section — a
 * marketplace-wide flat rate, distinct from OfferingEdit.tsx's per-offering
 * shipping fields (weight/dimensions/shipping class), which are a separate,
 * real concept. Read by the Shipping module's own
 * `Shipping\Application\ShippingService`, and added into an order's total
 * server-side by `Order\Application\OrderService::create_from_cart()`
 * whenever that module is active.
 */
export default {
	id: 'shipping',
	priority: 5,
	headerTitle: __( 'Shipping', 'vulocart' ),
	headerIcon: 'shipping',
	submitUrl: 'settings',
	modal: [
		{
			key: 'enable_shipping',
			type: 'checkbox',
			look: 'toggle',
			label: __( 'Enable shipping', 'vulocart' ),
			desc: __(
				'Whether shippable offering types (Physical, Rental, Bundle) show shipping fields at all.',
				'vulocart'
			),
			options: [
				{ key: 'enable_shipping', label: '', value: 'enable_shipping' },
			],
		},
		{
			key: 'default_shipping_class',
			type: 'select',
			label: __( 'Default shipping class', 'vulocart' ),
			desc: __(
				'Shipping class preselected for a new shippable offering.',
				'vulocart'
			),
			// Same value set as OfferingEdit.tsx's SHIPPING_CLASS_OPTIONS.
			options: [
				{ label: __( 'Standard', 'vulocart' ), value: 'standard' },
				{ label: __( 'Fragile', 'vulocart' ), value: 'fragile' },
				{ label: __( 'Oversized', 'vulocart' ), value: 'oversized' },
				{ label: __( 'Free shipping', 'vulocart' ), value: 'free_shipping' },
			],
			dependent: { key: 'enable_shipping', set: true },
		},
		{
			key: 'flat_rate_shipping_cost',
			type: 'number',
			label: __( 'Flat rate shipping cost', 'vulocart' ),
			minNumber: 0,
			desc: __(
				'A single flat shipping charge, once order totals account for shipping.',
				'vulocart'
			),
			dependent: { key: 'enable_shipping', set: true },
		},
	],
};
