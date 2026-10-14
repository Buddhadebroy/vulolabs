import { __ } from '@wordpress/i18n';

/**
 * Same declarative-tab shape as General.ts, backed by
 * `Utill::SETTINGS_DEFAULTS`'s Catalog section. `default_product_type`/
 * `default_catalog_visibility` are not yet read anywhere else in this
 * codebase (ProductEdit.tsx still hardcodes its own initial form state)
 * - the same "real setting, not yet consumed" gap already documented on
 * `default_product_status` in General.ts/Utill.php.
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
			key: 'catalog-section-defaults',
			type: 'section',
			icon: 'catalog',
			title: __( 'Product defaults', 'vulocart' ),
			desc: __(
				'Preselected values for a newly created product.',
				'vulocart'
			),
		},
		{
			key: 'default_product_type',
			type: 'select',
			label: __( 'Default product type', 'vulocart' ),
			settingDescription: __(
				'Product type preselected when a merchant clicks "Add New" on the Products screen.',
				'vulocart'
			),
			// Same value set as ProductType::all() (PHP) and
			// ProductEdit.tsx's own PRODUCT_TYPE_OPTIONS - kept as a
			// hand-maintained flat list rather than a shared constant
			// import, matching how ProductEdit.tsx already duplicates it.
			options: [
				{ label: __( 'Physical', 'vulocart' ), value: 'physical' },
				{ label: __( 'Digital', 'vulocart' ), value: 'digital' },
				{ label: __( 'Subscription', 'vulocart' ), value: 'subscription' },
				{ label: __( 'Course', 'vulocart' ), value: 'course' },
				{ label: __( 'Service', 'vulocart' ), value: 'service' },
				{ label: __( 'Membership', 'vulocart' ), value: 'membership' },
				{ label: __( 'Booking', 'vulocart' ), value: 'booking' },
				{ label: __( 'Rental', 'vulocart' ), value: 'rental' },
				{ label: __( 'Bundle', 'vulocart' ), value: 'bundle' },
				{ label: __( 'Donation', 'vulocart' ), value: 'donation' },
				{ label: __( 'Gift card', 'vulocart' ), value: 'gift_card' },
				{ label: __( 'License', 'vulocart' ), value: 'license' },
			],
		},
		{
			key: 'default_catalog_visibility',
			type: 'select',
			label: __( 'Default catalog visibility', 'vulocart' ),
			settingDescription: __(
				'Visibility preselected for a newly created product.',
				'vulocart'
			),
			// Same value set as ProductEdit.tsx's CATALOG_VISIBILITY_OPTIONS.
			options: [
				{ label: __( 'Shop and search results', 'vulocart' ), value: 'shop_and_search' },
				{ label: __( 'Shop only', 'vulocart' ), value: 'shop_only' },
				{ label: __( 'Search results only', 'vulocart' ), value: 'search_only' },
				{ label: __( 'Hidden', 'vulocart' ), value: 'hidden' },
			],
		},
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
