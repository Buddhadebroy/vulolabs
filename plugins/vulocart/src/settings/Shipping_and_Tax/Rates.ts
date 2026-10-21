import { __ } from '@wordpress/i18n';
import ShippingRatesExtra from '../../components/Settings/ShippingRatesExtra';

/**
 * Settings → Shipping & Tax → Rates. The flat rate every order gets when no zone rate matches (0 = free shipping),
 * then - with vulocart-pro - the zone rates, which layer on top of it and never replace it. The Shipping module
 * being active is what turns shipping on. Backed by `Utill::SETTINGS_DEFAULTS`' Shipping section and read by
 * `Shipping\Application\ShippingService`; Pro's rates list is added below through `vulocart_shipping_rates`.
 */
export default {
	id: 'shipping',
	priority: 1,
	headerTitle: __( 'Shipping rates', 'vulocart' ),
	headerIcon: 'shipping',
	groupBySections: true,
	hideSettingHeader: true,
	submitUrl: 'settings',
	modal: [
		{
			key: 'shipping-section-flat-rate',
			type: 'section',
			icon: 'shipping',
			title: __( 'Flat rate', 'vulocart' ),
			desc: __(
				'The shipping charge every order gets when no zone rate applies.',
				'vulocart'
			),
		},
		{
			key: 'flat_rate_shipping_cost',
			type: 'number',
			moduleEnabled: 'shipping',
			label: __( 'Flat rate shipping cost', 'vulocart' ),
			minNumber: 0,
			settingDescription: __(
				'A single flat shipping charge added to every order. Leave it at 0 for free shipping. Switch the whole Shipping module off under Modules to stop offering shipping.',
				'vulocart'
			),
		},
	],
	AfterComponent: ShippingRatesExtra,
};
