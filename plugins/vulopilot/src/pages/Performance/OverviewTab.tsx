import React from 'react';
import { ColumnComponent, ContainerComponent } from '@zyra/components';
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
 * The full, searchable/paginated category-'performance' FindingsTable
 * (PerformanceTab.tsx, titled "Top Issues") lives here too, below the
 * condensed cards, wrapped in `#performance-section-findings` —
 * SpeedBoostCard's own "View Details" button scrolls to and highlights
 * that id (same same-page scroll-and-highlight pattern OpenIssuesGlimpse's
 * own default behavior uses elsewhere). PerformanceScoreCard's "View Slow
 * Pages" button instead jumps to the real "Slow Pages" tab
 * (`onNavigateToSlowPages`, owned by Performance.tsx) — a real per-page
 * report now exists there, so scrolling to the Top Issues findings table
 * would undersell what that button promises.
 */
interface OverviewTabProps {
	onNavigateToSlowPages: () => void;
}

const OverviewTab = ({ onNavigateToSlowPages }: OverviewTabProps) => {
	const scrollToFindings = () => {
		const el = document.getElementById('performance-section-findings');

		if (!el) {
			return;
		}

		el.scrollIntoView({ behavior: 'smooth', block: 'start' });
		el.classList.add('vulopilot-glimpse-highlight');
		setTimeout(() => el.classList.remove('vulopilot-glimpse-highlight'), 1200);
	};

	return (
		<>
			<ContainerComponent general>
				<ColumnComponent grid={8}>
					<PerformanceScoreCard onViewDetails={onNavigateToSlowPages} />

					<MetricsGrid />

					<ContainerComponent>
						<ColumnComponent grid={6}>
							<SpeedBoostCard onViewDetails={scrollToFindings} />
						</ColumnComponent>
						<ColumnComponent grid={6}>
							<SpeedHistoryCard />
						</ColumnComponent>
					</ContainerComponent>
				</ColumnComponent>

				<ColumnComponent grid={4}>
					<QuickActionsCard />
					<RealTimeMonitoringCard />
					<PerformanceTipsCard />
					<AiSpeedAssistantCard />
				</ColumnComponent>
			</ContainerComponent>

			<div id="performance-section-findings">
				<PerformanceTab />
			</div>
		</>
	);
};

export default OverviewTab;
