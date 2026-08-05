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
import OverallScoreWidget from './OverallScoreWidget';
import RunAuditWidget from './RunAuditWidget';
import AISuggestionsWidget from './AISuggestionsWidget';
import TodaysTasksWidget from './TodaysTasksWidget';
import RecentChangesWidget from './RecentChangesWidget';
import { WidgetDefinition } from './types';

/**
 * The Dashboard mockup's own top section, in its exact order — Overall
 * Site Score, Run Complete Audit, the 4 score-ring cards, AI Suggestions,
 * Today's Tasks, Recent Changes. Prepended ahead of every other widget
 * below (STANDALONE_WIDGETS/STAT_WIDGETS) so the default, never-customized
 * layout matches the mockup top-to-bottom; every existing widget keeps
 * its id, its order relative to the others, and its own behavior.
 */
const MOCKUP_WIDGETS: WidgetDefinition[] = [
	{
		id: 'overall-score',
		title: __('Overall Site Score', 'vulopilot'),
		icon: 'analytics',
		grid: 8,
		component: OverallScoreWidget,
	},
	{
		id: 'run-audit',
		title: __('Run Complete Audit', 'vulopilot'),
		icon: 'search',
		grid: 4,
		component: RunAuditWidget,
	},
	{
		id: 'ai-suggestions',
		title: __('AI Suggestions', 'vulopilot'),
		icon: 'ai',
		grid: 7,
		component: AISuggestionsWidget,
	},
	{
		id: 'todays-tasks',
		title: __("Today's Tasks", 'vulopilot'),
		icon: 'clock',
		grid: 5,
		component: TodaysTasksWidget,
	},
	{
		id: 'recent-changes',
		title: __('Recent Changes', 'vulopilot'),
		icon: 'update',
		grid: 12,
		component: RecentChangesWidget,
	},
];

/**
 * The three "one number" stat widgets left that aren't already covered by
 * another widget — see StatWidget.tsx for why these share one component.
 * Overall health, SEO, Performance, Security, WooCommerce, Accessibility,
 * and GEO used to live here too, but they duplicated the exact same
 * category_scores numbers HealthPillarsWidget's ScoreRing/pillar tiles
 * already show; Quick fixes' plain count duplicated
 * NeedsAttentionWidget's real "Quick fixes" tab. Removed rather than kept
 * alongside, same as the mockup this dashboard is modeled on never
 * showing a score two different ways.
 */

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
		id: 'recent-activity',
		title: __('Recent activity', 'vulopilot'),
		icon: 'clock',
		grid: 6,
		component: RecentActivityWidget,
	},
	{
		id: 'health-timeline',
		title: __('Health timeline', 'vulopilot'),
		icon: 'analytics',
		grid: 6,
		component: HealthTimelineWidget,
	},
	{
		id: 'needs-attention',
		title: __('Needs your attention', 'vulopilot'),
		icon: 'error',
		grid: 6,
		component: NeedsAttentionWidget,
	},
	{
		id: 'latest-reports',
		title: __('Latest reports', 'vulopilot'),
		icon: 'report',
		grid: 6,
		component: LatestReportsWidget,
	},
	{
		id: 'automation-status',
		title: __('Automation status', 'vulopilot'),
		icon: 'automation',
		grid: 3,
		component: AutomationStatusWidget,
	},
	{
		id: 'crawler-traffic',
		title: __('AI crawler traffic', 'vulopilot'),
		icon: 'global-community',
		grid: 3,
		component: CrawlerTrafficWidget,
	},
	{
		id: 'knowledge-graph',
		title: __('Knowledge Graph', 'vulopilot'),
		icon: 'centralized-connections',
		grid: 6,
		component: KnowledgeGraphWidget,
	},
	{
		id: 'brand-breakdown',
		title: __('Brand Visibility breakdown', 'vulopilot'),
		
		icon: 'person',
		grid: 6,
		component: BrandBreakdownWidget,
	},
	{
		id: 'issue-distribution',
		title: __('Issue distribution', 'vulopilot'),
		icon: 'error',
		grid: 6,
		component: IssueDistributionWidget,
	},
];


const STAT_WIDGETS: WidgetDefinition[] = STAT_WIDGET_CONFIGS.map(
	(config) => ({
		id: config.id,
		title: config.title,
		icon: config.icon,
		grid: 4,
		component: createStatWidgetComponent(config),
	})
);

/**
 * Every widget the Dashboard can render, in the same order the widget
 * list was requested in. Passed through `vulopilot_dashboard_widgets`
 * (@wordpress/hooks — the same filter mechanism react-frontend.md
 * documents vulolabs using elsewhere) so a
 * Pro module or third-party plugin can append its own WidgetDefinition
 * without touching this file — the same "register a source, don't
 * modify the registry" pattern used by every PHP-side registry in this
 * plugin (ScannerRegistry, RuleRegistry, ProviderRegistry, ActionRegistry).
 */

export const DEFAULT_DASHBOARD_WIDGETS: WidgetDefinition[] = applyFilters(
	'vulopilot_dashboard_widgets',
	// mockup-widgets leads (Overall Site Score through Recent Changes, the
	// mockup's own top-to-bottom order), then health-pillars (the
	// "everything, at a glance" hero among the pre-existing widgets) —
	// this only affects the default layout a never-customized install
	// seeds; anyone who has already saved a layout keeps their own order
	// (DashboardLayout.php persists that separately from this array).
		[
			...MOCKUP_WIDGETS,
			...STANDALONE_WIDGETS,
			...STAT_WIDGETS,
		]
	) as WidgetDefinition[];