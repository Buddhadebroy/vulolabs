import { __ } from '@wordpress/i18n';

/**
 * Backed by the Advanced section of `Utill::SETTINGS_DEFAULTS`. `enable_debug_logging` is read by `Utill::log()`,
 * which records the exceptions Modules::load_active_modules() catches when a module's constructor fails.
 *
 * First sub-tab of Settings → Advanced; the debug log itself is the next sub-tab (DebugLog.ts).
 */
export default {
	id: 'advanced',
	priority: 1,
	headerTitle: __( 'Logging', 'vulocart' ),
	headerIcon: 'tools',
	groupBySections: true,
	hideSettingHeader: true,
	submitUrl: 'settings',
	modal: [
		{
			key: 'advanced-section-debugging',
			type: 'section',
			icon: 'tools',
			title: __( 'Debugging', 'vulocart' ),
			desc: __(
				'Diagnostic logging for troubleshooting - leave off in normal operation.',
				'vulocart'
			),
		},
		{
			key: 'enable_debug_logging',
			type: 'checkbox',
			look: 'toggle',
			label: __( 'Enable debug logging', 'vulocart' ),
			settingDescription: __(
				'Records problems such as a module that failed to load in the debug log below. Leave off unless you are fixing a problem.',
				'vulocart'
			),
			options: [
				{ key: 'enable_debug_logging', label: '', value: 'enable_debug_logging' },
			],
		},
	],
};
