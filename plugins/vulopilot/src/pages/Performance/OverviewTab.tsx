import { useState } from 'react';
import { ColumnComponent, ContainerComponent } from '@zyra/components';
import { scrollToId } from '@zyra/core';
import type { SectionedIssuesTab } from '../Security/SectionedIssuesTable';
import EfficiencyHeroCard from '../Security/EfficiencyHeroCard';
import EfficiencySectionsList from '../Security/EfficiencySectionsList';
import EfficiencyThingsToReview from '../Security/EfficiencyThingsToReview';
import EfficiencyOverviewChart from '../Security/EfficiencyOverviewChart';
import LiveSiteInsightsCard from '../Security/LiveSiteInsightsCard';
import { useEfficiencyChecks, THINGS_TO_REVIEW_ID } from '../Security/efficiencyChecks';
import PerformanceScoreCard from './PerformanceScoreCard';
import MetricsGrid from './MetricsGrid';
import SpeedHistoryCard from './SpeedHistoryCard';
import QuickActionsCard from './QuickActionsCard';
import RealTimeMonitoringCard from './RealTimeMonitoringCard';
import BiggestSpeedOpportunityCard from './BiggestSpeedOpportunityCard';
import AiSpeedAssistantCard from './AiSpeedAssistantCard';
import PerformanceTab from './PerformanceTab';
import './Performance.scss';

/**
 * "Performance"'s only tab — see this folder's sibling files for the
 * per-section real-data mapping (PerformanceScoreCard, MetricsGrid,
 * SpeedHistoryCard, QuickActionsCard, RealTimeMonitoringCard,
 * BiggestSpeedOpportunityCard, AiSpeedAssistantCard — each documents its own data
 * source and, where the mockup shows something with no real backend, its
 * honest fallback).
 *
 * Used to also have a "Speed Boost Available" card (SpeedBoostCard.tsx,
 * now deleted) paired 50/50 with SpeedHistoryCard right below MetricsGrid
 * — removed per direct instruction: it was a second CTA for the exact
 * same action AiSpeedAssistantCard.tsx's own "Optimize with AI"/"Review
 * First" pair already covers (same underlying open-finding count, same
 * honestly-disabled bulk-fix button). SpeedHistoryCard now renders alone,
 * full-width in this column, rather than re-pairing it with something
 * else.
 *
 * The full, unified category-'performance' issues table (PerformanceTab.tsx,
 * titled "Top Issues" — same sectioned-table shape "Protect My Site"'s
 * Security/Files & Plugins/Accessibility tabs use) lives here too, below the
 * condensed cards, wrapped in `#performance-section-findings` —
 * AiSpeedAssistantCard's own "Review First" button scrolls to and
 * highlights that id (same same-page scroll-and-highlight pattern
 * OpenIssuesGlimpse's own default behavior uses elsewhere). PerformanceScoreCard's "View Slow
 * Pages" button instead jumps to the real "Slow Pages" tab
 * (`onNavigateToSlowPages`, owned by Performance.tsx) — a real per-page
 * report now exists there, so scrolling to the Top Issues findings table
 * would undersell what that button promises.
 *
 * `activeIssuesTab` (the Top Issues table's own section tab) is owned here,
 * not by PerformanceTab.tsx itself, so MetricsGrid.tsx's own per-tile
 * "View" buttons can jump straight to a specific section — same
 * "controlled activeTab passed down to a shared table" shape
 * AccessibilityTab.tsx already uses for AccessibilityChecksGrid's "Review"
 * buttons.
 *
 * Also now carries the WordPress/server-side efficiency checks
 * (EfficiencyHeroCard/EfficiencySectionsList/EfficiencyThingsToReview/
 * EfficiencyOverviewChart + LiveSiteInsightsCard, all imported from
 * `../Security/` rather than physically moved — SiteHealthTab.tsx still
 * needs the same `useEfficiencyChecks()` endpoint for its own
 * PhpAccelerationCard.tsx, so the components stayed put) — moved here
 * from the since-removed "Protect My Site" → Performance tab per direct
 * instruction, to stop the two pages covering overlapping ground. Of the
 * 4 checks `GET /efficiency-checks` (Controllers\EfficiencyChecks.php)
 * returns, only page caching/browser caching/persistent object cache
 * came along — PHP acceleration (OPcache) is a server-config fact, not a
 * page-delivery one, so it stayed behind on Site Health's own Server
 * section instead (PhpAccelerationCard.tsx). Since the endpoint's own
 * `summary`/`sections`/`review_items` bundle all 4 checks together,
 * the OPcache check is filtered back out client-side here (see
 * `efficiencySummary`/`efficiencySections`/`efficiencyReviewItems` below)
 * rather than changing what the endpoint itself returns — SiteHealthTab's
 * card still needs the unfiltered response.
 *
 * Doesn't repeat SpeedHistoryCard a second time (the old Performance tab
 * paired it with EfficiencyHeroCard/EfficiencyOverviewChart) since this
 * page already shows that same shared card once, paired with
 * SpeedBoostCard below — nor PluginOverlapCard `category="caching"` (the
 * old tab's own closing card), since PerformanceTab.tsx's own Top Issues
 * table, already rendered on this page, closes with that exact card.
 */
