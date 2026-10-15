import { __ } from '@wordpress/i18n';

/**
 * Commerce → Shipping & Tax. Merged from the former standalone
 * `Shipping.ts` + `Taxes.ts` pair - both are a single marketplace-wide
 * flat rate applied at checkout, and neither tab had enough fields to
 * earn its own place in the tab bar. Backed by `Utill::SETTINGS_DEFAULTS`'s
 * Shipping and Taxes sections - field keys are unchanged, so no PHP-side
 * change was needed to merge these two tabs into one. Both are read by
 * their own module's Application service and added into an order's total
 * server-side by `Order\Application\OrderService::create_from_cart()`
 * whenever that module is active.
 */
export default {
	id: 'shipping',
	priority: 4,
	headerTitle: __( 'Shipping & Tax', 'vulocart' ),
	headerIcon: 'shipping',
	groupBySections: true,
	hideSettingHeader: true,
	submitUrl: 'settings',
	modal: [
		{
			key: 'shipping-section-flat-rate',
			type: 'section',
			icon: 'shipping',
			title: __( 'Flat rate shipping', 'vulocart' ),
			desc: __(
				'A single marketplace-wide shipping charge - distinct from a per-product shipping class/weight on the Products screen.',
				'vulocart'
			),
		},
		{
			key: 'enable_shipping',
			type: 'checkbox',
			look: 'toggle',
			label: __( 'Enable shipping', 'vulocart' ),
			settingDescription: __(
				'Whether shippable product types (Physical, Rental, Bundle) show shipping fields at all.',
				'vulocart'
			),
			options: [
				{ key: 'enable_shipping', label: '', value: 'enable_shipping' },
			],
		},
		{
			key: 'flat_rate_shipping_cost',
			type: 'number',
			label: __( 'Flat rate shipping cost', 'vulocart' ),
			minNumber: 0,
			settingDescription: __(
				'A single flat shipping charge, once order totals account for shipping.',
				'vulocart'
			),
			dependent: { key: 'enable_shipping', set: true },
		},
		{
			key: 'taxes-section-flat-rate',
			type: 'section',
			icon: 'tax-compliance',
			title: __( 'Flat rate tax', 'vulocart' ),
			desc: __(
				'A single flat tax rate applied to every order, until per-region tax rules exist.',
				'vulocart'
			),
		},
		{
			key: 'enable_tax_calculation',
			type: 'checkbox',
			look: 'toggle',
			label: __( 'Enable tax calculation', 'vulocart' ),
			settingDescription: __(
				'Whether order totals should factor in tax at all, once a tax module exists to do the calculation.',
				'vulocart'
			),
			options: [
				{ key: 'enable_tax_calculation', label: '', value: 'enable_tax_calculation' },
			],
		},
		{
			key: 'default_tax_rate_percent',
			type: 'number',
			label: __( 'Default tax rate (%)', 'vulocart' ),
			minNumber: 0,
			maxNumber: 100,
			settingDescription: __(
				'Percentage added to every order when tax calculation is on.',
				'vulocart'
			),
			dependent: { key: 'enable_tax_calculation', set: true },
		},
		{
			key: 'prices_include_tax',
			type: 'checkbox',
			look: 'toggle',
			label: __( 'Prices already include tax', 'vulocart' ),
			settingDescription: __(
				'Whether a product\'s price is tax-inclusive or tax gets added on top at checkout.',
				'vulocart'
			),
			options: [
				{ key: 'prices_include_tax', label: '', value: 'prices_include_tax' },
			],
			dependent: { key: 'enable_tax_calculation', set: true },
		},
	],
};
