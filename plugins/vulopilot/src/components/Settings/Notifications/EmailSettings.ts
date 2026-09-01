import { __ } from '@wordpress/i18n';

/**
 * Settings → Notifications → Email Settings.
 *
 * Previously the top half of the flat Settings/Notifications.ts file (see
 * that file's own git history) — split out into this folder, mirroring
 * Settings/Scanning/'s own "one folder, several sub-tab files" shape
 * (AiVisibility.ts, SeoContent.ts, ...), each rendering as its own inner
 * tab via NavigatorComponent's existing recursive folder support (no new
 * component code needed — `getSettingById`/`getAvailableSettings` already
 * search/sort an arbitrarily-nested settings tree by file id). The alert
 * checkboxes that used to sit below these fields in the same flat list now
 * live in their own AlertPreferences.ts file alongside this one.
 *
 * `notification_email`/`email_from_name`/`email_from_address` are the same
 * real setting keys the old flat file used — unchanged, so no migration of
 * already-saved values is needed.
 */
export default {
	id: 'email-settings',
	priority: 1,
	headerTitle: __('Email Settings', 'vulopilot'),
	headerDescription: __(
		'Configure the email address where you want to receive VuloPilot notifications, and the sender details they\'re sent from.',
		'vulopilot'
	),
	headerIcon: 'mail',
	submitUrl: 'settings',
	modal: [
		{
			key: 'notification_email',
			type: 'email',
			size: 30,
			label: __('Notification email', 'vulopilot'),
			placeholder: __('noreply@yourstore.com', 'vulopilot'),
			settingDescription: __(
				'Where critical findings and automation failures are sent. Falls back to the site admin email when left blank.',
				'vulopilot'
			),
		},
		{
			key: 'email_from_name',
			type: 'text',
			size: 30,
			label: __('Sender name', 'vulopilot'),
			settingDescription: __(
				'The name VuloPilot\'s own emails (notifications, automation actions, scheduled reports) are sent from. Defaults to your site name.',
				'vulopilot'
			),
		},
		{
			key: 'email_from_address',
			type: 'email',
			label: __('Sender email', 'vulopilot'),
			size: 30,
			placeholder: __('noreply@yourstore.com', 'vulopilot'),
			settingDescription: __(
				'The address VuloPilot\'s own emails are sent from. Leave blank to use your site\'s default mail sender.',
				'vulopilot'
			),
		},
		{
			key: 'send_test_email',
			type: 'button',
			name: __('Send Test Email', 'vulopilot'),
			label: __('Send test email', 'vulopilot'),
			icon: 'send',
			settingDescription: __(
				'Sends a real email to the notification address above, using the from name/address configured above — confirms VuloPilot can actually deliver its notification emails on this site.',
				'vulopilot'
			),
			apilink: 'settings/test-email',
			method: 'POST',
			position: 'left',
		},
		{
			// Same real `type: 'notice'` field Scanning/SeoContent.ts's own
			// sitemap tips already use.
			key: 'send-test-email-notice',
			type: 'notice',
			noticeType: 'info',
			title: __('Why send a test email?', 'vulopilot'),
			message: __(
				'This helps you confirm that notifications are delivered to the right inbox and that your email settings are correct.',
				'vulopilot'
			),
		},
	],
};
