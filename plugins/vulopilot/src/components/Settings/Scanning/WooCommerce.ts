import { __ } from '@wordpress/i18n';

export default {
	id: 'woocommerce',
	priority: 5,
	headerTitle: __('WooCommerce', 'vulopilot'),
	headerIcon: 'cart',
	submitUrl: 'settings',
	modal: [
		{
			key: 'flag_products_missing_schema',
			type: 'checkbox',
			look: 'toggle',
			label: __('Flag products missing schema', 'vulopilot'),
			desc: __(
				'Products without valid Product structured data.',
				'vulopilot'
			),
			options: [
				{ key: 'flag_products_missing_schema', label: '', value: 'flag_products_missing_schema' },
			],
		},
	],
};
