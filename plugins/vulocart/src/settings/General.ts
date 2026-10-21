import { __ } from '@wordpress/i18n';
import { listingPreview } from '../lib/listingPreviews';

/**
 * Settings → General. Merged from the former `General/General.ts` +
 * `General/Frontend.ts` pair (two fields each) into one top-level file -
 * same "don't nest a folder for two three-field tabs" consolidation
 * applied to Commerce/Integrations below. Backed by
 * `Utill::SETTINGS_DEFAULTS`'s General and Frontend sections
 * (classes/Utill.php) via `classes/RestAPI/Controllers/Settings.php` -
 * field keys are unchanged, so no PHP-side change was needed to merge
 * these two tabs into one.
 */
export default {
	id: 'general',
	priority: 1,
	headerTitle: __( 'General', 'vulocart' ),
	headerIcon: 'setting',
	groupBySections: true,
	hideSettingHeader: true,
	submitUrl: 'settings',
	modal: [
		{
			key: 'general-section-defaults',
			type: 'section',
			icon: 'setting',
			title: __( 'Defaults', 'vulocart' ),
			desc: __(
				'Fallback values applied when a new product is created without them explicitly set.',
				'vulocart'
			),
		},
		{
			key: 'default_currency',
			type: 'text',
			label: __( 'Default currency', 'vulocart' ),
			settingDescription: __(
				'ISO 4217 code used when a new product is created without an explicit currency.',
				'vulocart'
			),
		},
		{
			key: 'ask_product_type',
			type: 'checkbox',
			look: 'toggle',
			label: __( 'Ask what you\'re selling first', 'vulocart' ),
			settingDescription: __(
				'When you add a product, start on the "What are you selling?" screen. Turn off to skip it and pick the product type on the product page instead.',
				'vulocart'
			),
			options: [
				{ key: 'ask_product_type', label: '', value: 'ask_product_type' },
			],
		},
		{
			key: 'general-section-inventory',
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
		{
			key: 'general-section-listing',
			type: 'section',
			icon: 'catalog',
			title: __( 'Product listing', 'vulocart' ),
			desc: __(
				'How your products catalog looks on the storefront. A single page can still override it from the block settings.',
				'vulocart'
			),
		},
		{
			key: 'listing_template',
			type: 'choice-toggle',
			options: [
				{
					key: 'grid',
					label: __( 'Grid', 'vulocart' ),
					desc: __( 'Image cards in a tidy grid. A good default for most catalogs.', 'vulocart' ),
					img: listingPreview( 'grid' ),
					value: 'grid',
				},
				{
					key: 'compact',
					label: __( 'Compact', 'vulocart' ),
					desc: __( 'Small tiles, more per row. Best for large catalogs.', 'vulocart' ),
					img: listingPreview( 'compact' ),
					value: 'compact',
				},
				{
					key: 'list',
					label: __( 'List', 'vulocart' ),
					desc: __( 'One row per product with a short description.', 'vulocart' ),
					img: listingPreview( 'list' ),
					value: 'list',
				},
				{
					key: 'showcase',
					label: __( 'Showcase', 'vulocart' ),
					desc: __( 'Large image-first cards with a soft shadow.', 'vulocart' ),
					img: listingPreview( 'showcase' ),
					value: 'showcase',
				},
			],
		},
		{
			key: 'listing_columns',
			type: 'choice-toggle',
			label: __( 'Columns on wide screens', 'vulocart' ),
			settingDescription: __(
				'How many products sit side by side. Smaller screens show fewer automatically; the List layout ignores this.',
				'vulocart'
			),
			options: [
				{ key: '2', label: '2', value: '2' },
				{ key: '3', label: '3', value: '3' },
				{ key: '4', label: '4', value: '4' },
				{ key: '5', label: '5', value: '5' },
			],
		},
	],
};
