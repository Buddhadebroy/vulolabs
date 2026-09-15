import { __, sprintf } from '@wordpress/i18n';

// Shared by all 3 panel items' own threshold select — same real
// point-drop values GeoAnalyzer/VisibilityMonitor/BrandMonitor/
// KnowledgeGraphHealthMonitor's own `absint($alert['threshold'] ?? 5)`
// already accepts.
const THRESHOLD_OPTIONS = [5, 10, 20, 30].map((points) => ({
	label: sprintf(__('%d%% or more', 'vulopilot'), points),
	value: String(points),
}));

// Shared by every row's own `control.toggleStatusLabel` below — "On"/"Off"
// per direct instruction, same shape AiCrawlerAlerts.ts's own
// TOGGLE_STATUS_LABEL uses, rather than SettingToggle's own default
// "Enabled"/"Disabled" flip text.
const TOGGLE_STATUS_LABEL = { on: __('On', 'vulopilot'), off: __('Off', 'vulopilot') };

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
 * a real email on its own before this tab existed. The old
 * `email_on_visibility_alerts` master switch (and every field's own
 * `dependent` gate on it) was removed per direct instruction — it had no
 * real duplicate control anywhere else in this codebase, so all three rows
 * below are now always visible/active instead of hidden behind a switch
 * with no other way to turn it on.
 *
 * "Notify me when" is a real zyra `type: 'setting-row'` field (per direct
 * instruction — same field type 'crawler_alerts' in AiCrawlerAlerts.ts
 * already uses, with `control: { toggle: true, select: {...} }` for all
 * three rows since every score type here has a real threshold), one flat
 * row per score type, its own threshold select and on/off toggle both
 * visible at once — no expand/collapse step. Each row's own
 * `enable`/`threshold` still writes into the single nested
 * `visibility_alerts` setting (`{ geo: {enable, threshold}, brand: {...},
 * kg: {...} }`, Utill::VULOPILOT_SETTINGS_DEFAULTS), not three flat
 * settings — see that constant's own docblock. Persisting a row goes
 * through InputRenderer's normal auto-save path (SettingRowComponent's own
 * `resolveControl()` builds the real toggle/select pair and patches this
 * field's `value`/`onChange` itself) — no bespoke API-call component
 * needed, same as AiCrawlerAlerts.ts's own rows.
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
			// zyra's real `type: 'setting-row'` field (per direct
			// instruction) — one flat row per score type, each with its own
			// threshold select and on/off toggle both visible at once, no
			// expand/collapse step — same field type 'crawler_alerts' in
			// AiCrawlerAlerts.ts already uses. See this file's own docblock
			// for the value shape (unchanged from the old expandable-panel
			// field).
			label: __('Notify me when', 'vulopilot'),
			key: 'visibility_alerts',
			type: 'setting-row',
			rows: [
				{
					valueKey: 'geo',
					icon: 'ai green',
					title: __('AI visibility score drop', 'vulopilot'),
					desc: __(
						'When your overall AI visibility score drops by the selected percentage.',
						'vulopilot'
					),
					control: {
						toggle: true,
						toggleStatusLabel: TOGGLE_STATUS_LABEL,
						select: {
							key: 'threshold',
							label: __('Notify me if score drops by', 'vulopilot'),
							options: THRESHOLD_OPTIONS,
						},
					},
				},
				{
					valueKey: 'brand',
					icon: 'announcement red',
					title: __('Brand score drop', 'vulopilot'),
					desc: __(
						'When your brand visibility score drops by the selected percentage.',
						'vulopilot'
					),
					control: {
						toggle: true,
						toggleStatusLabel: TOGGLE_STATUS_LABEL,
						select: {
							key: 'threshold',
							label: __('Notify me if score drops by', 'vulopilot'),
							options: THRESHOLD_OPTIONS,
						},
					},
				},
				{
					valueKey: 'kg',
					icon: 'intelligence yellow',
					title: __('Knowledge Graph score drop', 'vulopilot'),
					desc: __(
						'When your Knowledge Graph score drops by the selected percentage.',
						'vulopilot'
					),
					control: {
						toggle: true,
						toggleStatusLabel: TOGGLE_STATUS_LABEL,
						select: {
							key: 'threshold',
							label: __('Notify me if score drops by', 'vulopilot'),
							options: THRESHOLD_OPTIONS,
						},
					},
				},
			],
		},
		{
			key: 'visibility_alert_channels',
			type: 'checkbox',
			label: __('Notification channels', 'vulopilot'),
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
		},
	],
};
