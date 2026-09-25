import { createElement } from 'react';
import { __ } from '@wordpress/i18n';
import EnableAutomationModuleAction from './Automation/EnableAutomationModuleAction';

/**
 * Settings → Automation ("Advanced Automation Settings").
 *
 * Flattened from the old `Automation/` folder (`Advanced.ts` +
 * `FolderPriority.ts`) back to a single top-level file, same shape
 * Reports.ts/DeveloperTools.ts/Modules.ts already use - per direct
 * instruction ("remove sub tab Advanced"). That folder existed only to
 * hold "Advanced" as its own sub-tab once two other sub-tabs ("How
 * VuloPilot Handles Issues"/"Approval Settings") had already been removed
 * (see the old Advanced.ts's own docblock); with "Advanced" now gone too,
 * a folder with nothing left to group is worse than this plugin's own
 * established single-file-tab pattern - `importAll()`
 * (templateService.ts) only renders a sub-tab strip for a `type: 'folder'`
 * node, so this flat file makes the whole tab a single page, no sub-nav,
 * same as Reports/Developer Tools/Modules already are.
 *
 * `automation_cooldown_minutes`/`automation_max_retries`/
 * `automation_retry_delay_minutes` are the same real setting keys the old
 * Advanced.ts (and before that, AutomationSchedule.ts) already used - no
 * migration of already-saved values needed. Each field's own
 * `moduleEnabled` fixed from `'automation'` (singular - matched no real
 * module id, so these fields never actually detected the module as
 * active) to `'automations'`, Modules/index.ts's own real backend module
 * id (see that file's own docblock: "Automation's folder name
 * kebab-cased, no 'Engine' suffix").
 *
 * The mockup's own per-row icon box + a second "Cooldown duration"-style
 * label above a value+unit-dropdown control isn't a real, existing zyra
 * field shape - there's no compound number+select input in this
 * codebase's FIELD_REGISTRY, and every one of these 3 settings only ever
 * has exactly one real unit (minutes or times; nothing here reads/writes
 * an alternate unit), so a literal dropdown would be a control that can't
 * actually do anything. Kept as real `type: 'number'` fields with the
 * unit folded into the label, same convention this plugin's other
 * duration settings already use (e.g. Settings/Scanning's own frequency
 * fields) - honest and fully functional over visually matching a control
 * with no real second state.
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
