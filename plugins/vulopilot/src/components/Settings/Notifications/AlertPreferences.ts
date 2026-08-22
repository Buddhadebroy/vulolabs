import { __ } from '@wordpress/i18n';

/**
 * Settings → Notifications → Alert Preferences.
 *
 * Previously the bottom half of the flat Settings/Notifications.ts file —
 * split out alongside EmailSettings.ts (see that file's own docblock for
 * why). Same real `notify_on_critical_findings`/`email_on_*` setting keys,
 * unchanged.
 */
export default {
	id: 'alert-preferences',
	priority: 2,
	headerTitle: __('Alert Preferences', 'vulopilot'),
	headerDescription: __(
		'Choose which score drops and findings VuloPilot should email you about.',
		'vulopilot'
	),
	headerIcon: 'bell',
	submitUrl: 'settings',
	modal: [
		{
			key: 'notify_on_critical_findings',
			type: 'checkbox',
			look: 'toggle',
			label: __('Email me on critical findings', 'vulopilot'),
			settingDescription: __(
				'Send an email whenever a scan raises a new critical-severity finding.',
				'vulopilot'
			),
			options: [
				{ key: 'notify_on_critical_findings', label: '', value: 'notify_on_critical_findings' },
			],
		},
		{
			key: 'email_on_geo_score_drop',
			type: 'checkbox',
			look: 'toggle',
			label: __('Email me when GEO/AEO score drops', 'vulopilot'),
			settingDescription: __(
				'Alerts when a post\'s GEO or AEO score falls by the threshold configured under Scanning → AEO.',
				'vulopilot'
			),
			options: [
				{ key: 'email_on_geo_score_drop', label: '', value: 'email_on_geo_score_drop' },
			],
		},
		{
			key: 'email_on_brand_score_drop',
			type: 'checkbox',
			look: 'toggle',
			label: __('Email me when Brand score drops', 'vulopilot'),
			settingDescription: __(
				'Alerts when the sitewide Brand score falls by the threshold configured under Scanning → Brand Intelligence.',
				'vulopilot'
			),
			options: [
				{ key: 'email_on_brand_score_drop', label: '', value: 'email_on_brand_score_drop' },
			],
		},
		{
			key: 'email_on_kg_health_drop',
			type: 'checkbox',
			look: 'toggle',
			label: __('Email me when Knowledge Graph Health drops', 'vulopilot'),
			settingDescription: __(
				'Alerts when the Knowledge Graph Health score falls by the threshold configured under Scanning → Entity Extraction.',
				'vulopilot'
			),
			options: [
				{ key: 'email_on_kg_health_drop', label: '', value: 'email_on_kg_health_drop' },
			],
		},
		{
			key: 'email_on_crawler_alerts',
			type: 'checkbox',
			look: 'toggle',
			label: __('Email me on AI crawler alerts', 'vulopilot'),
			settingDescription: __(
				'Alerts when AI crawler visit volume drops sharply, or when a bot keeps hitting a page robots.txt disallows for it. Threshold configured under Scanning → Crawler Analytics.',
				'vulopilot'
			),
			options: [
				{ key: 'email_on_crawler_alerts', label: '', value: 'email_on_crawler_alerts' },
			],
		},
	],
};
