import { __ } from '@wordpress/i18n';
import { applyFilters } from '@wordpress/hooks';
import { createStatWidgetComponent, StatWidgetConfig } from './StatWidget';
import CrawlerTrafficWidget from './CrawlerTrafficWidget';
import NeedsAttentionWidget from './NeedsAttentionWidget';
import OverallScoreWidget from './OverallScoreWidget';
import SiteSnapshotWidget from './SiteSnapshotWidget';
import RecentActivityWidget from './RecentActivityWidget';
import { WidgetDefinition } from './types';

/**
 * The newer "Good morning" Dashboard mockup's own top section, in its exact order.
 */
const MOCKUP_WIDGETS: WidgetDefinition[] = [
	{
		id: 'overall-score',
		title: __('Vital Pulse', 'vulopilot'),
		desc: __('Your real sitewide health score, critical-issue count, and last scan time.', 'vulopilot'),
		icon: 'analytics',
		grid: 6,
		component: OverallScoreWidget,
	},
	{
		id: 'site-snapshot',
		title: __('Site snapshot', 'vulopilot'),
		desc: __('Real WordPress core counts - posts, pages, comments, users, and active plugins.', 'vulopilot'),
		icon: 'info',
		grid: 6,
		component: SiteSnapshotWidget,
	},
	{
		id: 'needs-attention',
		title: __('Needs your attention', 'vulopilot'),
		desc: __('Real open issues, quick fixes, and pending approvals that need action.', 'vulopilot'),
		icon: 'error',
		grid: 6,
		component: NeedsAttentionWidget,
	},
	{
		id: 'crawler-traffic',
		title: __('AI crawler traffic', 'vulopilot'),
		desc: __('A quick look at real AI crawler visits, with a link to the full report.', 'vulopilot'),
		icon: 'global-community',
		grid: 6,
		component: CrawlerTrafficWidget,
	},
	{
		id: 'recent-activity',
		title: __('Recent activity', 'vulopilot'),
		desc: __('A real feed of meaningful site events - scans, fixes, and changes.', 'vulopilot'),
		icon: 'recent',
		grid: 12,
		component: RecentActivityWidget,
	},
	
];

/**
 * No config-driven "one number" stat widgets left on the Dashboard - see StatWidget.tsx for why
 * these ever shared one component.
 */

const STAT_WIDGET_CONFIGS: StatWidgetConfig[] = [];

const STAT_WIDGETS: WidgetDefinition[] = STAT_WIDGET_CONFIGS.map(
	(config) => ({
		id: config.id,
		title: config.title,
		icon: config.icon,
		grid: 4,
		component: createStatWidgetComponent(config),
	})
);


export const DEFAULT_DASHBOARD_WIDGETS: WidgetDefinition[] = applyFilters(
	'vulopilot_dashboard_widgets',
	// MOCKUP_WIDGETS leads (Vital Pulse through every pre-mockup widget it carries forward, see
	// its own docblock above).
		[
			...MOCKUP_WIDGETS,
			...STAT_WIDGETS,
		]
	) as WidgetDefinition[];