interface OverviewTabProps {
	onNavigateToSlowPages: () => void;
}

const OverviewTab = ({ onNavigateToSlowPages }: OverviewTabProps) => {
	const [activeIssuesTab, setActiveIssuesTab] =
		useState<SectionedIssuesTab>('all');
	const { data: efficiencyData, isLoading: isEfficiencyLoading } =
		useEfficiencyChecks();

	const scrollToFindings = () => scrollToId('performance-section-findings');

	// "View all" on the efficiency hero/chart/review cards used to scroll
	// to a wrapping div's own id — now that each section card carries its
	// own real id (`section.key`, see EfficiencySectionsList.tsx), it
	// scrolls straight to the first rendered section instead.
	const scrollToEfficiencySections = () => {
		const firstSectionId = efficiencySections[0]?.key;

		if (firstSectionId) {
			scrollToId(firstSectionId);
		}
	};

	/** MetricsGrid's own scanner-backed tiles — switches the Top Issues table to that tile's section, then scrolls to it. */
	const goToIssuesSection = (sectionKey: string) => {
		setActiveIssuesTab(sectionKey);
		setTimeout(scrollToFindings, 50);
	};

	// The OPcache check (PhpAccelerationCard.tsx's own, on Site Health's
	// Server section instead) filtered back out of the shared endpoint's
	// payload — see this file's own docblock for why it isn't excluded
	// server-side.
	const opcacheCheck = efficiencyData?.sections.find(
		(section) => section.key === 'server-processing'
	)?.checks[0];
	const efficiencySections = (efficiencyData?.sections ?? []).filter(
		(section) => section.key !== 'server-processing'
	);
	const efficiencyReviewItems = (efficiencyData?.review_items ?? []).filter(
		(item) => item.id !== 'opcache'
	);
	const efficiencySummary = efficiencyData
		? {
			total: efficiencyData.summary.total - 1,
			need_attention:
				efficiencyData.summary.need_attention -
				(opcacheCheck?.status === 'attention' ? 1 : 0),
			working:
				efficiencyData.summary.working -
				(opcacheCheck?.status === 'good' ? 1 : 0),
			not_applicable:
				efficiencyData.summary.not_applicable -
				(opcacheCheck?.status === 'not_applicable' ? 1 : 0),
		}
		: null;

	return (
		<>
			{/* 1st fold */}
			<PerformanceScoreCard onViewDetails={onNavigateToSlowPages} />

			{/* 2nd fold */}
			<ColumnComponent grid={8}>
				<MetricsGrid
					onViewSection={goToIssuesSection}
					onViewCoreWebVitals={() =>
						scrollToId('performance-core-web-vitals-card')
					}
				/>
			</ColumnComponent>

			<ColumnComponent grid={4}>
				<AiSpeedAssistantCard onReviewIssues={scrollToFindings} />
				<BiggestSpeedOpportunityCard onViewSlowPages={onNavigateToSlowPages} />
			</ColumnComponent>
			
			{/* 3rd fold */}
			<ColumnComponent grid={6} fullHeight>
				<SpeedHistoryCard />
			</ColumnComponent>

			{/* 4th fold */}
			<ColumnComponent fullHeight grid={4}>
				<EfficiencyHeroCard
					summary={efficiencySummary}
					isLoading={isEfficiencyLoading}
					onReviewImprovements={() => scrollToId(THINGS_TO_REVIEW_ID)}
				/>
			</ColumnComponent>
			<ColumnComponent fullHeight grid={4}>
				<EfficiencyOverviewChart
					summary={efficiencySummary}
					isLoading={isEfficiencyLoading}
					onViewAll={scrollToEfficiencySections}
				/>
			</ColumnComponent>

			<EfficiencySectionsList
				sections={efficiencySections}
				isLoading={isEfficiencyLoading}
			/>
			
			<ColumnComponent fullHeight grid={6}>
				<EfficiencyThingsToReview
					reviewItems={efficiencyReviewItems}
					summary={efficiencySummary}
					isLoading={isEfficiencyLoading}
					onViewAll={scrollToEfficiencySections}
				/>
			</ColumnComponent>
			<ColumnComponent grid={6}>
				<LiveSiteInsightsCard />
			</ColumnComponent>
			<ColumnComponent >
				<div id="performance-section-findings">
					<PerformanceTab
						activeTab={activeIssuesTab}
						onTabChange={setActiveIssuesTab}
					/>
				</div>
			</ColumnComponent>
		</>
	);
};

export default OverviewTab;
