import { __ } from '@wordpress/i18n';
import { getCountries } from '../../blocks/shared/geo';
import TaxRatesPanel from '../../components/Settings/TaxRatesPanel';

/**
 * Settings → Shipping & Tax → Tax: how tax is worked out (the fields), then the tax classes and rate table (a custom
 * panel drawn after them, `PanelComponent`). Each product's tax class is on its edit page. Read by `Taxes\Application\TaxService`, which applies them server-side
 * to every order total. The Taxes module being on is what turns tax calculation on.
 */
export default {
	id: 'taxes',
	priority: 4,
	headerTitle: __( 'Tax', 'vulocart' ),
	headerIcon: 'tax-compliance',
	groupBySections: true,
	hideSettingHeader: true,
	submitUrl: 'settings',
	PanelComponent: TaxRatesPanel,
	modal: [
		{
			key: 'taxes-section-calculation',
			type: 'section',
			icon: 'tax-compliance',
			title: __( 'Calculation', 'vulocart' ),
			desc: __(
				'Which address decides the tax, whether shipping is taxed, and whether your prices already include it.',
				'vulocart'
			),
		},
		{
			key: 'tax_based_on',
			type: 'select',
			moduleEnabled: 'taxes',
			label: __( 'Calculate tax based on', 'vulocart' ),
			settingDescription: __(
				'Most places tax by where the goods are delivered. Digital sales in the EU follow the buyer\'s billing country.',
				'vulocart'
			),
			options: [
				{ label: __( 'Shipping address', 'vulocart' ), value: 'shipping' },
				{ label: __( 'Billing address', 'vulocart' ), value: 'billing' },
				{ label: __( 'Store address', 'vulocart' ), value: 'store' },
			],
		},
		{
			key: 'prices_include_tax',
			type: 'checkbox',
			moduleEnabled: 'taxes',
			look: 'toggle',
			label: __( 'Prices already include tax', 'vulocart' ),
			settingDescription: __(
				'On: the tax is taken out of the listed price and shown as "includes". Off: tax is added on top at checkout.',
				'vulocart'
			),
			options: [
				{ key: 'prices_include_tax', label: '', value: 'prices_include_tax' },
			],
		},
		{
			key: 'tax_shipping',
			type: 'checkbox',
			moduleEnabled: 'taxes',
			look: 'toggle',
			label: __( 'Charge tax on shipping', 'vulocart' ),
			settingDescription: __(
				'Also tax the shipping charge, using the rates marked "Applies to shipping". Needs tax rates to be entered below.',
				'vulocart'
			),
			options: [
				{ key: 'tax_shipping', label: '', value: 'tax_shipping' },
			],
		},
		{
			key: 'taxes-section-store',
			type: 'section',
			icon: 'storefront',
			title: __( 'Store address', 'vulocart' ),
			desc: __(
				'Where you sell from. Used when tax is based on the store address, and as the fallback when an order has no address yet.',
				'vulocart'
			),
		},
		{
			key: 'store_country',
			type: 'select',
			moduleEnabled: 'taxes',
			label: __( 'Country', 'vulocart' ),
			options: [ { label: __( 'Select a country…', 'vulocart' ), value: '' }, ...getCountries() ],
		},
		{
			key: 'store_state',
			type: 'text',
			moduleEnabled: 'taxes',
			label: __( 'State / region code', 'vulocart' ),
			settingDescription: __( 'The code your tax rates use, e.g. CA, NY, KA. Leave empty if you have none.', 'vulocart' ),
		},
	],
};
