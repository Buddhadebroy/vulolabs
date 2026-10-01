import { __ } from '@wordpress/i18n';

/**
 * Only `id`/`priority`/`headerTitle`/`headerIcon` are actually used.
 */
export default {
	id: 'modules',
	priority: 10,
	headerTitle: __('Modules', 'vulopilot'),
	headerDescription: __(
		'Enable or disable optional VuloPilot features.',
		'vulopilot'
	),
	hideSettingHeader: true,
	headerIcon: 'module',
	submitUrl: 'settings',
	modal: [],
};
