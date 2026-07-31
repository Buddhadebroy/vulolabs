import { __ } from '@wordpress/i18n';

export default {
	id: 'accessibility',
	priority: 4,
	headerTitle: __('Accessibility', 'vulopilot'),
	headerIcon: 'universal-access-alt',
	submitUrl: 'settings',
	modal: [
		{
			key: 'enable_accessibility_scanning',
			type: 'checkbox',
			look: 'toggle',
			label: __('Enable accessibility scanning', 'vulopilot'),
			desc: __(
				'Turns every category "accessibility" scanner on or off.',
				'vulopilot'
			),
			options: [
				{ key: 'enable_accessibility_scanning', label: '', value: 'enable_accessibility_scanning' },
			],
		},
		{
			key: 'enable_wcag_scanner',
			type: 'checkbox',
			look: 'toggle',
			label: __('Check for generic, out-of-context link text', 'vulopilot'),
			desc: __(
				'Flags links whose entire visible text is a generic phrase like "click here" or "read more" — link text should describe its own destination (WCAG 2.4.4).',
				'vulopilot'
			),
			options: [
				{ key: 'enable_wcag_scanner', label: '', value: 'enable_wcag_scanner' },
			],
		},
		{
			key: 'accessibility_audit_frequency',
			type: 'select',
			label: __('Scheduled accessibility audits', 'vulopilot'),
			desc: __(
				'Runs only the accessibility-category scanners on this cadence, independent of the general Scan frequency setting under General.',
				'vulopilot'
			),
			options: [
				{ label: __('Off', 'vulopilot'), value: 'disabled' },
				{ label: __('Hourly', 'vulopilot'), value: 'hourly' },
				{ label: __('Daily', 'vulopilot'), value: 'daily' },
				{ label: __('Weekly', 'vulopilot'), value: 'weekly' },
			],
			moduleEnabled: 'accessibility-audits',
		},
	],
};
