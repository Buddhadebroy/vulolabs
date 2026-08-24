import { __ } from '@wordpress/i18n';

export default {
	id: 'general',
	priority: 1,
	headerTitle: __('General', 'vulopilot'),
	settingTitle: __('Site Monitoring', 'vulopilot'),
	headerDescription: __('Configure how vuloPilot monitors your site for issues.', 'vulopilot'),
	headerIcon: 'setting',
	submitUrl: 'settings',
	modal: [
		{
			key: 'automatic_site_scan',
			type: 'choice-toggle',
			size: 20,
			label: __('Automatic site scans', 'vulopilot'),
			settingDescription: __(
				'When enabled, VuloPilot will automatically scan your site for issues based on the schedule below.',
				'vulopilot'
			),
			desc: __('If disabled, you can still run manual scans from the dashboard.', 'vulopilot'),
			options: [
				{ label: __('Enabled', 'vulopilot'), value: 'enabled' },
				{ label: __('Disabled', 'vulopilot'), value: 'disabled' },
			],
		},
		{
			key: 'scan_frequency',
			type: 'select',
			size: 20,
			label: __('Default scan frequency', 'vulopilot'),
			settingDescription: __(
				'How often VuloPilot should automatically scan your site.',
				'vulopilot'
			),
			desc: __(
				'Choose how often to run automatic scans. You can also run a manual scan anytime.',
				'vulopilot'
			),
			options: [
				{ label: __('Hourly', 'vulopilot'), value: 'hourly' },
				{ label: __('Daily', 'vulopilot'), value: 'daily' },
				{ label: __('Weekly', 'vulopilot'), value: 'weekly' },
			],
		},
		{
			// Moved from Settings → Scanning → Security's own stray
			// "Performance" section (see Security.ts's own docblock) — not
			// a security setting, and Security is now scoped to exactly
			// what its own mockup shows. Sits next to `scan_frequency`
			// since it's the same kind of scan-behavior toggle.
			key: 'mobile_core_web_vitals',
			type: 'checkbox',
			look: 'toggle',
			label: __('Include mobile Core Web Vitals', 'vulopilot'),
			settingDescription: __(
				'Run Core Web Vitals checks against mobile as well as desktop.',
				'vulopilot'
			),
			options: [
				{ key: 'mobile_core_web_vitals', label: '', value: 'mobile_core_web_vitals' },
			],
		},
		{
			key: 'general-section',
			type: 'section',
			title: __('Basic Preferences', 'vulopilot'),
			desc: __(
				'Essential plugin preferences and data handling options.',
				'vulopilot'
			),
		},
		{
			key: 'keep_data_uninstall',
			type: 'choice-toggle',
			size: 20,
			label: __('Keep VuloPilot data after uninstall', 'vulopilot'),
			settingDescription: __(
				"Choose what happens to VuloPilot's settings and saved data if the plugin is removed.",
				"vulopilot"
			),
			// Real HTML, not plain text — InputRenderer renders `desc` via
			// `dangerouslySetInnerHTML` (same as Notifications.ts's own
			// button descriptions), so a `<br />` here is safe and is the
			// only way to get the mockup's two-line numbered list without
			// a bespoke desc renderer just for this one field.
			desc: __(
				'1. Keep data — Your settings, scan history, and reports remain available if you reinstall VuloPilot.<br />2. Delete everything — Permanently removes VuloPilot settings and stored data when the plugin is uninstalled.',
				'vulopilot'
			),
			options: [
				{ label: __('Keep data', 'vulopilot'), value: 'keep_data' },
				{ label: __('Delete everything', 'vulopilot'), value: 'delete_everything' },
			],
		},
		{
			// Previously shared the 'automatic_site_scan' key with the
			// scan toggle above — SettingContext keys its stored value by
			// field key, so the two toggles were silently reading/writing
			// the same state and always moved together. Real own key here.
			key: 'anonymous_usage_data',
			type: 'choice-toggle',
			size: 20,
			label: __('Anonymous usage data', 'vulopilot'),
			settingDescription: __(
				"Help improve VuloPilot by sharing anonymous information about how its features are used.",
				'vulopilot'
			),
			desc: __(
				'No website content, passwords, customer information, or personal data is collected.',
				'vulopilot'
			),
			options: [
				{ label: __('Enabled', 'vulopilot'), value: 'enabled' },
				{ label: __('Disabled', 'vulopilot'), value: 'disabled' },
			],
		},
		{
			// Same real `POST /settings/reset` route Notifications.ts's
			// "Send test email" button already calls via `apilink` —
			// Controllers\Settings::reset_settings() deletes the whole
			// stored settings option (every tab, not just General),
			// reverting to VULOPILOT_SETTINGS_DEFAULTS. Findings/scan
			// history/reports live in their own tables, untouched by this,
			// which is what the desc below states.
			key: 'reset_settings',
			type: 'button',
			name: __('Reset settings', 'vulopilot'),
			label: __('Reset VuloPilot', 'vulopilot'),
			settingDescription: __(
				'Restore VuloPilot settings to their original defaults.',
				'vulopilot'
			),
			desc: __(
				'Your existing scan reports and history will not be deleted.',
				'vulopilot'
			),
			apilink: 'settings/reset',
			method: 'POST',
			position: 'left',
		},
	],
};
