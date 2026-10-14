import { __ } from '@wordpress/i18n';

/**
 * Same declarative-tab shape as General.ts, backed by `Utill::SETTINGS_DEFAULTS`' Catalog section.
 */
export default {
	id: 'catalog',
	priority: 1,
	headerTitle: __( 'Catalog', 'vulocart' ),
	headerIcon: 'catalog',
	groupBySections: true,
	hideSettingHeader: true,
	submitUrl: 'settings',
	modal: [
		{
			key: 'catalog-section-inventory',
			type: 'section',
			icon: 'database',
			title: __( 'Inventory', 'vulocart' ),
			desc: __(
				'Stock-tracking thresholds that apply across the catalog.',
				'vulocart'
			),
		},
		{
			key: 'low_stock_threshold',
			type: 'number',
			label: __( 'Low stock threshold', 'vulocart' ),
			minNumber: 0,
			settingDescription: __(
				'Quantity at or below which a stock-tracked product could be flagged as low stock.',
				'vulocart'
			),
		},
	],
};
