import { __ } from '@wordpress/i18n';

export default {
	id: 'automation',
	priority: 4,
	headerTitle: __('Automation', 'vulopilot'),
	headerIcon: 'automation',
	submitUrl: 'settings',
	modal: [
		{
			key: 'automation_cooldown_minutes',
			type: 'number',
			label: __('Automation cooldown (minutes)', 'vulopilot'),
			minNumber: 1,
			maxNumber: 1440,
			desc: __(
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
			label: __('Max retries on failure', 'vulopilot'),
			minNumber: 0,
			maxNumber: 5,
			desc: __(
				'How many times a failed automation action is retried before it\'s left as failed. 0 disables retries.',
				'vulopilot'
			),
			moduleEnabled: 'automation',
		},
		{
			key: 'automation_retry_delay_minutes',
			type: 'number',
			label: __('Retry delay (minutes)', 'vulopilot'),
			minNumber: 1,
			maxNumber: 1440,
			desc: __(
				'How long to wait before retrying a failed automation action.',
				'vulopilot'
			),
			moduleEnabled: 'automation',
		},
	],
};
