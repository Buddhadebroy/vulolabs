import { __ } from '@wordpress/i18n';

/**
 * Backed by `Utill::SETTINGS_DEFAULTS`'s Taxes section. Read by the Taxes
 * module's own `Taxes\Application\TaxService`, and added into an order's
 * total server-side by `Order\Application\OrderService::create_from_cart()`
 * whenever that module is active — a single flat rate, not per-region tax
 * rules (vision's lightweight-first scope).
 */
export default {
	id: 'taxes',
	priority: 6,
	headerTitle: __( 'Taxes', 'vulocart' ),
	headerIcon: 'tax-compliance',
	submitUrl: 'settings',
	modal: [
		{
			key: 'enable_tax_calculation',
			type: 'checkbox',
			look: 'toggle',
			label: __( 'Enable tax calculation', 'vulocart' ),
			desc: __(
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
			desc: __(
				'A single flat tax rate applied to every order, until per-region tax rules exist.',
				'vulocart'
			),
			dependent: { key: 'enable_tax_calculation', set: true },
		},
		{
			key: 'prices_include_tax',
			type: 'checkbox',
			look: 'toggle',
			label: __( 'Prices already include tax', 'vulocart' ),
			desc: __(
				'Whether an offering\'s price is tax-inclusive or tax gets added on top at checkout.',
				'vulocart'
			),
			options: [
				{ key: 'prices_include_tax', label: '', value: 'prices_include_tax' },
			],
			dependent: { key: 'enable_tax_calculation', set: true },
		},
	],
};
