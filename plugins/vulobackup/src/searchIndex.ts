import { routes } from './routes';
import schemas from './components/Settings';

/**
 * Header search index: the admin tabs (routes.ts) and the Settings sub-tabs.
 */
export type SearchItem = {
	id: string;
	/** Which of app.tsx's search dropdown options this result belongs to. */
	category: 'tabs' | 'settings';
	name: string;
	desc?: string;
	link: string;
	icon?: string;
};

export const searchIndex: SearchItem[] = [
	...routes.map((route) => ({
		id: `page-${route.tab}`,
		category: 'tabs' as const,
		name: route.name,
		desc: route.desc,
		link: `&tab=${route.tab}`,
		icon: route.icon,
	})),
	...schemas.map((schema) => ({
		id: `settings-${schema.id}`,
		category: 'settings' as const,
		name: schema.headerTitle,
		desc: schema.headerDescription,
		link: `&tab=settings&subtab=${schema.id}`,
		icon: schema.headerIcon,
	})),
];
