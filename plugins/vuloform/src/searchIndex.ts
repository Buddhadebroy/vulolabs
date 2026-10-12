import { __ } from '@wordpress/i18n';
import { subtabSchemas } from './pages/Settings';
import { adminTabs, settingsTabs } from './services/slots';

/**
 * What the header search looks through: the screens, every setting on the Settings screen
 * (extensions' sub-tabs included), and the site's own forms by name.
 */
export interface SearchItem {
	id: string;
	/** Which of the search box's dropdown options this result belongs to. */
	category: 'tabs' | 'settings' | 'forms';
	name: string;
	desc?: string;
	link: string;
	icon?: string;
}

export const TABS = [
	{ tab: 'forms', name: __('Forms', 'vuloform'), desc: __('Create and edit your forms.', 'vuloform'), icon: 'form' },
	{ tab: 'submissions', name: __('Submissions', 'vuloform'), desc: __('What people have sent you.', 'vuloform'), icon: 'mail' },
	{ tab: 'settings', name: __('Settings', 'vuloform'), desc: __('Privacy, spam protection and data.', 'vuloform'), icon: 'setting' },
];

const text = (value: unknown): string => ('string' === typeof value ? value : '');

/** Screens and settings. Built when asked, so screens added by extensions are included. */
export const staticIndex = (): SearchItem[] => {
	const items: SearchItem[] = [...TABS, ...adminTabs().map((tab) => ({ ...tab, icon: 'module' }))].map((tab) => ({
		id: `tab-${tab.tab}`,
		category: 'tabs',
		name: tab.name,
		desc: tab.desc,
		link: `&tab=${tab.tab}`,
		icon: tab.icon,
	}));

	subtabSchemas.forEach((tab) => {
		items.push({ id: `settings-${tab.id}`, category: 'settings', name: tab.title, link: `&tab=settings&subtab=${tab.id}`, icon: 'setting' });

		(tab.modal as Record<string, unknown>[]).forEach((field) => {
			const rows = Array.isArray(field.rows) ? (field.rows as Record<string, unknown>[]) : [];

			[...(rows.length ? rows : [field])].forEach((entry, index) => {
				const name = text(entry.label) || text(entry.title);

				if (name && name !== tab.title) {
					items.push({
						id: `setting-${text(field.key)}-${index}`,
						category: 'settings',
						name,
						desc: text(entry.settingDescription) || text(entry.desc),
						link: `&tab=settings&subtab=${tab.id}`,
						icon: text(field.icon).split(' ')[0] || 'setting',
					});
				}
			});
		});
	});

	settingsTabs().forEach((tab) =>
		items.push({ id: `settings-${tab.id}`, category: 'settings', name: tab.title, desc: tab.desc, link: `&tab=settings&subtab=${tab.id}`, icon: tab.icon })
	);

	return items;
};
