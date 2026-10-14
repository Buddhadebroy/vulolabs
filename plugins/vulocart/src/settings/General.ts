import { __ } from '@wordpress/i18n';

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
			key: 'default_product_status',
			type: 'select',
			label: __( 'Default product status', 'vulocart' ),
			settingDescription: __(
				'Status a new product gets when none is specified.',
				'vulocart'
			),
			options: [
				{ label: __( 'Draft', 'vulocart' ), value: 'draft' },
				{ label: __( 'Published', 'vulocart' ), value: 'published' },
			],
		},
		{
			key: 'general-section-checkout-block',
			type: 'section',
			icon: 'storefront',
			title: __( 'Checkout block', 'vulocart' ),
			desc: __(
				'What the storefront checkout block shows and whether it accepts orders at all.',
				'vulocart'
			),
		},
		{
			key: 'enable_products_listing',
			type: 'checkbox',
			look: 'toggle',
			label: __( 'Show products listing', 'vulocart' ),
			settingDescription: __(
				'Show the "Available Products" catalog-browsing section on the storefront checkout page.',
				'vulocart'
			),
			options: [
				{ key: 'enable_products_listing', label: '', value: 'enable_products_listing' },
			],
		},
		{
			key: 'enable_cart_checkout',
			type: 'checkbox',
			look: 'toggle',
			label: __( 'Enable cart & checkout', 'vulocart' ),
			settingDescription: __(
				'Turn off to take the storefront checkout page offline temporarily - visitors see an "unavailable" notice instead of the cart/checkout flow.',
				'vulocart'
			),
			options: [
				{ key: 'enable_cart_checkout', label: '', value: 'enable_cart_checkout' },
			],
		},
	],
};
