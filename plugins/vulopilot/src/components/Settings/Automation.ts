import { __ } from '@wordpress/i18n';

export default {
	id: 'automation',
	priority: 4,
	headerTitle: __('Automation', 'vulopilot'),
	headerDescription: __(
		'Cooldowns, retries, and approval rules for automated fixes.',
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
			key: 'automation_cooldown_minutes',
			type: 'number',
			size: 8,
			label: __('Automation cooldown (minutes)', 'vulopilot'),
			minNumber: 1,
			maxNumber: 1440,
			settingDescription: __(
				'How long an automation must wait after last firing before it can fire again — guards against the same automation re-triggering on every scan or every save of the same object.',
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
			label: __('Max retries on failure', 'vulopilot'),
			minNumber: 0,
			maxNumber: 5,
			settingDescription: __(
				'How many times a failed automation action is retried before it\'s left as failed. 0 disables retries.',
				'vulopilot'
			),
			moduleEnabled: 'automation',
		},
		{
			key: 'automation_retry_delay_minutes',
			type: 'number',
			size: 8,
			label: __('Retry delay (minutes)', 'vulopilot'),
			minNumber: 1,
			maxNumber: 1440,
			settingDescription: __(
				'How long to wait before retrying a failed automation action.',
				'vulopilot'
			),
			moduleEnabled: 'automation',
		},
		{
			key: 'require_approval_before_ai_change',
			type: 'checkbox',
			look: 'toggle',
			
			label: __('Require approval before AI changes apply', 'vulopilot'),
			settingDescription: __(
				"When on, AI-generated fixes wait in Pending Approval instead of applying automatically. All AI-applied fixes — one-click or bulk — require AI Fixes.",
				'vulopilot'
			),
			options: [
				{ key: 'require_approval_before_ai_change', label: '', value: 'require_approval_before_ai_change' },
			],
			moduleEnabled: 'automation',
		},
	],
};
