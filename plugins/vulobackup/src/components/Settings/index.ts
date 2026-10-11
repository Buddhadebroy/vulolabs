import type { ComponentType } from 'react';
import { __ } from '@wordpress/i18n';
import { Advanced, Contents, Notifications, Schedule, Security } from './Panels';
import Storage from './Storage';

/**
 * Settings sub-tabs, in the shape zyra's navigator expects (the one VuloPilot's Settings uses).
 * Each sub-tab draws itself with the shared sections layout and saves each change as it is made.
 */
export interface SettingsSchema {
	id: string;
	headerTitle: string;
	headerDescription: string;
	headerIcon: string;
	hideSettingHeader: boolean;
	modal: never[];
	PanelComponent: ComponentType;
}

const tab = (id: string, headerTitle: string, headerDescription: string, headerIcon: string, PanelComponent: ComponentType): SettingsSchema => ({
	id,
	headerTitle,
	headerDescription,
	headerIcon,
	hideSettingHeader: true,
	modal: [],
	PanelComponent,
});

const schemas: SettingsSchema[] = [
	tab('schedule', __('Schedule', 'vulobackup'), __('How often backups are made by themselves, and how many are kept.', 'vulobackup'), 'clock', Schedule),
	tab('contents', __('What to back up', 'vulobackup'), __('The folders and database tables a backup includes, and what is left out.', 'vulobackup'), 'database', Contents),
	tab('storage', __('Storage', 'vulobackup'), __('The backup folder on this server, and remote destinations: Amazon S3 or compatible, and SFTP.', 'vulobackup'), 'link', Storage),
	tab('security', __('Security', 'vulobackup'), __('Encrypt backups with a password.', 'vulobackup'), 'lock', Security),
	tab('notifications', __('Notifications', 'vulobackup'), __('Email when a backup fails, and how long the activity log is kept.', 'vulobackup'), 'notification', Notifications),
	tab('advanced', __('Advanced', 'vulobackup'), __('Safety backups, server limits, and what happens when VuloBackup is deleted.', 'vulobackup'), 'tools', Advanced),
];

export default schemas;
