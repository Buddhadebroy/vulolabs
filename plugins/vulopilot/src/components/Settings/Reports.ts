import { createElement } from 'react';
import { __ } from '@wordpress/i18n';
import SendTestReportButton from './SendTestReportButton';

/**
 * Settings → Reports.
 *
 * `default_report_format`/`default_report_period_days` are real, existing
 * settings (Utill::VULOPILOT_SETTINGS_DEFAULTS) already read by
 * Controllers\Reports::create_item() - this is a restyle of how they're
 * edited, not new settings. Two real changes from the previous plain
 * select/number-input shape:
 *
 * No "Report Branding" section: no real backend for it anywhere in this
 * codebase (no logo/watermark/color setting, nothing `PdfExporter.php`
 * reads) - added only once that's a real, built feature rather than a
 * settings card with nothing behind it.
 */
export default {
	id: 'reports',
	priority: 5,
	headerTitle: __('Reports', 'vulopilot'),
	headerDescription: __(
		'Choose how you want VuloPilot to generate and deliver your reports.',
		'vulopilot'
	),
	headerIcon: 'document',
	submitUrl: 'settings',
	settingAction: createElement(SendTestReportButton),
	modal: [
		{
			key: 'default_report_format',
			type: 'choice-toggle',
			variant: 'compact',
			defaultValue: 'pdf',
			proSetting: true,
			label: 'Default report format',
			settingDescription: __(
				'Select the file format VuloPilot will use when you download or schedule reports.',
				'vulopilot'
			),
			desc:  __(
				'You can change the format each time while generating a report.',
				'vulopilot'
			),
			options: [
				{
					key: 'pdf',
					value: 'pdf',
					label: __('PDF', 'vulopilot'),
					badgeColor: 'green', badgeText: __('Recommended', 'vulopilot') ,
					desc: __('Great for sharing and printing.', 'vulopilot'),
					icon: 'pdf blue',
				},
				{
					key: 'csv',
					value: 'csv',
					label: __('CSV', 'vulopilot'),
					desc: __('Best for data analysis in spreadsheets.', 'vulopilot'),
					icon: 'csv green',
				},
				{
					key: 'both',
					value: 'both',
					label: __('Both', 'vulopilot'),
					desc: __('Choose PDF or CSV each time you download.', 'vulopilot'),
					icon: 'document orange',
				},
			],
		},
		{
			key: 'default_report_period_days',
			type: 'choice-toggle',
			defaultValue: '30',
			proSetting: true,
			label: __('Default reporting period', 'vulopilot'),
			settingDescription: __(
				'Choose the time period VuloPilot will use by default when generating reports.',
				'vulopilot'
			),
			desc: __(
				'You can change the period anytime while generating a report.',
				'vulopilot'
			),
			options: [
				{ key: '7', value: '7', label: __('7 days', 'vulopilot'), width: '100%' },
				{ key: '30', value: '30', label: __('30 days', 'vulopilot'), width: '100%' },
				{ key: '90', value: '90', label: __('90 days', 'vulopilot'), width: '100%' },
				{ key: '180', value: '180', label: __('6 months', 'vulopilot'), width: '100%' },
				{ key: '365', value: '365', label: __('12 months', 'vulopilot'), width: '100%' },
			],
		},
	],
};
