import { __ } from '@wordpress/i18n';

export default {
	id: 'advanced',
	priority: 1,
	headerTitle: __('Advanced', 'vulopilot'),
	headerIcon: 'tools',
	submitUrl: 'settings',
	modal: [
		{
			key: 'enable_debug_logging',
			type: 'checkbox',
			look: 'toggle',
			label: __('Enable debug logging', 'vulopilot'),
			desc: __(
				'Writes report-generation failures to the server error log, in addition to the failure reason already shown on the Reports page. Leave off unless you\'re actively debugging.',
				'vulopilot'
			),
			options: [
				{ key: 'enable_debug_logging', label: '', value: 'enable_debug_logging' },
			],
		},
		{
			key: 'reset_settings',
			type: 'button',
			name: __('Reset', 'vulopilot'),
			label: __('Reset All Settings', 'vulopilot'),
			position: 'left',
			desc: __(
				'Restores every VuloPilot setting on this site to its default value. Findings, history, and connected AI provider keys are not affected.',
				'vulopilot'
			),
			redirect_url: '',
		},
	],
};
