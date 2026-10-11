import type { ComponentType } from 'react';
import { __ } from '@wordpress/i18n';
import Overview from './pages/Overview';
import Backups from './pages/Backups';
import Restore from './pages/Restore';
import Diagnostics from './pages/Diagnostics';
import Settings from './pages/Settings';

export interface RouteDefinition {
	tab: string;
	name: string;
	desc: string;
	icon: string;
	component: ComponentType;
}

/**
 * One entry per admin submenu tab (classes/Admin.php). searchIndex.ts lists these as its "Tabs".
 */
export const routes: RouteDefinition[] = [
	{
		tab: 'overview',
		name: __('Overview', 'vulobackup'),
		desc: __('The last backup, the next one, storage and anything that needs attention.', 'vulobackup'),
		icon: 'analytics',
		component: Overview,
	},
	{
		tab: 'backups',
		name: __('Backups', 'vulobackup'),
		desc: __('Create, verify, download, import and delete backups.', 'vulobackup'),
		icon: 'database',
		component: Backups,
	},
	{
		tab: 'restore',
		name: __('Restore', 'vulobackup'),
		desc: __('Put a backup back, or move a site here from another address.', 'vulobackup'),
		icon: 'refresh',
		component: Restore,
	},
	{
		tab: 'diagnostics',
		name: __('Diagnostics', 'vulobackup'),
		desc: __('What this server can do, and the record of what VuloBackup did.', 'vulobackup'),
		icon: 'tools',
		component: Diagnostics,
	},
	{
		tab: 'settings',
		name: __('Settings', 'vulobackup'),
		desc: __('Schedule, retention, what is backed up, storage, encryption and notifications.', 'vulobackup'),
		icon: 'setting',
		component: Settings,
	},
];
