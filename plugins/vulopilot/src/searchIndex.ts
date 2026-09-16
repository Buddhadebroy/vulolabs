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
	/** Real destination tab this result navigates to (`link`'s own `#&tab=…`) — e.g. `'security'`, `'performance'`. Not what app.tsx's search dropdown filters on; see `category` below for that. */
	tab: string;
	/**
	 * Which of app.tsx's own search dropdown options (`'modules'`/
	 * `'settings'`/`'sections'`) this result belongs to — a fixed, small
	 * set of buckets, deliberately kept separate from `tab` above. Before
	 * this field existed, `handleQueryUpdate` filtered on `tab` itself,
	 * but `tab` is each result's own real, varied destination page (e.g.
	 * `'security'`/`'performance'`/…), never literally `'modules'` or
	 * `'settings'` — so picking "Settings" or "Modules" in the dropdown
	 * matched nothing and silently emptied the results (confirmed live).
	 */
	category: 'modules' | 'settings' | 'sections';
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
function buildIndexFromContext(
	context: any,
	category: 'modules' | 'settings'
): SearchItem[] {
	return context
		.keys()
		.map((key) => context(key).default as ModuleConfig)
		.flatMap((cfg) => {
			// Not every `.ts`/`.tsx` under this require.context glob is a
			// Settings-tab config or a Modules catalog — e.g.
			// CrawlerAlertRows.ts only has a named export (`CRAWLER_ALERT_ROWS`),
			// so `context(key).default` is `undefined` for it; without this
			// guard `cfg.tab` below throws instead of falling through to
			// the same "doesn't match either known shape" `return []` a
			// present-but-unrelated default export (e.g.
			// CrawlerAlertTestPanel.tsx's component) already falls through
			// to further down.
			if (!cfg) {
				return [];
			}

			const baseTab = cfg.tab || cfg.submitUrl || 'modules';

			// Modules catalog — cfg.modules holds the real, searchable
			// items. Every real module now lives at the one same
			// Settings → Modules destination (`tab=settings&subtab=modules`,
			// see routes.ts's own docblock on why the old standalone
			// `tab=modules` route is gone) regardless of `cfg.tab` — not
			// `baseTab`, which would build a dead link here.
			if (cfg.modules && Array.isArray(cfg.modules)) {
				return cfg.modules
					.filter((mod) => mod.id && mod.name)
					.map((mod) => ({
						id: mod.id,
						tab: 'settings',
						category,
						name: mod.name,
						desc: mod.desc,
						link: `#&tab=settings&subtab=modules&module=${mod.id}`,
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
						category,
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
							category,
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
 * `tab` is each entry's own real destination (`'ai-assistant'`, matching
 * `link` below) — `category: 'sections'` is what app.tsx's search dropdown
 * actually filters on (see `SearchItem.category`'s own docblock for why
 * these two are kept separate). Kept in sync by hand, same "kept in sync
 * manually" convention this codebase already uses for other cross-file
 * duplication (e.g. Controllers\Seo's own scanner-id docblock) — add a new
 * row here plus a matching `id` on that card's own wrapper element as this
 * plugin grows more dashboard sections worth searching for.
 */
const PAGE_SECTIONS: SearchItem[] = [
	{
		id: 'page-section-site-overview',
		tab: 'ai-assistant',
		category: 'sections',
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
		tab: 'ai-assistant',
		category: 'sections',
		name: __('Create new automation', 'vulopilot'),
		desc: __(
			'Quick-start templates for a website health scan, security monitoring, SEO optimization, WooCommerce monitor, or content optimizer automation.',
			'vulopilot'
		),
		link: '#&tab=ai-assistant',
		sectionId: 'create-new-automation-card',
		icon: 'analytics',
	},
	// The rest of this list — every real `<CardComponent id="…">`/
	// `<SectionComponent>`/`<div id="…">`-wrapped section this codebase's
	// pages actually carry a real DOM id for, so `handleResultClick`'s own
	// scroll-and-highlight has somewhere real to land. `name` is each
	// section's own real, on-screen title (IssuesSection.tsx's own SEO/
	// AEO/GEO tabs all really do render the identical literal title "All
	// SEO Findings" — its own `title` prop defaults to that and none of
	// the 3 callers override it — kept faithful to what's actually on
	// screen rather than inventing 3 different titles that don't exist).
	// Not exhaustive: several other real cards/sections have no `id` of
	// their own yet (nothing for this search index, or a "scroll to and
	// highlight" button elsewhere, to target), so they aren't listed —
	// same "kept in sync by hand" posture this file's own docblock above
	// already documents; add a new row here plus a matching real `id` on
	// that section's own wrapper as more become worth searching for.
	{
		id: 'page-section-seo-findings',
		tab: 'seo-visibility',
		category: 'sections',
		name: __('All SEO Findings', 'vulopilot'),
		desc: __('Every real SEO finding, filterable by category — SEO tab.', 'vulopilot'),
		link: '#&tab=seo-visibility&subtab=seo',
		sectionId: 'seo-all-issues-table',
		icon: 'search',
	},
	{
		id: 'page-section-aeo-findings',
		tab: 'seo-visibility',
		category: 'sections',
		name: __('All SEO Findings', 'vulopilot'),
		desc: __('Every real AEO finding, filterable by category — AEO tab.', 'vulopilot'),
		link: '#&tab=seo-visibility&subtab=aeo',
		sectionId: 'aeo-all-issues-table',
		icon: 'search',
	},
	{
		id: 'page-section-geo-findings',
		tab: 'seo-visibility',
		category: 'sections',
		name: __('All SEO Findings', 'vulopilot'),
		desc: __('Every real GEO finding, filterable by category — GEO tab.', 'vulopilot'),
		link: '#&tab=seo-visibility&subtab=geo',
		sectionId: 'geo-all-issues-table',
		icon: 'search',
	},
	{
		id: 'page-section-schema-inspector',
		tab: 'seo-visibility',
		category: 'sections',
		name: __('Inspect a specific page', 'vulopilot'),
		desc: __(
			'See exactly what structured information search engines receive from any page or product.',
			'vulopilot'
		),
		link: '#&tab=seo-visibility&subtab=schema-knowledge',
		sectionId: 'schema-knowledge-inspector',
		icon: 'search',
	},
	{
		id: 'page-section-recent-crawl-requests',
		tab: 'seo-visibility',
		category: 'sections',
		name: __('Recent Crawl Requests', 'vulopilot'),
		desc: __('Every real crawler visit to your site, searchable and filterable.', 'vulopilot'),
		link: '#&tab=seo-visibility&subtab=crawl-urls',
		sectionId: 'recent-crawl-requests',
		icon: 'search-discovery',
	},
	{
		id: 'page-section-woocommerce-issues',
		tab: 'commerce',
		category: 'sections',
		name: __('All WooCommerce Issues', 'vulopilot'),
		link: '#&tab=commerce',
		sectionId: 'woocommerce-issues-table',
		icon: 'cart',
	},
	{
		id: 'page-section-recent-content',
		tab: 'content',
		category: 'sections',
		name: __('Recent Content', 'vulopilot'),
		desc: __('Your most recently published or updated content.', 'vulopilot'),
		link: '#&tab=content',
		sectionId: 'content-audit-section',
		icon: 'edit',
	},
	{
		id: 'page-section-content-tools',
		tab: 'content',
		category: 'sections',
		name: __('Content Tools', 'vulopilot'),
		desc: __('AI tools to help you create and improve content.', 'vulopilot'),
		link: '#&tab=content',
		sectionId: 'content-tools-grid',
		icon: 'tools',
	},
	{
		id: 'page-section-core-web-vitals',
		tab: 'performance',
		category: 'sections',
		name: __('Core Web Vitals', 'vulopilot'),
		desc: __('Real Google Core Web Vitals for this site.', 'vulopilot'),
		link: '#&tab=performance',
		sectionId: 'performance-core-web-vitals-card',
		icon: 'analytics',
	},
	{
		id: 'page-section-performance-top-issues',
		tab: 'performance',
		category: 'sections',
		name: __('Top Issues', 'vulopilot'),
		desc: __('Findings from your most recent scans, grouped by check.', 'vulopilot'),
		link: '#&tab=performance',
		sectionId: 'performance-section-findings',
		icon: 'security',
	},
	{
		id: 'page-section-automation-manage',
		tab: 'automations',
		category: 'sections',
		name: __('Your automations', 'vulopilot'),
		desc: __(
			'React to scan findings automatically — enable, pause, or run an automation, and see when it last ran.',
			'vulopilot'
		),
		link: '#&tab=automations',
		sectionId: 'automation-manage',
		icon: 'automation',
	},
	{
		id: 'page-section-report-history',
		tab: 'reports',
		category: 'sections',
		name: __('Report History', 'vulopilot'),
		desc: __('A complete log of all generated reports.', 'vulopilot'),
		link: '#&tab=reports&subtab=overview',
		sectionId: 'reports-history',
		icon: 'clock',
	},
	{
		id: 'page-section-scheduled-reports',
		tab: 'reports',
		category: 'sections',
		name: __('Scheduled Reports', 'vulopilot'),
		desc: __(
			'Automate report generation and delivery to keep your team and clients updated.',
			'vulopilot'
		),
		link: '#&tab=reports&subtab=overview',
		sectionId: 'reports-schedules',
		icon: 'calendar',
	},
	// Batch added for a broad search-coverage pass across every page that
	// previously had zero (Security, Health) or only 1-2 (Performance,
	// Accessibility, Commerce, Content) PAGE_SECTIONS entries — each row's
	// own real `id` was added to its card's own component in this same
	// pass. Not every real card in this codebase is covered even after
	// this — same "kept in sync by hand... add more as needed" posture
	// this file's own docblock above already documents; the ones added
	// here are each page's clearest, always-visible, single-purpose real
	// cards, skipping side-detail panels (only render after a row is
	// selected), reusable multi-instance components (`title`/`desc` are
	// props, not a fixed on-screen string), and cards that are currently
	// unused/commented out.
	{
		id: 'page-section-security-trend',
		tab: 'security',
		category: 'sections',
		name: __('Security Trend', 'vulopilot'),
		desc: __('Your real security score trend over time.', 'vulopilot'),
		link: '#&tab=security',
		sectionId: 'security-trend-card',
		icon: 'analytics',
	},
	{
		id: 'page-section-live-threat-monitor',
		tab: 'security',
		category: 'sections',
		name: __('Live Threat Monitor', 'vulopilot'),
		desc: __('Real-time status for each real security check.', 'vulopilot'),
		link: '#&tab=security',
		sectionId: 'live-threat-monitor-card',
		icon: 'security',
	},
	{
		id: 'page-section-security-recent-activity',
		tab: 'security',
		category: 'sections',
		name: __('Recent Activity', 'vulopilot'),
		desc: __('Your last 4 real security-related events.', 'vulopilot'),
		link: '#&tab=security',
		sectionId: 'security-recent-activity-card',
		icon: 'clock',
	},
	{
		id: 'page-section-plugin-overlap',
		tab: 'security',
		category: 'sections',
		name: __('VuloPilot already covers this', 'vulopilot'),
		desc: __(
			'Active plugins that overlap with a feature already built into VuloPilot.',
			'vulopilot'
		),
		link: '#&tab=security',
		sectionId: 'plugin-overlap-card',
		icon: 'module',
	},
	{
		id: 'page-section-performance-overall-speed-score',
		tab: 'performance',
		category: 'sections',
		name: __('Overall Speed Score', 'vulopilot'),
		desc: __('Your real performance score from Google PageSpeed Insights.', 'vulopilot'),
		link: '#&tab=performance&subtab=overview',
		sectionId: 'performance-overall-speed-score-card',
		icon: 'analytics',
	},
	{
		id: 'page-section-performance-quick-actions',
		tab: 'performance',
		category: 'sections',
		name: __('Quick Actions', 'vulopilot'),
		desc: __('Common performance fixes you can run in one click.', 'vulopilot'),
		link: '#&tab=performance&subtab=overview',
		sectionId: 'performance-quick-actions-card',
		icon: 'tools',
	},
	{
		id: 'page-section-biggest-speed-opportunity',
		tab: 'performance',
		category: 'sections',
		name: __('Biggest Speed Opportunity', 'vulopilot'),
		desc: __('The single fix with the biggest real impact on your speed score.', 'vulopilot'),
		link: '#&tab=performance&subtab=overview',
		sectionId: 'biggest-speed-opportunity-card',
		icon: 'analytics',
	},
	{
		id: 'page-section-slow-pages-why',
		tab: 'performance',
		category: 'sections',
		name: __('Why these pages are slow?', 'vulopilot'),
		desc: __('The most common issues dragging your pages down.', 'vulopilot'),
		link: '#&tab=performance&subtab=slow-pages',
		sectionId: 'slow-pages-why-card',
		icon: 'info',
	},
	{
		id: 'page-section-why-accessibility-matters',
		tab: 'accessibility',
		category: 'sections',
		name: __('Why accessibility matters', 'vulopilot'),
		desc: __("More than a checkbox — it's good for everyone.", 'vulopilot'),
		link: '#&tab=accessibility',
		sectionId: 'why-accessibility-matters-card',
		icon: 'question',
	},
	{
		id: 'page-section-accessibility-manual-testing',
		tab: 'accessibility',
		category: 'sections',
		name: __('Some accessibility checks need a person', 'vulopilot'),
		desc: __(
			'Automated tests can find many technical issues, but real user experiences need to be checked manually.',
			'vulopilot'
		),
		link: '#&tab=accessibility',
		sectionId: 'accessibility-manual-testing-card',
		icon: 'person',
	},
	{
		id: 'page-section-ai-sales-assistant',
		tab: 'commerce',
		category: 'sections',
		name: __('AI Sales Assistant', 'vulopilot'),
		desc: __('Real open WooCommerce findings, summarized.', 'vulopilot'),
		link: '#&tab=commerce',
		sectionId: 'ai-sales-assistant-card',
		icon: 'ai',
	},
	{
		id: 'page-section-ai-sales-optimizer',
		tab: 'commerce',
		category: 'sections',
		name: __('AI Sales Optimizer', 'vulopilot'),
		desc: __(
			'Real cross-sell, upsell, and bundle opportunities across your store.',
			'vulopilot'
		),
		link: '#&tab=commerce',
		sectionId: 'ai-sales-optimizer-card',
		icon: 'ai',
	},
	{
		id: 'page-section-content-stats',
		tab: 'content',
		category: 'sections',
		name: __('Content Stats', 'vulopilot'),
		desc: __('Your real content numbers for the selected period.', 'vulopilot'),
		link: '#&tab=content',
		sectionId: 'content-stats-card',
		icon: 'ai',
	},
	{
		id: 'page-section-content-quick-actions',
		tab: 'content',
		category: 'sections',
		name: __('Quick Actions', 'vulopilot'),
		desc: __('Jump straight to your most common content tasks.', 'vulopilot'),
		link: '#&tab=content',
		sectionId: 'content-quick-actions-card',
		icon: 'ai',
	},
	{
		id: 'page-section-health-website-score',
		tab: 'health',
		category: 'sections',
		name: __('Website health score', 'vulopilot'),
		desc: __('Your overall score plus open and critical findings site-wide.', 'vulopilot'),
		link: '#&tab=health',
		sectionId: 'health-website-score-card',
		icon: 'home',
	},
	{
		id: 'page-section-health-score-by-pillar',
		tab: 'health',
		category: 'sections',
		name: __('Score by pillar', 'vulopilot'),
		desc: __('Your score broken down by scanner area.', 'vulopilot'),
		link: '#&tab=health',
		sectionId: 'health-score-by-pillar-card',
		icon: 'category',
	},
	{
		id: 'page-section-health-score-trend',
		tab: 'health',
		category: 'sections',
		name: __('Health score trend, last 30 days', 'vulopilot'),
		desc: __('Your real overall health score, tracked daily.', 'vulopilot'),
		link: '#&tab=health',
		sectionId: 'health-score-trend-card',
		icon: 'analytics',
	},
];

export const searchIndex: SearchItem[] = [
	...buildIndexFromContext(contextSettings, 'settings'),
	...buildIndexFromContext(contextModules, 'modules'),
	...PAGE_SECTIONS,
];
