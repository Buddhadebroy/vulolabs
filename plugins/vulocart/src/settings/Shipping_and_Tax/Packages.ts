import { __ } from '@wordpress/i18n';
import { proSettingsPanel } from '../../components/Settings/ProSettingsPanel';

/**
 * Settings → Shipping & Tax → Packages. The tab is always listed; vulocart-pro fills it in through `vulocart_settings_panel_shipping-packaging`, and until
 * then the panel says what to do - turn the module on, or get Pro.
 */
const view = {
	title: __( 'Packages', 'vulocart' ),
	description: __( 'The boxes and envelopes you ship in. The default one is pre-selected when you create a shipment.', 'vulocart' ),
	icon: 'store-inventory',
	module: 'shipping',
	pro: true,
};

export default {
	id: 'shipping-packaging',
	priority: 3,
	headerTitle: view.title,
	headerDescription: view.description,
	headerIcon: view.icon,
	hideSettingHeader: true,
	submitUrl: 'settings',
	modal: [],
	PanelComponent: proSettingsPanel( 'shipping-packaging', view ),
};
