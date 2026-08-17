import { __ } from '@wordpress/i18n';

/**
 * Protect My Site's "Backups"/"Recovery" tiles — real, always-on core
 * settings (no `moduleEnabled` gate anywhere here; this isn't a Modules-page
 * module). Read by classes/Services/BackupManager.php/BackupScheduler.php.
 * Auto-discovered by templateService.ts's `require.context` over every
 * `.ts` file under `src/components/Settings/` — no manual registration
 * needed, same as every sibling Scanning/*.ts tab.
 */
export default {
	id: 'backups',
	priority: 3.6,
	headerTitle: __('Backups', 'vulopilot'),
	settingTitle: __('Backups', 'vulopilot'),
	headerDescription: __(
		'Automatic site backups and how long they\'re kept.',
		'vulopilot'
	),
	headerIcon: 'cloud-upload',
	submitUrl: 'settings',
	modal: [
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
	],
};
