import { __ } from '@wordpress/i18n';
import { proSettingsPanel } from '../../components/Settings/ProSettingsPanel';

/**
 * Settings → Shipping & Tax → Zones. The tab is always listed; vulocart-pro fills it in through `vulocart_settings_panel_shipping-zones`, and until
 * then the panel says what to do - turn the module on, or get Pro.
 */
const view = {
	title: __( 'Zones', 'vulocart' ),
	description: __( 'Where you ship: countries and regions. What each zone costs is set under Rates.', 'vulocart' ),
	icon: 'shipping',
	module: 'shipping',
	pro: true,
};

export default {
	id: 'shipping-zones',
	priority: 2,
	headerTitle: view.title,
	headerDescription: view.description,
	headerIcon: view.icon,
	hideSettingHeader: true,
	submitUrl: 'settings',
	modal: [],
	PanelComponent: proSettingsPanel( 'shipping-zones', view ),
};
