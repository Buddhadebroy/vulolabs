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
import RecentChangesWidget from './RecentChangesWidget';
import KeyPagesWidget from './KeyPagesWidget';
import SiteSnapshotWidget from './SiteSnapshotWidget';
import RecentActivityWidget from './RecentActivityWidget';
import VuloPilotActivityWidget from './VuloPilotActivityWidget';
import { WidgetDefinition } from './types';

/**
 * The newer "Good morning" Dashboard mockup's own top section, in its exact
 * order — Vital Pulse (full-width now that "Run complete audit" lives in
 * the page header instead, see Dashboard.tsx), VuloPilot activity (a
 * separate mockup screenshot — 5 real tiles, see VuloPilotActivityWidget.tsx's
 * own docblock for which real endpoint backs each one and why its mockup's
 * 6th tile, "Next audit", isn't included), Needs your attention (moved up
 * from STANDALONE_WIDGETS below to sit right under Vital Pulse, matching
 * the mockup), Key pages at a glance + Site snapshot (a new side-by-side
 * pair), Recent activity. Every pre-existing widget this mockup doesn't
 * show as its own card (Run Complete Audit, Recent Changes) is NOT removed —
 * per direct instruction, anything already on this Dashboard that isn't
 * depicted in the new mockup stays, appended immediately after this list
 * (still inside MOCKUP_WIDGETS, so the never-customized default layout
 * keeps them, just lower on the page).
 *
 * AI Suggestions and Today's Tasks WERE removed from here (per direct
 * instruction, after confirming the duplication) — not kept-but-appended
 * like the rest, because both were genuine content duplicates rather than
 * merely "not in the new mockup":
 * - AISuggestionsWidget.tsx's own docblock already said it "reads the same
 *   `/findings` endpoint NeedsAttentionWidget's 'Open issues' tab already
 *   uses" — same query, same real findings, just a second styling of the
 *   identical rows.
 * - TodaysTasksWidget.tsx read the same unfiltered `/activity-logs` feed
 *   RecentActivityWidget now reads (curated to a real, meaningful
 *   event-type subset) — confirmed live to show the same rows in practice.
 * Both component files are left in place, unused, rather than deleted
 * (same "supersede don't delete" posture this codebase already applies to
 * other superseded components) — their own docblocks now point at their
 * replacement. Removed from `Utill::DASHBOARD_WIDGET_IDS` too, so neither
 * can be re-added via "Customize dashboard" (the id is no longer valid) and
 * an existing saved layout naturally drops its now-meaningless entry for
 * either on its next reconciliation.
 */
const MOCKUP_WIDGETS: WidgetDefinition[] = [
	{
		id: 'overall-score',
		title: __('Vital Pulse', 'vulopilot'),
		icon: 'analytics',
		grid: 12,
		component: OverallScoreWidget,
	},
	{
		id: 'vulopilot-activity',
		title: __('VuloPilot activity', 'vulopilot'),
		icon: 'analytics',
		grid: 12,
		component: VuloPilotActivityWidget,
	},
	{
		id: 'needs-attention',
		title: __('Needs your attention', 'vulopilot'),
		icon: 'error',
		grid: 12,
		component: NeedsAttentionWidget,
	},
	{
		id: 'key-pages',
		title: __('Key pages at a glance', 'vulopilot'),
		icon: 'pages',
		grid: 6,
		component: KeyPagesWidget,
	},
	{
		id: 'site-snapshot',
		title: __('Site snapshot', 'vulopilot'),
		icon: 'info',
		grid: 6,
		component: SiteSnapshotWidget,
	},
	{
		id: 'recent-activity',
		title: __('Recent activity', 'vulopilot'),
		icon: 'clock',
		grid: 12,
		component: RecentActivityWidget,
	},
	// Below this point: every widget that predates the new mockup and isn't
	// depicted in it — kept, unmoved in behavior, just appended rather than
	// deleted (direct instruction). `run-audit` is grid:12 (was grid:4,
	// paired with the now-removed ai-suggestions/todays-tasks in the same
	// row) since it has no row-mate left to share a line with.
	{
		id: 'run-audit',
		title: __('Run Complete Audit', 'vulopilot'),
		icon: 'search',
		grid: 12,
		component: RunAuditWidget,
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
 * entirely, then off the AI Copilot page too — the raw used/quota count
 * (`ai_jobs_used`/`ai_jobs_quota` on `GET /dashboard`) was replaced there by
 * RecommendedActionsCard (pages/AIAssistant/RecommendedActionsCard.tsx),
 * a more actionable real-findings summary.
 */

const STAT_WIDGET_CONFIGS: StatWidgetConfig[] = [];


/**
 * Widgets with custom layouts
 */
const STANDALONE_WIDGETS: WidgetDefinition[] = [
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
	// MOCKUP_WIDGETS leads (Vital Pulse through every pre-mockup widget it
	// carries forward, see its own docblock above), then STANDALONE_WIDGETS/
	// STAT_WIDGETS — this only affects the default layout a never-customized
	// install seeds; anyone who has already saved a layout keeps their own
	// order (DashboardLayout.php persists that separately from this array).
		[
			...MOCKUP_WIDGETS,
			...STANDALONE_WIDGETS,
			...STAT_WIDGETS,
		]
	) as WidgetDefinition[];