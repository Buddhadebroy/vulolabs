import { useState } from 'react';
import { ColumnComponent, ContainerComponent } from '@zyra/components';
import { scrollToId } from '@zyra/core';
import type { SectionedIssuesTab } from '../Security/SectionedIssuesTable';
import PerformanceScoreCard from './PerformanceScoreCard';
import MetricsGrid from './MetricsGrid';
import QuickActionsCard from './QuickActionsCard';
import BiggestSpeedOpportunityCard from './BiggestSpeedOpportunityCard';
import PerformanceTab from './PerformanceTab';
import './Performance.scss';

/**
 * "Performance" Overview tab, composed of PerformanceScoreCard, MetricsGrid, SpeedHistoryCard and
 * BiggestSpeedOpportunityCard.
 */
interface OverviewTabProps {
	onNavigateToSlowPages: () => void;
}

const OverviewTab = ({ onNavigateToSlowPages }: OverviewTabProps) => {
	const [activeIssuesTab, setActiveIssuesTab] =
		useState<SectionedIssuesTab>('all');

	const scrollToFindings = () => scrollToId('performance-section-findings');

	/** MetricsGrid's own scanner-backed tiles - switches the Top Issues table to that tile's section, then scrolls to it. */
	const goToIssuesSection = (sectionKey: string) => {
		setActiveIssuesTab(sectionKey);
		setTimeout(scrollToFindings, 50);
	};

	return (
		<ContainerComponent>
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
				<QuickActionsCard />
				<BiggestSpeedOpportunityCard
					onViewSlowPages={onNavigateToSlowPages}
					onViewFindings={scrollToFindings}
				/>
			</ColumnComponent>

			<ColumnComponent >
				<div id="performance-section-findings">
					<PerformanceTab
						activeTab={activeIssuesTab}
						onTabChange={setActiveIssuesTab}
					/>
				</div>
			</ColumnComponent>
		</ContainerComponent>
	);
};

export default OverviewTab;
