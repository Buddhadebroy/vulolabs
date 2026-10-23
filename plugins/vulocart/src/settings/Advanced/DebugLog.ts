import { __ } from '@wordpress/i18n';
import DebugLogPanel from '../../components/Settings/DebugLogPanel';

/**
 * Settings → Advanced → Debug log. The whole sub-tab is the log viewer (`PanelComponent`), so it uses the full width
 * of the page instead of the label-left, field-right layout of a field list.
 */
export default {
	id: 'debug-log',
	priority: 2,
	headerTitle: __( 'Debug log', 'vulocart' ),
	headerIcon: 'tools',
	hideSettingHeader: true,
	submitUrl: 'settings',
	PanelComponent: DebugLogPanel,
	modal: [],
};
