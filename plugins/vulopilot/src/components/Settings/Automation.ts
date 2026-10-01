import { createElement } from 'react';
import { __ } from '@wordpress/i18n';
import EnableAutomationModuleAction from './Automation/EnableAutomationModuleAction';

/**
 * Settings → Automation ("Advanced Automation Settings").
 */
export default {
	id: 'automation',
	priority: 4,
	headerTitle: __( 'Automation', 'vulopilot' ),
	settingTitle: __( 'Advanced Automation Settings', 'vulopilot' ),
	headerDescription: __(
		'Fine-tune how VuloPilot runs automated actions in the background.',
		'vulopilot'
	),
	headerIcon: 'setting',
	submitUrl: 'settings',
	settingAction: createElement( EnableAutomationModuleAction ),
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
			moduleEnabled: 'workflow-automation',
			proSetting: true,
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
			moduleEnabled: 'workflow-automation',
			proSetting: true,
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
			moduleEnabled: 'workflow-automation',
			proSetting: true,
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
