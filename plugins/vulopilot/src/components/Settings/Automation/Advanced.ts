import { __ } from '@wordpress/i18n';

/**
 * Settings → Automation → Advanced ("Advanced Automation Settings").
 *
 * Replaces the earlier Automation/AutomationSchedule.ts (same file, same
 * real settings, renamed/restyled per direct instruction after a follow-up
 * mockup showed this content under a differently-worded "Advanced" tab
 * instead) — `automation_cooldown_minutes`/`automation_max_retries`/
 * `automation_retry_delay_minutes` are the exact same real setting keys
 * that file used, so no migration of already-saved values is needed.
 *
 * The mockup's own per-row icon box + a second "Cooldown duration"-style
 * label above a value+unit-dropdown control (e.g. "60" next to a
 * "minutes" ▾) isn't a real, existing zyra field shape — there's no
 * compound number+select input in this codebase's FIELD_REGISTRY, and
 * every one of these 3 settings only ever has exactly one real unit
 * (minutes or times; nothing here reads/writes an alternate unit), so a
 * literal dropdown would be a control that can't actually do anything.
 * Kept as real `type: 'number'` fields (same as before) with the unit
 * folded into the label, same convention this plugin's other duration
 * settings already use (e.g. Settings/Scanning's own frequency fields) —
 * honest and fully functional over visually matching a control with no
 * real second state.
 *
 * headerTitle vs settingTitle: same split General.ts's own "General"
 * (sidebar) / "Site Monitoring" (page heading) already establishes —
 * NavigatorComponent renders the sidebar entry from `headerTitle` and the
 * page's own heading from `settingTitle ?? headerTitle`, so the sidebar
 * can stay short ("Advanced") while the page heading matches the mockup's
 * longer "Advanced Automation Settings".
 */
export default {
	id: 'advanced',
	priority: 3,
	headerTitle: __( 'Advanced', 'vulopilot' ),
	settingTitle: __( 'Advanced Automation Settings', 'vulopilot' ),
	headerDescription: __(
		'Fine-tune how VuloPilot runs automated actions in the background.',
		'vulopilot'
	),
	headerIcon: 'settings',
	submitUrl: 'settings',
	modal: [
		{
			key: 'automation_cooldown_minutes',
			type: 'number',
			size: 8,
			label: __( 'Cooldown duration (minutes)', 'vulopilot' ),
			minNumber: 1,
			maxNumber: 1440,
			settingDescription: __(
				'Minimum time VuloPilot waits before taking another automated action for the same issue. Helps prevent repeated actions in a short period.',
				'vulopilot'
			),
			// The whole trigger→action AutomationEngine this cooldown
			// guards lives in vulopilot-pro's Automation module — the
			// setting has nothing to configure without it.
			moduleEnabled: 'automation',
		},
		{
			key: 'automation_max_retries',
			type: 'number',
			size: 8,
			label: __( 'Maximum retry attempts (times)', 'vulopilot' ),
			minNumber: 0,
			maxNumber: 5,
			settingDescription: __(
				"Number of times VuloPilot will retry a failed automation before giving up. Set how many retries should be attempted.",
				'vulopilot'
			),
			moduleEnabled: 'automation',
		},
		{
			key: 'automation_retry_delay_minutes',
			type: 'number',
			size: 8,
			label: __( 'Delay between retries (minutes)', 'vulopilot' ),
			minNumber: 1,
			maxNumber: 1440,
			settingDescription: __(
				'Time VuloPilot waits between retry attempts. Increasing the delay can improve success rate for temporary issues.',
				'vulopilot'
			),
			moduleEnabled: 'automation',
		},
		{
			// Same real `type: 'notice'` field Scanning/SeoContent.ts's own
			// sitemap tips already use.
			key: 'advanced-automation-notice',
			type: 'notice',
			noticeType: 'info',
			title: __( 'About these settings', 'vulopilot' ),
			message: __(
				'Advanced automation settings help control how VuloPilot performs actions safely and efficiently. We recommend keeping the default values unless you have a specific reason to change them.',
				'vulopilot'
			),
		},
	],
};
