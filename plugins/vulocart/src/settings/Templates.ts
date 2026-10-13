import { __ } from '@wordpress/i18n';
import TemplatesPanel from '../components/Settings/TemplatesPanel';

/**
 * Settings → Templates ("Start from a template"): the storefront catalog layout. A custom panel
 * (PanelComponent, same escape hatch the Licensing tab uses) because a visual picker isn't a
 * declarative zyra field. Sits between General (1) and Commerce (2).
 */
export default {
	id: 'templates',
	priority: 1.5,
	headerTitle: __( 'Start from a template', 'vulocart' ),
	headerDescription: __( 'Pick how your offerings catalog looks on the storefront. You can still override it on a single page from the block settings.', 'vulocart' ),
	headerIcon: 'catalog',
	submitUrl: 'settings',
	modal: [],
	PanelComponent: TemplatesPanel,
};
