import { __ } from '@wordpress/i18n';

/**
 * Settings → Uninstall (`#&tab=settings&subtab=uninstall`; was "Data", `subtab=data`): whether forms,
 * submissions and uploaded files are kept or deleted when VuloForm is deleted.
 */
export default {
	id: 'uninstall',
	priority: 3,
	headerTitle: __('Uninstall', 'vuloform'),
	headerDescription: __(
		'What happens to your forms, submissions and uploaded files when VuloForm is deleted.',
		'vuloform'
	),
	groupBySections: true,
	hideSettingHeader: true,
	headerIcon: 'delete',
	submitUrl: 'settings',
	modal: [
		{
			key: 'uninstall-section',
			type: 'section',
			icon: 'database',
			title: __('Your forms and submissions', 'vuloform'),
			desc: __(
				'What happens to your forms, submissions and uploaded files when VuloForm is deleted.',
				'vuloform'
			),
		},
		{
			key: 'keep_data_uninstall',
			type: 'choice-toggle',
			iconEnable: true,
			defaultValue: 'keep_data',
			label: __('When VuloForm is deleted', 'vuloform'),
			options: [
				{
					key: 'keep_data',
					value: 'keep_data',
					label: __('Keep data', 'vuloform'),
					desc: __(
						'Reinstalling picks up where you left off.',
						'vuloform'
					),
					icon: 'database',
				},
				{
					key: 'delete_everything',
					value: 'delete_everything',
					label: __('Delete everything', 'vuloform'),
					desc: __(
						'Removes forms, submissions and uploaded files.',
						'vuloform'
					),
					icon: 'delete',
				},
			],
		},
	],
};
