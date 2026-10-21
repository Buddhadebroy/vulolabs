import { __ } from '@wordpress/i18n';

/**
 * Settings → Modules sub-tab. Only `id`, `priority`, `headerTitle` and `headerIcon` are read by Settings.tsx and
 * NavigatorComponent; the other fields exist so this file has the same shape as every other `src/settings/*.ts` tab.
 */
export default {
	id: 'modules',
	// Last among the first-party tabs, after Advanced.
	priority: 9,
	headerTitle: __( 'Modules', 'vulocart' ),
	headerDescription: __(
		'Enable or disable VuloCart features. Turning a module on activates its settings and REST routes; turning it off hides them.',
		'vulocart'
	),
	hideSettingHeader: true,
	headerIcon: 'module',
	submitUrl: 'settings',
	modal: [],
};
