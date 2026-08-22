import { __ } from '@wordpress/i18n';

/**
 * Settings → Automation → How VuloPilot Handles Issues.
 *
 * Previously the top of the flat Settings/Automation.ts file (see that
 * file's own git history) — split out into this folder, mirroring
 * Settings/Scanning/'s and Settings/Notifications/'s own "one folder,
 * several sub-tab files" shape, each rendering as its own inner tab via
 * NavigatorComponent's existing recursive folder support (no new component
 * code needed — `getSettingById`/`getAvailableSettings` already search/sort
 * an arbitrarily-nested settings tree by file id). The retry/approval
 * fields that used to sit below `automation_mode` in the same flat list now
 * live in their own ApprovalSettings.ts/Advanced.ts files alongside this
 * one. (A real run-history tab briefly lived here too, as ActivityLog.ts —
 * removed per direct instruction; automation run history is still real and
 * still reachable from the dashboard's own "Recent automation activity"
 * card/"View automation history" link, just not duplicated into Settings.)
 *
 * `automation_mode` is the same real setting key/values the old flat file
 * used — unchanged, so no migration of already-saved values is needed.
 */
export default {
	id: 'how-vulopilot-handles-issues',
	priority: 1,
	headerTitle: __('How VuloPilot Handles Issues', 'vulopilot'),
	headerDescription: __(
		'Choose how VuloPilot should handle issues it finds on your website.',
		'vulopilot'
	),
	headerIcon: 'automation',
	submitUrl: 'settings',
	modal: [
		{
			key: 'automation_mode',
			type: 'choice-toggle',
			custom: true,
			defaultValue: 'suggest',
			label: __('Automation modes', 'vulopilot'),
			settingDescription: __(
				'Choose how VuloPilot should handle issues.',
				'vulopilot'
			),
			// The Automation module (vulopilot-pro) is what actually reads
			// this — RunAiActionAction::execute() — same reasoning as every
			// other field on this tab.
			moduleEnabled: 'automation',
			options: [
				{
					key: 'monitor',
					value: 'monitor',
					label: __('Monitor', 'vulopilot'),
					desc: __('Find issues and notify you.', 'vulopilot'),
					icon: 'eye',
					width: '100%',
					// Confirmed with the user: Monitor is Pro-gated even
					// though the mockup only marked Auto-fix "(Pro)".
					proSetting: true,
				},
				{
					key: 'suggest',
					value: 'suggest',
					label: __('Suggest', 'vulopilot'),
					desc: __(
						'Find issues and suggest fixes for your review.',
						'vulopilot'
					),
					icon: 'check',
					width: '100%',
				},
				{
					key: 'auto_fix',
					value: 'auto_fix',
					label: __('Auto-fix (Pro)', 'vulopilot'),
					desc: __(
						'Automatically fix issues with your approval rules.',
						'vulopilot'
					),
					icon: 'ai',
					width: '100%',
					proSetting: true,
				},
			],
		},
		{
			// Same real `type: 'notice'` field Scanning/SeoContent.ts's own
			// sitemap tips already use — no "Learn more" link here since
			// there's no real docs destination yet to point it at (this
			// repo's own CLAUDE.md notes the public domain is still a
			// placeholder); a fabricated URL would be worse than no link.
			key: 'automation-mode-notice',
			type: 'notice',
			noticeType: 'info',
			title: __('Which option is right for me?', 'vulopilot'),
			message: __(
				'You can change this anytime. VuloPilot will always prioritize safe and reversible changes.',
				'vulopilot'
			),
		},
	],
};
