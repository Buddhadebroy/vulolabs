import { __ } from '@wordpress/i18n';
import { applyFilters } from '@wordpress/hooks';
import { createStatWidgetComponent, StatWidgetConfig } from './StatWidget';
import HealthTimelineWidget from './HealthTimelineWidget';
import RecentActivityWidget from './RecentActivityWidget';
import LatestReportsWidget from './LatestReportsWidget';
import AutomationStatusWidget from './AutomationStatusWidget';
import CrawlerTrafficWidget from './CrawlerTrafficWidget';
import KnowledgeGraphWidget from './KnowledgeGraphWidget';
import HealthPillarsWidget from './HealthPillarsWidget';
import NeedsAttentionWidget from './NeedsAttentionWidget';
import BrandBreakdownWidget from './BrandBreakdownWidget';
import IssueDistributionWidget from './IssueDistributionWidget';
import { WidgetDefinition } from './types';

const STAT_WIDGET_CONFIGS: StatWidgetConfig[] = [
	{
		id: 'ai-usage',
		title: __('AI usage', 'vulopilot'),
		icon: 'ai',
		getNumber: (summary) =>
			`${summary.ai_jobs_used}/${summary.ai_jobs_quota}`,
		getExtra: () => __('This month', 'vulopilot'),
	},
	{
		id: 'content',
		title: __('Content', 'vulopilot'),
		icon: 'text-fields',
		getNumber: (summary) =>
			`${summary.category_scores.content}/100`,
		getExtra: () =>
			__('Readability, thin/duplicate content, links', 'vulopilot'),
	},
	{
		id: 'brand',
		title: __('Brand', 'vulopilot'),
		icon: 'person',
		getNumber: (summary) =>
			`${summary.category_scores.brand}/100`,
		getExtra: () =>
			__('Trust, authority, and entity signals', 'vulopilot'),
	},
];


/**
 * Widgets with custom layouts
 */
const STANDALONE_WIDGETS: WidgetDefinition[] = [
	{
		id: 'health-pillars',
		title: __('Health by pillar', 'vulopilot'),
		icon: 'home',
		grid: 12,
		component: HealthPillarsWidget,
	},
	{
		id: 'needs-attention',
		title: __('Needs your attention', 'vulopilot'),
		icon: 'error',
		grid: 12,
		component: NeedsAttentionWidget,
	},
	{
		id: 'brand-breakdown',
		title: __('Brand Visibility breakdown', 'vulopilot'),
		icon: 'person',
		grid: 8,
		component: BrandBreakdownWidget,
	},
	{
		id: 'recent-activity',
		title: __('Recent activity', 'vulopilot'),
		icon: 'clock',
		grid: 8,
		component: RecentActivityWidget,
	},
	{
		id: 'health-timeline',
		title: __('Health timeline', 'vulopilot'),
		icon: 'analytics',
		grid: 12,
		component: HealthTimelineWidget,
	},
	{
		id: 'latest-reports',
		title: __('Latest reports', 'vulopilot'),
		icon: 'report',
		grid: 8,
		component: LatestReportsWidget,
	},
	{
		id: 'automation-status',
		title: __('Automation status', 'vulopilot'),
		icon: 'automation',
		grid: 8,
		component: AutomationStatusWidget,
	},
	{
		id: 'crawler-traffic',
		title: __('AI crawler traffic', 'vulopilot'),
		icon: 'global-community',
		grid: 8,
		component: CrawlerTrafficWidget,
	},
	{
		id: 'knowledge-graph',
		title: __('Knowledge Graph', 'vulopilot'),
		icon: 'centralized-connections',
		grid: 8,
		component: KnowledgeGraphWidget,
	},
	{
		id: 'issue-distribution',
		title: __('Issue distribution', 'vulopilot'),
		icon: 'error',
		grid: 8,
		component: IssueDistributionWidget,
	},
];


const STAT_WIDGETS: WidgetDefinition[] = STAT_WIDGET_CONFIGS.map(
	(config) => ({
		id: config.id,
		title: config.title,
		icon: config.icon,
		grid: 3,
		component: createStatWidgetComponent(config),
	})
);


export const DEFAULT_DASHBOARD_WIDGETS: WidgetDefinition[] =
	applyFilters(
		'vulopilot_dashboard_widgets',
		[
			...STANDALONE_WIDGETS,
			...STAT_WIDGETS,
		]
	) as WidgetDefinition[];