import { __ } from '@wordpress/i18n';

export default {
	id: 'general',
	priority: 1,
	headerTitle: __('General', 'vulopilot'),
	headerDescription: __('Basic scanning behavior for your site.', 'vulopilot'),
	headerIcon: 'setting',
	submitUrl: 'settings',
	modal: [
		{
			key: 'scan_frequency',
			type: 'select',
			size: 20,
			label: __('Scan Frequency', 'vulopilot'),
			settingDescription: __(
				'How often VuloPilot re-audits your site.',
				'vulopilot'
			),
			options: [
				{ label: __('Hourly', 'vulopilot'), value: 'hourly' },
				{ label: __('Daily', 'vulopilot'), value: 'daily' },
				{ label: __('Weekly', 'vulopilot'), value: 'weekly' },
			],
			// The recurring wp-cron Scheduler this setting configures lives
			// entirely in vulopilot-pro's Automation module ("Scheduled
			// Website Scans" per the readme) — without that module active,
			// Free only runs on-demand, manually-triggered scans and this
			// value is inert.
			moduleEnabled: 'automation',
		},
		{
			key: 'dashboard_layout_notice',
			type: 'notice',
			label: '',
			noticeType: 'info',
			message: __(
				'Dashboard widget layout (which widgets show and in what order) is managed from the Dashboard page itself — drag and drop, or hide/show a widget directly there — not from Settings.',
				'vulopilot'
			),
		},
	],
};
