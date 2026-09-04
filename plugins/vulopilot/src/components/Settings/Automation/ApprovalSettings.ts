import { __ } from '@wordpress/i18n';

/**
 * A pill-style highlight line under each option's own `desc` — real zyra
 * `option.customHtml` support (ToggleInputFieldComponent, same component
 * `automation_mode` on the sibling How VuloPilot Handles Issues tab
 * already uses), rendered via `dangerouslySetInnerHTML` same as
 * `type: 'notice'`'s own `message`. Inline styles rather than a new
 * Settings.scss rule — same "no new CSS needed" posture AiCrawlerAlerts.ts's
 * own notice links already take.
 */
const highlight = ( text: string ): string =>
	`<div class="admin-badge purple">${ text }</div>`;

/** Same real severity palette this codebase's own Issues table/AI Copilot attention pills already use (AICopilot.scss's own `$priorities` map) — reused here rather than inventing separate risk colors, since it's the same LOW/MEDIUM/HIGH scale (ValueObjects\Impact). */
const riskBadge = (
	level: 'low' | 'medium' | 'high',
	label: string
): string =>
	`<span class="admin-badge badge-${level}">${label}</span>`;
/**
 * Settings → Automation → Approval Settings ("Ask before applying AI
 * changes").
 *
 * Real backend, not decorative — `ai_change_approval_mode`
 * (Utill::VULOPILOT_SETTINGS_DEFAULTS) is read by
 * AIActions\ActionRunner::propose() itself (that class's own
 * should_auto_approve()) for every proposed AI change across this plugin,
 * manual one-click fixes and vulopilot-pro's Automations Engine alike —
 * not just the Automate Work-specific `automation_mode`/`auto_fix_max_impact`
 * pair on the sibling How VuloPilot Handles Issues tab, which is a
 * separate, narrower gate that still layers on top of this one for
 * automation runs specifically (RunAiActionAction.php's own docblock).
 *
 * "Risk" reuses AIActionInterface::get_risk_level() — every registered AI
 * action (AbstractBasicAction's own shared Impact::MEDIUM default,
 * overridden to LOW/HIGH per action based on what its own execute() really
 * touches — see that class's own docblock) already returns a real
 * Impact::LOW/MEDIUM/HIGH, the same value `risk_based` mode checks.
 *
 * Same real `type: 'choice-toggle'` component `automation_mode` already
 * uses, not a fresh one — "(Recommended)"/"(Pro)" folded into the option
 * label text is this same field's own established convention (see that
 * file, and Reports.ts's own "PDF (Recommended)"), and `proSetting: true`
 * already renders zyra's real Pro-tag/lock automatically when Pro isn't
 * licensed (ToggleInputFieldComponent).
 */
export default {
	id: 'approval-settings',
	priority: 2,
	headerTitle: __( 'Ask before applying AI changes', 'vulopilot' ),
	headerDescription: __(
		'Choose when VuloPilot should ask for your approval before applying AI-suggested changes.',
		'vulopilot'
	),
	headerIcon: 'security',
	submitUrl: 'settings',
	modal: [
		{
			key: 'ai_change_approval_mode',
			type: 'choice-toggle',
			variant: 'compact',
			defaultValue: 'always',
			label: __( 'Ask before applying AI changes', 'vulopilot' ),
			width: '90%',
			settingDescription: __(
				'Choose when VuloPilot should ask for your approval before applying AI-suggested changes.',
				'vulopilot'
			),
			options: [
				{
					key: 'always',
					value: 'always',
					label: __( 'Always ask', 'vulopilot' ),
					badgeColor: 'blue', badgeText: 'Recommended',
					desc: __(
						'VuloPilot will always ask for your approval before applying any AI-generated changes.',
						'vulopilot'
					),
					icon: 'info blue',
					customHtml: `<div class="admin-badge blue">You stay in full control of every change.</div>`
				},
				{
					key: 'risk_based',
					value: 'risk_based',
					label: __( 'Ask for medium & high risk changes', 'vulopilot' ),
					desc: __(
						'VuloPilot will ask for approval for medium and high risk changes, but apply low risk changes automatically.',
						'vulopilot'
					),
					icon: 'error red',
					customHtml: `<div class="admin-badge red">Balanced control and automation.</div>`
				},
				{
					key: 'never',
					value: 'never',
					label: __( 'Do not ask (Pro)', 'vulopilot' ),
					badgeColor: 'green', badgeText: 'Pro',
					desc: __(
						'VuloPilot will apply eligible AI-generated changes automatically without asking.',
						'vulopilot'
					),
					icon: 'check green',
					proSetting: true,
					customHtml: `<div class="admin-badge green">Maximum automation. Use with caution.</div>`
				},
			],
		},
		{
			// Same real `type: 'notice'` field Scanning/SeoContent.ts's own
			// sitemap tips already use — no "Learn more" link here since
			// there's no real docs destination yet to point it at (this
			// repo's own CLAUDE.md notes the public domain is still a
			// placeholder); a fabricated URL would be worse than no link.
			// Describes "Ask for medium & high risk changes" specifically
			// (the option this legend sits directly under in the mockup),
			// not a claim that holds under "Always ask"/"Do not ask" too.
			key: 'approval-levels-notice',
			type: 'notice',
			noticeType: 'info',
			title: __( 'About approval levels', 'vulopilot' ),
			message:
				__(
					"Risk levels are determined by the type of change and its potential impact on your website.",
					'vulopilot'
				)
		},
	],
};
