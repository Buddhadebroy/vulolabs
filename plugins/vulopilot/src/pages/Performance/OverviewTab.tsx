import { useState } from 'react';
import { ColumnComponent, ContainerComponent } from '@zyra/components';
import type { SectionedIssuesTab } from '../Security/SectionedIssuesTable';
import PerformanceScoreCard from './PerformanceScoreCard';
import SpeedBoostCard from './SpeedBoostCard';
import MetricsGrid from './MetricsGrid';
import SpeedHistoryCard from './SpeedHistoryCard';
import QuickActionsCard from './QuickActionsCard';
import RealTimeMonitoringCard from './RealTimeMonitoringCard';
import PerformanceTipsCard from './PerformanceTipsCard';
import AiSpeedAssistantCard from './AiSpeedAssistantCard';
import PerformanceTab from './PerformanceTab';
import './ImproveSpeed.scss';

/**
 * "Improve Speed"'s only tab — see this folder's sibling files for the
 * per-section real-data mapping (PerformanceScoreCard, SpeedBoostCard,
 * MetricsGrid, SpeedHistoryCard, QuickActionsCard, RealTimeMonitoringCard,
 * PerformanceTipsCard, AiSpeedAssistantCard — each documents its own data
 * source and, where the mockup shows something with no real backend, its
 * honest fallback).
 *
 * PerformanceScoreCard itself now renders its own full-width row (two
 * cards internally: "Overall Speed Score" and "Core Web Vitals") — with
 * that space no longer shared with SpeedBoostCard, SpeedBoostCard now
 * pairs with SpeedHistoryCard instead, the same 50/50 row shape
 * TopIssuesCard/SpeedHistoryCard used before TopIssuesCard was removed.
 *
 * The full, unified category-'performance' issues table (PerformanceTab.tsx,
 * titled "Top Issues" — same sectioned-table shape "Protect My Site"'s
 * Security/Files & Plugins/Accessibility tabs use) lives here too, below the
 * condensed cards, wrapped in `#performance-section-findings` —
 * SpeedBoostCard's own "View Details" button scrolls to and highlights
 * that id (same same-page scroll-and-highlight pattern OpenIssuesGlimpse's
 * own default behavior uses elsewhere). PerformanceScoreCard's "View Slow
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
 */
interface OverviewTabProps {
	onNavigateToSlowPages: () => void;
}

const OverviewTab = ({ onNavigateToSlowPages }: OverviewTabProps) => {
	const [activeIssuesTab, setActiveIssuesTab] =
		useState<SectionedIssuesTab>('all');

	const scrollTo = (id: string) => {
		const el = document.getElementById(id);

		if (!el) {
			return;
		}

		el.scrollIntoView({ behavior: 'smooth', block: 'start' });
		el.classList.add('vulopilot-glimpse-highlight');
		setTimeout(() => el.classList.remove('vulopilot-glimpse-highlight'), 1200);
	};

	const scrollToFindings = () => scrollTo('performance-section-findings');

	/** MetricsGrid's own scanner-backed tiles — switches the Top Issues table to that tile's section, then scrolls to it. */
	const goToIssuesSection = (sectionKey: string) => {
		setActiveIssuesTab(sectionKey);
		setTimeout(scrollToFindings, 50);
	};

	return (
		<>
				<ColumnComponent grid={8}>
					<PerformanceScoreCard onViewDetails={onNavigateToSlowPages} />

					<MetricsGrid
						onViewSection={goToIssuesSection}
						onViewCoreWebVitals={() =>
							scrollTo('performance-core-web-vitals-card')
						}
						onViewPerformanceMonitor={() =>
							scrollTo('performance-realtime-monitoring-card')
						}
					/>

					<ContainerComponent>
						<ColumnComponent fullHeight grid={6}>
							<SpeedBoostCard onViewDetails={scrollToFindings} />
						</ColumnComponent>
						<ColumnComponent fullHeight grid={6}>
							<SpeedHistoryCard />
						</ColumnComponent>
					</ContainerComponent>
				</ColumnComponent>

				<ColumnComponent grid={4}>
					<QuickActionsCard />
					<RealTimeMonitoringCard />
					<PerformanceTipsCard />
					<AiSpeedAssistantCard onReviewIssues={scrollToFindings} />
				</ColumnComponent>
			<ColumnComponent>
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
