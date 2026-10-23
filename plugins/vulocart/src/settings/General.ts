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
			key: 'general-section-store',
			type: 'section',
			icon: 'setting',
			title: __( 'Store', 'vulocart' ),
			desc: __( 'The basics every product and order uses.', 'vulocart' ),
		},
		{
			key: 'default_currency',
			type: 'text',
			label: __( 'Store currency', 'vulocart' ),
			settingDescription: __(
				'The three-letter currency code, for example USD, EUR, GBP or INR. New products are priced in it.',
				'vulocart'
			),
		},
		{
			key: 'general-section-products',
			type: 'section',
			icon: 'product',
			title: __( 'Adding products', 'vulocart' ),
			desc: __( 'How the Add Product screen starts.', 'vulocart' ),
		},
		{
			key: 'ask_product_type',
			type: 'checkbox',
			look: 'toggle',
			label: __( 'Start with "What are you selling?"', 'vulocart' ),
			settingDescription: __(
				'Adding a product opens a screen to pick its type first. Turn off to go straight to the product page and pick the type there.',
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
			desc: __( 'When a product counts as running low.', 'vulocart' ),
		},
		{
			key: 'low_stock_threshold',
			type: 'number',
			label: __( 'Low stock threshold', 'vulocart' ),
			minNumber: 0,
			settingDescription: __(
				'A product with this many units or fewer is shown as low stock on the Dashboard and in Inventory.',
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
