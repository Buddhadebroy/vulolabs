import { __ } from '@wordpress/i18n';
import { proSettingsPanel } from '../components/Settings/ProSettingsPanel';

/**
 * Settings → Licensing. The tab is always listed; vulocart-pro fills it in through `vulocart_settings_panel_licensing`, and until
 * then the panel says what to do - turn the module on, or get Pro.
 */
const view = {
	title: __( 'Licensing', 'vulocart' ),
	description: __( 'Activate your VuloCart Pro license.', 'vulocart' ),
	icon: 'lock',
	module: 'licensing',
	pro: true,
};

export default {
	id: 'licensing',
	priority: 90,
	headerTitle: view.title,
	headerDescription: view.description,
	headerIcon: view.icon,
	hideSettingHeader: true,
	submitUrl: 'settings',
	modal: [],
	PanelComponent: proSettingsPanel( 'licensing', view ),
};
