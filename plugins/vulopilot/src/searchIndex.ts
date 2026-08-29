import { __ } from '@wordpress/i18n';

/**
 * Header search index — same `require.context`-over-declarative-configs
 * approach the free vulolabs plugin's own searchIndex.ts uses
 * (react-frontend.md's schema-driven settings pattern already means every
 * Settings tab and Modules catalog entry is a plain object, so building a
 * search index is just walking those objects rather than maintaining a
 * separate, hand-written list). Covers both sources vulolabs's index
 * does: Settings tabs (components/Settings/**) and the Modules catalog
 * (components/Modules/index.ts) — plus a third, manually maintained source
 * below (`PAGE_SECTIONS`) for dashboard-style cards, which aren't
 * schema-driven and so have no config object to walk.
 */
const contextSettings = require.context(
	'./components/Settings',
	true,
	/\.(ts|tsx)$/
);
const contextModules = require.context('./components/Modules', true, /\.ts$/);

export type SearchItem = {
	id: string;
	tab: string;
	name: string;
	desc?: string;
	link: string;
	icon?: string;
	/**
	 * Real DOM id of the card this result should land on, rendered by that
	 * card's own component (e.g. NeedsAttentionCard.tsx's `#site-overview-card`).
	 * Only page-section entries (`PAGE_SECTIONS` below) carry this — Settings/
	 * Modules entries navigate straight to their own subtab/module and don't
	 * need an in-page scroll target. app.tsx's `handleResultClick` uses this
	 * to scroll-and-highlight the section once the tab it lives on has
	 * mounted.
	 */
	sectionId?: string;
};

interface ModalField {
	key: string;
	label: string;
	desc?: string;
	[key: string]: unknown;
}

interface BaseConfig {
	id?: string;
	tab?: string;
	submitUrl?: string;
	headerTitle?: string;
	headerIcon?: string;
	modal?: ModalField[];
}

interface ModuleItem {
	id: string;
	name: string;
	desc?: string;
	icon?: string;
	[key: string]: unknown;
}

interface ModuleConfig extends BaseConfig {
	modules?: ModuleItem[];
}

// Matches templateService.ts's own `Record<string, any>` require.context
// typing in this same plugin — @types/webpack-env (which would supply
// __WebpackModuleApi.RequireContext) isn't a dependency here.
function buildIndexFromContext(context: any): SearchItem[] {
	return context
		.keys()
		.map((key) => context(key).default as ModuleConfig)
		.flatMap((cfg) => {
			const baseTab = cfg.tab || cfg.submitUrl || 'modules';

			// Modules catalog — cfg.modules holds the real, searchable items.
			if (cfg.modules && Array.isArray(cfg.modules)) {
				return cfg.modules
					.filter((mod) => mod.id && mod.name)
					.map((mod) => ({
						id: mod.id,
						tab: baseTab,
						name: mod.name,
						desc: mod.desc,
						link: `#&tab=${baseTab}&module=${mod.id}`,
						icon: mod.icon || '',
					}));
			}

			// A Settings tab — vulopilot's tab config uses headerTitle/
			// headerIcon rather than vulolabs's name/icon (react-frontend.md
			// documents this per-plugin field naming isn't unified), so those
			// are what get mapped into the shared SearchItem shape below.
			if (cfg.id && (cfg.tab || cfg.submitUrl)) {
				const baseLink = `#&tab=${baseTab}&subtab=${cfg.id}`;

				const items: SearchItem[] = [
					{
						id: cfg.id,
						tab: baseTab,
						name: cfg.headerTitle || '',
						link: baseLink,
						icon: cfg.headerIcon,
					},
				];

				if (cfg.modal && Array.isArray(cfg.modal)) {
					cfg.modal.forEach((field) => {
						if (!field.key || !field.label) {
							return;
						}

						items.push({
							id: `${cfg.id}_${field.key}`,
							tab: baseTab,
							name: field.label,
							desc: field.desc,
							link: `${baseLink}&field=${field.key}`,
							icon: cfg.headerIcon,
						});
					});
				}

				return items;
			}

			return [];
		});
}

/**
 * Real dashboard cards worth deep-linking to by title/content — each
 * `sectionId` must match a real DOM id that card's own component actually
 * renders (see NeedsAttentionCard.tsx / AutomationsTemplatesCard.tsx).
 * `tab` is deliberately the literal category `'sections'`, not the real
 * page tab each card lives on — same "category literal, not a real
 * per-item destination" convention `buildIndexFromContext()` already
 * establishes above (every Settings entry's own `tab` is the literal
 * `'settings'` too, never that entry's own specific settings tab); this is
 * what lets app.tsx's search dropdown filter on it. The real destination
 * lives in `link` instead (read by `handleResultClick`, unrelated to
 * `tab`), so changing `tab` here doesn't affect navigation. Kept in sync
 * by hand, same "kept in sync manually" convention this codebase already
 * uses for other cross-file duplication (e.g. Controllers\Seo's own
 * scanner-id docblock) — add a new row here plus a matching `id` on that
 * card's own wrapper element as this plugin grows more dashboard sections
 * worth searching for.
 */
const PAGE_SECTIONS: SearchItem[] = [
	{
		id: 'page-section-site-overview',
		tab: 'sections',
		name: __('Site Overview', 'vulopilot'),
		desc: __(
			'Your overall health score, broken down by SEO & Visibility, Performance, Security, and Content.',
			'vulopilot'
		),
		link: '#&tab=ai-assistant',
		sectionId: 'site-overview-card',
		icon: 'analytics',
	},
	{
		id: 'page-section-create-new-automation',
		tab: 'sections',
		name: __('Create new automation', 'vulopilot'),
		desc: __(
			'Quick-start templates for a website health scan, security monitoring, SEO optimization, WooCommerce monitor, or content optimizer automation.',
			'vulopilot'
		),
		link: '#&tab=ai-assistant',
		sectionId: 'create-new-automation-card',
		icon: 'analytics',
	},
];

export const searchIndex: SearchItem[] = [
	...buildIndexFromContext(contextSettings),
	...buildIndexFromContext(contextModules),
	...PAGE_SECTIONS,
];
