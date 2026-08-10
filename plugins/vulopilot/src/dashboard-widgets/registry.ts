import { __ } from '@wordpress/i18n';
import { applyFilters } from '@wordpress/hooks';
import { createStatWidgetComponent, StatWidgetConfig } from './StatWidget';
import HealthTimelineWidget from './HealthTimelineWidget';
import LatestReportsWidget from './LatestReportsWidget';
import AutomationStatusWidget from './AutomationStatusWidget';
import CrawlerTrafficWidget from './CrawlerTrafficWidget';
import KnowledgeGraphWidget from './KnowledgeGraphWidget';
import NeedsAttentionWidget from './NeedsAttentionWidget';
import BrandBreakdownWidget from './BrandBreakdownWidget';
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
 * No config-driven "one number" stat widgets left on the Dashboard — see
 * StatWidget.tsx for why these ever shared one component. Overall health,
 * SEO, Performance, Security, WooCommerce, Accessibility, and GEO used to
 * live here too, but they duplicated the exact same category_scores
 * numbers HealthPillarsWidget's ScoreRing/pillar tiles already show;
 * Quick fixes' plain count duplicated NeedsAttentionWidget's real "Quick
 * fixes" tab. Removed rather than kept alongside, same as the mockup this
 * dashboard is modeled on never showing a score two different ways.
 * Content/Brand moved the same way — they're now score cards inside
 * OverallScoreWidget's own card grid. AI usage moved off the Dashboard
 * entirely — it's now AiUsageCard on the AI Copilot page
 * (pages/AIAssistant/AiUsageCard.tsx), reading the same real
 * `ai_jobs_used`/`ai_jobs_quota` fields directly from `GET /dashboard`.
 */

const STAT_WIDGET_CONFIGS: StatWidgetConfig[] = [];


/**
 * Widgets with custom layouts
 */
const STANDALONE_WIDGETS: WidgetDefinition[] = [
	{
		id: 'needs-attention',
		title: __('Needs your attention', 'vulopilot'),
		icon: 'error',
		grid: 12,
		component: NeedsAttentionWidget,
	},
	{
		id: 'automation-status',
		title: __('Automation status', 'vulopilot'),
		icon: 'automation',
		grid: 4,
		component: AutomationStatusWidget,
	},
	{
		id: 'crawler-traffic',
		title: __('AI crawler traffic', 'vulopilot'),
		icon: 'global-community',
		grid: 4,
		component: CrawlerTrafficWidget,
	},
	{
		id: 'knowledge-graph',
		title: __('Knowledge Graph', 'vulopilot'),
		icon: 'centralized-connections',
		grid: 4,
		component: KnowledgeGraphWidget,
	},
	// Health timeline / Latest reports / Brand Visibility breakdown are a
	// deliberate one-row group: each is grid:4 (12/3), and kept adjacent
	// here so they always share a row in the default layout rather than
	// relying on some other widget's grid happening to sum to 12 first.
	// A user can still drag them apart via Customize dashboard — this
	// only controls the never-customized/"Restore default" order.
	{
		id: 'health-timeline',
		title: __('Health timeline', 'vulopilot'),
		icon: 'analytics',
		grid: 4,
		component: HealthTimelineWidget,
	},
	{
		id: 'brand-breakdown',
		title: __('Brand Visibility breakdown', 'vulopilot'),
		icon: 'person',
		grid: 4,
		component: BrandBreakdownWidget,
	},
	{
		id: 'latest-reports',
		title: __('Latest reports', 'vulopilot'),
		icon: 'report',
		grid: 4,
		component: LatestReportsWidget,
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