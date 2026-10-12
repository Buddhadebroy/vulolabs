import { __ } from '@wordpress/i18n';
import { routes } from './routes';
import schemas, { notificationsSchema } from './components/Settings';

/**
 * Header search index: the admin tabs (routes.ts), everything on the Settings sub-tabs
 * (components/Settings/index.ts), and the cards on the other screens that carry a DOM id.
 */
export type SearchItem = {
	id: string;
	/** Which of app.tsx's search dropdown options this result belongs to. */
	category: 'tabs' | 'settings' | 'sections';
	name: string;
	desc?: string;
	link: string;
	icon?: string;
	/** DOM id of the card this result should land on. */
	sectionId?: string;
};

const PAGE_ICONS: Record<string, string> = {
	dashboard: 'analytics',
	logs: 'clock',
	tools: 'tools',
	'sms-alerts': 'notification',
	settings: 'setting',
};

const text = (value: unknown): string => ('string' === typeof value ? value : '');

const TABS: SearchItem[] = routes.map((route) => ({
	id: `page-${route.tab}`,
	category: 'tabs',
	name: route.name,
	desc: route.desc,
	link: `&tab=${route.tab}`,
	icon: PAGE_ICONS[route.tab],
}));

/**
 * One result per sub-tab, plus one for each section heading, labelled field and on/off row in it.
 * They all open the sub-tab the setting lives on.
 */
const SETTINGS: SearchItem[] = [...schemas, notificationsSchema].flatMap((schema) => {
	const link = schema === notificationsSchema ? '&tab=sms-alerts' : `&tab=settings&subtab=${schema.id}`;
	const item = (key: string, name: string, desc: string): SearchItem => ({
		id: `${schema.id}_${key}`,
		category: 'settings',
		name,
		desc,
		link,
		icon: schema.headerIcon,
	});

	return [
		{
			id: schema.id,
			category: 'settings' as const,
			name: schema.headerTitle,
			desc: schema.headerDescription,
			link,
			icon: schema.headerIcon,
		},
		...schema.modal.flatMap((field) => {
			const rows = (field.rows ?? []) as { valueKey: string; title?: string; desc?: unknown; plainDesc?: string }[];
const name = text(field.label) || text(field.title);

			return [
				...(name ? [item(field.key, name, text(field.settingDescription) || text(field.desc))] : []),
				...rows
					.filter((row) => row.title)
					.map((row) => item(row.valueKey, text(row.title), text(row.plainDesc) || text(row.desc))),
			];
		}),
	];
});

const PAGE_SECTIONS: SearchItem[] = [
	{
		id: 'page-section-dashboard-delivery',
		category: 'sections',
		name: __('Delivery', 'vulomail'),
		desc: __('Emails and text messages sent and failed over the selected period.', 'vulomail'),
		link: '&tab=dashboard',
		sectionId: 'dashboard-delivery-card',
		icon: 'analytics',
	},
	{
		id: 'page-section-dashboard-channels',
		category: 'sections',
		name: __('Channels & quick actions', 'vulomail'),
		desc: __('Whether email and SMS are set up, which connection each is sending through, and shortcuts to common tasks.', 'vulomail'),
		link: '&tab=dashboard',
		sectionId: 'dashboard-channels-card',
		icon: 'link',
	},
	{
		id: 'page-section-dashboard-sms-alerts',
		category: 'sections',
		name: __('SMS alerts', 'vulomail'),
		desc: __('How many text message alerts are switched on, and what they can do.', 'vulomail'),
		link: '&tab=dashboard',
		sectionId: 'dashboard-sms-alerts-card',
		icon: 'notification',
	},
	{
		id: 'page-section-dashboard-recent-failures',
		category: 'sections',
		name: __('Recent failures', 'vulomail'),
		desc: __('The latest messages that could not be delivered.', 'vulomail'),
		link: '&tab=dashboard',
		sectionId: 'dashboard-recent-failures-card',
		icon: 'error',
	},
	{
		id: 'page-section-logs-delivery-log',
		category: 'sections',
		name: __('Delivery log', 'vulomail'),
		desc: __('Every email and text message this site has tried to send.', 'vulomail'),
		link: '&tab=logs',
		sectionId: 'logs-delivery-log-card',
		icon: 'clock',
	},
	{
		id: 'page-section-tools-test-email',
		category: 'sections',
		name: __('Send a test email', 'vulomail'),
		desc: __('Check that email is going out through a connection.', 'vulomail'),
		link: '&tab=tools',
		sectionId: 'tools-test-email-card',
		icon: 'mail',
	},
	{
		id: 'page-section-tools-test-sms',
		category: 'sections',
		name: __('Send a test SMS', 'vulomail'),
		desc: __('Check that text messages are going out through a connection.', 'vulomail'),
		link: '&tab=tools',
		sectionId: 'tools-test-sms-card',
		icon: 'send',
	},
	{
		id: 'page-section-tools-diagnostics',
		category: 'sections',
		name: __('Diagnostics', 'vulomail'),
		desc: __('Checks of this site\'s delivery setup. Nothing here changes any setting.', 'vulomail'),
		link: '&tab=tools',
		sectionId: 'tools-diagnostics-card',
		icon: 'security',
	},
];

export const searchIndex: SearchItem[] = [...TABS, ...SETTINGS, ...PAGE_SECTIONS];
