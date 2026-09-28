import { __ } from '@wordpress/i18n';

/**
 * Settings → Backups.
 */
export const CLOUD_STORAGE_LOCKED_METHODS = [
	{
		id: 's3',
		icon: 'cloud-upload red',
		label: __('Amazon S3', 'vulopilot'),
		desc: __('Store backups in an Amazon S3 bucket.', 'vulopilot'),
		settingDescription: '',
		isCustom: true,
		hideDeleteBtn: true,
		badgeColor: 'red',
		badgeText: __('Not configured', 'vulopilot'),
	},
	{
		id: 'google_drive',
		icon: 'google yellow',
		label: __('Google Drive', 'vulopilot'),
		desc: __('Store backups in a Google Drive folder.', 'vulopilot'),
		settingDescription: '',
		isCustom: true,
		hideDeleteBtn: true,
		badgeColor: 'red',
		badgeText: __('Not connected', 'vulopilot'),
	},
];

export default {
	id: 'backups',
	priority: 8,
	headerTitle: __('Backups', 'vulopilot'),
	settingTitle: __('Backups', 'vulopilot'),
	headerDescription: __(
		'Automatic site backups and how long they\'re kept.',
		'vulopilot'
	),
	headerIcon: 'cloud-upload',
	hideSettingHeader: true,
	groupBySections: true,
	submitUrl: 'settings',
	modal: [
		{
			key: 'general_settings',
			type: 'section',
			icon: 'cloud-upload',
			title: __('Backups', 'vulopilot'),
			desc: __('Automatic site backups and how long they\'re kept.', 'vulopilot'),
		},
		{
			key: 'enable_automatic_backups',
			type: 'checkbox',
			look: 'toggle',

			label: __('Enable automatic backups', 'vulopilot'),
			settingDescription: __(
				'A real database + file archive, created on the schedule below and stored on this server. Manual backups from the Backups tab always work regardless of this setting.',
				'vulopilot'
			),
			options: [
				{ key: 'enable_automatic_backups', label: '', value: 'enable_automatic_backups' },
			],
		},
		{
			key: 'backup_frequency',
			type: 'select',
			size: 10,
			label: __('Backup frequency', 'vulopilot'),
			settingDescription: __(
				'How often an automatic backup runs, when enabled above.',
				'vulopilot'
			),
			options: [
				{ label: __('Off', 'vulopilot'), value: 'disabled' },
				{ label: __('Daily', 'vulopilot'), value: 'daily' },
				{ label: __('Weekly', 'vulopilot'), value: 'weekly' },
			],
		},
		{
			key: 'backup_retention_count',
			type: 'number',
			size: 10,
			label: __('Backups to keep', 'vulopilot'),
			minNumber: 1,
			maxNumber: 50,
			settingDescription: __(
				'Oldest completed backups beyond this count are automatically deleted after each new one finishes, to keep disk usage bounded.',
				'vulopilot'
			),
		},
		{
			key: 'backup_storage_destination',
			type: 'choice-toggle',
			label: __('Storage destination', 'vulopilot'),
			settingDescription: __(
				'Every backup always saves to this server first. Pick a remote destination below to also upload each completed backup there - configure its credentials in the Cloud Storage section below.',
				'vulopilot'
			),
			options: [
				{ key: 'local', label: __('This server only (Local)', 'vulopilot'), value: 'local' },
				{ key: 's3', label: __('Amazon S3', 'vulopilot'), value: 's3', proSetting: true },
				{ key: 'google_drive', label: __('Google Drive', 'vulopilot'), value: 'google_drive', proSetting: true },
			],
		},
	],
};
