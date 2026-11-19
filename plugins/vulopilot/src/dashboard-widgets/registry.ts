import { __ } from '@wordpress/i18n';
import { applyFilters } from '@wordpress/hooks';
import CrawlerTrafficWidget from './CrawlerTrafficWidget';
import SiteSnapshotWidget from './SiteSnapshotWidget';
import VuloPilotActivityWidget from './VuloPilotActivityWidget';
import { WidgetDefinition } from './types';

/**
 * The dashboard's "More insights" section: analysis people can reorder or hide. What needs doing (health summary,
 * next steps, autopilot, recent changes) is drawn by pages/Dashboard itself and is not customizable.
 * Every id must be in Utill::DASHBOARD_WIDGET_IDS, or saved layouts drop it.
 */
const INSIGHT_WIDGETS: WidgetDefinition[] = [
	{
		id: 'vulopilot-activity',
		title: __('Health trend', 'vulopilot'),
		desc: __('How your overall score has moved over time.', 'vulopilot'),
		icon: 'analytics',
		grid: 7,
		component: VuloPilotActivityWidget,
	},
	{
		id: 'crawler-traffic',
		title: __('AI crawler traffic', 'vulopilot'),
		desc: __('Which AI crawlers visit your site, and when they last came.', 'vulopilot'),
		icon: 'global-community',
		grid: 5,
		component: CrawlerTrafficWidget,
	},
	{
		id: 'site-snapshot',
		title: __('Site profile', 'vulopilot'),
		desc: __("Your site's content, technology, audience and the identity AI engines see.", 'vulopilot'),
		icon: 'website',
		grid: 12,
		component: SiteSnapshotWidget,
	},
];

export const DEFAULT_DASHBOARD_WIDGETS: WidgetDefinition[] = applyFilters(
	'vulopilot_dashboard_widgets',
	INSIGHT_WIDGETS
) as WidgetDefinition[];
