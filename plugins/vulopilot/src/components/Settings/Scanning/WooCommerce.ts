import { __ } from '@wordpress/i18n';

export default {
	id: 'woocommerce',
	priority: 5,
	headerTitle: __('WooCommerce', 'vulopilot'),
	headerIcon: 'cart',
	submitUrl: 'settings',
	modal: [
		{
			key: 'enable_woocommerce_scanning',
			type: 'checkbox',
			look: 'toggle',
			label: __('Enable WooCommerce scanning', 'vulopilot'),
			desc: __(
				'Turns every category "woocommerce" scanner on or off — the Store Health checks (checkout/cart/account pages, base location, payment gateways) plus the 12 product-intelligence checks (missing images/categories/tags/descriptions, SKU issues, attributes, inventory health, pricing, duplicates, completeness, SEO).',
				'vulopilot'
			),
			options: [
				{ key: 'enable_woocommerce_scanning', label: '', value: 'enable_woocommerce_scanning' },
			],
		},
	],
};
