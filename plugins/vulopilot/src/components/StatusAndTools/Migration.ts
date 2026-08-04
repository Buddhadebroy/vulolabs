import { __ } from '@wordpress/i18n';

export default {
	id: 'migration',
	priority: 5,
	headerTitle: __('Migration', 'vulopilot'),
	headerDescription: __(
		'Follow the step-by-step wizard to import products, stores, and settings effortlessly from other multivendor solutions.',
		'vulopilot'
	),
	headerIcon: 'migration',
	submitUrl: 'settings',
	modal: [
		{
			key: 'migrate',
			type: 'button',
			name: __('Run Migration Wizard', 'vulopilot'),
			label: __('Multivendor migration', 'vulopilot'),
			position: 'left',
			desc: __(
				'Seamlessly transfer your store data from your previous multivendor plugin (i.e. Dokan, WCFM and WC Vendor) using this migration tool.',
				'vulopilot'
			),
			action: 'open_modal',
		},
	],
};
