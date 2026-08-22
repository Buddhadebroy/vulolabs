import { __, sprintf } from '@wordpress/i18n';

// Shared by every field below the master "Enabled" toggle — same
// `dependent` shape AiCrawlerAlerts.ts's own MASTER_ENABLED_DEPENDENT
// already uses, this tab's own master switch key instead.
const MASTER_ENABLED_DEPENDENT = { key: 'email_on_visibility_alerts', value: 'email_on_visibility_alerts', set: true };

// Shared by all 3 panel items' own threshold select — same real
// point-drop values GeoAnalyzer/VisibilityMonitor/BrandMonitor/
// KnowledgeGraphHealthMonitor's own `absint($alert['threshold'] ?? 5)`
// already accepts.
const THRESHOLD_OPTIONS = [5, 10, 20, 30].map((points) => ({
	label: sprintf(__('%d%% or more', 'vulopilot'), points),
	value: String(points),
}));

/**
 * Settings → Notifications → Visibility Alerts.
 *
 * Real backend: three independent score-drop checks — GeoAnalysis\GeoAnalyzer
 * (per-post) and vulopilot-pro's GeoInsights\VisibilityMonitor (sitewide
 * sampled average) both read the 'geo' panel below (one shared threshold,
 * same reasoning this setting's own Utill.php docblock gives — AEO has no
 * separate category from GEO's own), vulopilot-pro's
 * BrandIntelligence\BrandMonitor reads 'brand', and vulopilot-pro's
 * KnowledgeGraph\KnowledgeGraphHealthMonitor reads 'kg' — each already sent
 * a real email on its own before this tab existed. `email_on_visibility_alerts`
 * (this tab's own master switch) additionally gates all three without
 * touching any of their own stored `enable`/`threshold` values.
 *
 * "Notify me when" is a real zyra `type: 'expandable-panel'` field — same
 * component 'crawler_alerts' below (AiCrawlerAlerts.ts) already uses, one
 * unified panel group covering all three score types. Each panel's own
 * `enable`/`threshold` writes into the single nested `visibility_alerts`
 * setting (`{ geo: {enable, threshold}, brand: {...}, kg: {...} }`,
 * Utill::VULOPILOT_SETTINGS_DEFAULTS), not three flat settings — see that
 * constant's own docblock.
 *
 * "Notification channels" mirrors AiCrawlerAlerts.ts's own
 * `crawler_alert_channels` field exactly: real 'email'/'dashboard' values
 * (every backend class above now logs a real ActivityLogRepository entry
 * when 'dashboard' is enabled, visible under Settings → History), its own
 * independent `visibility_alert_channels` key so this family of alerts can
 * be routed differently than crawler/security alerts. No 'mobile' option
 * for the same reason those two tabs already document — no real
 * push-delivery mechanism exists anywhere in this codebase yet.
 */
export default {
	id: 'visibility-alerts',
	priority: 4,
	headerTitle: __('Visibility Alerts', 'vulopilot'),
	headerDescription: __(
		'Get notified when your visibility scores drop so you can take action early.',
		'vulopilot'
	),
	headerIcon: 'bar-chart',
	submitUrl: 'settings',
	modal: [
		{
			key: 'email_on_visibility_alerts',
			type: 'checkbox',
			look: 'toggle',
			label: __('Enabled', 'vulopilot'),
			settingDescription: __(
				'Master switch for every Visibility Alert below — turn this off to silence all of them at once.',
				'vulopilot'
			),
			options: [
				{ key: 'email_on_visibility_alerts', label: '', value: 'email_on_visibility_alerts' },
			],
		},
		{
			key: 'visibility-alerts-notify-section',
			type: 'section',
			title: __('Notify me when', 'vulopilot'),
			dependent: MASTER_ENABLED_DEPENDENT,
		},
		{
			// One unified panel group for all 3 rows, a fixed, non-addable
			// set (no `addNewBtn`), each `disableBtn: true` so its header
			// shows a real Enable/Settings/Disable control instead of an
			// always-on toggle — same shape 'crawler_alerts' below uses.
			key: 'visibility_alerts',
			type: 'expandable-panel',
			label: '',
			dependent: MASTER_ENABLED_DEPENDENT,
			modal: [
				{
					id: 'geo',
					icon: 'ai',
					label: __('AI visibility score drop', 'vulopilot'),
					desc: __(
						'When your overall AI visibility score drops by the selected percentage.',
						'vulopilot'
					),
					settingDescription: __(
						'When your overall AI visibility score drops by the selected percentage.',
						'vulopilot'
					),
					disableBtn: true,
					statusLabels: { active: __('Enabled', 'vulopilot'), inactive: __('Disabled', 'vulopilot') },
					formFields: [
						{
							key: 'threshold',
							type: 'select',
							label: __('Notify me if score drops by', 'vulopilot'),
							options: THRESHOLD_OPTIONS,
						},
					],
				},
				{
					id: 'brand',
					icon: 'announcement',
					label: __('Brand score drop', 'vulopilot'),
					desc: __(
						'When your brand visibility score drops by the selected percentage.',
						'vulopilot'
					),
					settingDescription: __(
						'When your brand visibility score drops by the selected percentage.',
						'vulopilot'
					),
					disableBtn: true,
					statusLabels: { active: __('Enabled', 'vulopilot'), inactive: __('Disabled', 'vulopilot') },
					formFields: [
						{
							key: 'threshold',
							type: 'select',
							label: __('Notify me if score drops by', 'vulopilot'),
							options: THRESHOLD_OPTIONS,
						},
					],
				},
				{
					id: 'kg',
					icon: 'intelligence',
					label: __('Knowledge Graph score drop', 'vulopilot'),
					desc: __(
						'When your Knowledge Graph score drops by the selected percentage.',
						'vulopilot'
					),
					settingDescription: __(
						'When your Knowledge Graph score drops by the selected percentage.',
						'vulopilot'
					),
					disableBtn: true,
					statusLabels: { active: __('Enabled', 'vulopilot'), inactive: __('Disabled', 'vulopilot') },
					formFields: [
						{
							key: 'threshold',
							type: 'select',
							label: __('Notify me if score drops by', 'vulopilot'),
							options: THRESHOLD_OPTIONS,
						},
					],
				},
			],
		},
		{
			key: 'visibility-alerts-channels-section',
			type: 'section',
			title: __('Notification channels', 'vulopilot'),
			dependent: MASTER_ENABLED_DEPENDENT,
		},
		{
			key: 'visibility_alert_channels',
			type: 'checkbox',
			label: '',
			dependent: MASTER_ENABLED_DEPENDENT,
			options: [
				{ key: 'email', value: 'email', label: __('Email', 'vulopilot') },
				{ key: 'dashboard', value: 'dashboard', label: __('In-dashboard', 'vulopilot') },
			],
		},
		{
			key: 'visibility-alerts-notice',
			type: 'notice',
			noticeType: 'info',
			title: __('Stay ahead of visibility drops', 'vulopilot'),
			message: __(
				'These alerts help you catch issues early before they impact your traffic, rankings, and AI visibility. Mobile push notifications aren\'t available yet — Email and In-dashboard are the two real delivery channels today.',
				'vulopilot'
			),
			dependent: MASTER_ENABLED_DEPENDENT,
		},
	],
};
