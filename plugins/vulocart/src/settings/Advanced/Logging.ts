import { __ } from '@wordpress/i18n';

/**
 * Backed by the Advanced section of `Utill::SETTINGS_DEFAULTS`. `enable_debug_logging` is read by `Utill::log()`,
 * which records the exceptions Modules::load_active_modules() catches when a module's constructor fails.
 *
 * This is a standalone top-level file, not part of a folder. Priority 4 sorts it after the folders (General=1,
 * Commerce=2, Integrations=3; see each folder's FolderPriority.ts).
 */
export default {
	id: 'advanced',
	priority: 8,
	headerTitle: __( 'Advanced', 'vulocart' ),
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
				'Writes module-loading failures to the server error log. Leave off unless you\'re actively debugging.',
				'vulocart'
			),
			options: [
				{ key: 'enable_debug_logging', label: '', value: 'enable_debug_logging' },
			],
		},
	],
};
