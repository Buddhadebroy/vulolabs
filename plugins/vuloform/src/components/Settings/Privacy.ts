import { __ } from '@wordpress/i18n';

/**
 * Settings → Privacy, a standalone top-level tab defined as a declarative `modal`.
 */
export default {
	id: 'privacy',
	priority: 1,
	headerTitle: __('Privacy', 'vuloform'),
	headerDescription: __(
		'What is kept about the people who fill in your forms, and for how long.',
		'vuloform'
	),
	groupBySections: true,
	hideSettingHeader: true,
	headerIcon: 'security',
	submitUrl: 'settings',
	modal: [
		{
			key: 'privacy-section',
			type: 'section',
			icon: 'security',
			title: __('Privacy', 'vuloform'),
			desc: __(
				'What is kept about the people who fill in your forms, and for how long.',
				'vuloform'
			),
		},
		{
			key: 'retention_days',
			type: 'number',
			size: 10,
			minNumber: 0,
			maxNumber: 3650,
			postText: __('days', 'vuloform'),
			label: __('Keep submissions for', 'vuloform'),
			settingDescription: __(
				'Older submissions and their uploaded files are deleted automatically. 0 keeps them until you delete them.',
				'vuloform'
			),
		},
		{
			key: 'privacy_options',
			type: 'setting-row',
			row: false,
			rows: [
				{
					valueKey: 'store_ip',
					icon: 'lock purple',
					title: __("Store the visitor's IP address", 'vuloform'),
					desc: __(
						'Off by default. An IP address is personal data; only keep it if you have a reason to.',
						'vuloform'
					),
					control: {
						toggle: true,
						toggleStatusLabel: { on: __('On', 'vuloform'), off: __('Off', 'vuloform') },
					},
				},
			],
		},
	],
};
