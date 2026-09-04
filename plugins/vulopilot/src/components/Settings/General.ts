import { __ } from '@wordpress/i18n';

export default {
	id: 'general',
	priority: 1,
	headerTitle: __('General', 'vulopilot'),
	settingTitle: __('Site Monitoring', 'vulopilot'),
	headerDescription: __('Configure how vuloPilot monitors your site for issues.', 'vulopilot'),
	headerIcon: 'setting',
	submitUrl: 'settings',
	hideSettingHeader: true,
	// Opts this tab into InputRenderer's `groupBySections` card layout
	// (Settings.tsx forwards it per-tab) — nests each field after a
	// `type: 'section'` entry under that section's own card instead of
	// rendering `modal` as one flat list, matching
	// NavigatorComponent's own "Default" Storybook story.
	groupBySections: true,
	modal: [
		{
			key: 'general_settings',
			type: 'section',
			icon: 'setting',
			title: __('Site Monitoring', 'vulopilot'),
			desc: __('Configure how vuloPilot monitors your site for issues.', 'vulopilot'),
		},
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
			icon: 'setting',
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
			//
			// This setting itself now round-trips correctly (a real
			// default in Utill::VULOPILOT_SETTINGS_DEFAULTS), but no
			// telemetry collector exists anywhere in this codebase to
			// gate on it — there's no outbound "usage" request for this
			// toggle to turn on or off yet. Left in (rather than removed)
			// since the setting is real and forward-looking, but the
			// description below says so honestly instead of implying a
			// data collection pipeline that doesn't exist.
			key: 'anonymous_usage_data',
			type: 'choice-toggle',
			size: 20,
			label: __('Anonymous usage data', 'vulopilot'),
			settingDescription: __(
				"Help improve VuloPilot by sharing anonymous information about how its features are used. Not yet collected — this stores your preference for when usage reporting ships.",
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
			icon: 'refresh',
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
