import { __ } from '@wordpress/i18n';

/**
 * Backed by `Utill::SETTINGS_DEFAULTS`'s Advanced section.
 * `enable_debug_logging` is genuinely read by `Utill::log()` - the sole
 * catch-and-record path for a broken module's constructor
 * (Modules::load_active_modules()) - mirrors
 * VuloPilot\Utill::log()'s identical gate/precedent exactly.
 *
 * Deliberately kept as a standalone top-level file (not folded into a
 * folder) - priority 4 sorts it after the folders
 * (General=1/Commerce=2/Integrations=3, see each folder's own
 * FolderPriority.ts) at the top-level nav.
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
