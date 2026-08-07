import { __ } from '@wordpress/i18n';

export default {
	id: 'notifications',
	priority: 2,
	headerTitle: __('Notifications', 'vulopilot'),
	headerDescription: __(
		'Email alerts for scan findings and score changes.',
		'vulopilot'
	),
	headerIcon: 'mail',
	submitUrl: 'settings',
	modal: [
		{
			key: 'notification_email',
			type: 'email',
			classes: 'space-between',
			label: __('Notification email', 'vulopilot'),
			placeholder: __('noreply@yourstore.com', 'vulopilot'),
			settingDescription: __(
				'Where critical findings and automation failures are sent. Falls back to the site admin email when left blank.',
				'vulopilot'
			),
		},
		{
			key: 'notify_on_critical_findings',
			type: 'checkbox',
			look: 'toggle',
			classes: 'space-between border-top',
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
			classes: 'space-between border-top',
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
			classes: 'space-between border-top',
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
			classes: 'space-between border-top',
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
			classes: 'space-between border-top',
			label: __('Email me on AI crawler alerts', 'vulopilot'),
			settingDescription: __(
				'Alerts when AI crawler visit volume drops sharply, or when a bot keeps hitting a page robots.txt disallows for it. Threshold configured under Scanning → Crawler Analytics.',
				'vulopilot'
			),
			options: [
				{ key: 'email_on_crawler_alerts', label: '', value: 'email_on_crawler_alerts' },
			],
		},
		{
			key: 'email_from_name',
			type: 'text',
			classes: 'space-between border-top',
			label: __('Email from name', 'vulopilot'),
			settingDescription: __(
				'The name VuloPilot\'s own emails (notifications, automation actions, scheduled reports) are sent from. Defaults to your site name.',
				'vulopilot'
			),
		},
		{
			key: 'email_from_address',
			type: 'email',
			classes: 'space-between border-top',
			label: __('Email from address', 'vulopilot'),
			placeholder: __('noreply@yourstore.com', 'vulopilot'),
			settingDescription: __(
				'The address VuloPilot\'s own emails are sent from. Leave blank to use your site\'s default mail sender.',
				'vulopilot'
			),
		},
		{
			key: 'send_test_email',
			type: 'button',
			classes: 'space-between border-top',
			name: __('Send test email', 'vulopilot'),
			label: __('Test your email settings', 'vulopilot'),
			settingDescription: __(
				'Sends a real email to the notification address above, using the from name/address configured above — confirms VuloPilot can actually deliver its notification emails on this site.',
				'vulopilot'
			),
			apilink: 'settings/test-email',
			method: 'POST',
			position: 'left',
		},
	],
};
