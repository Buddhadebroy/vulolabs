import React from 'react';
import { ColumnComponent, ContainerComponent } from '@zyra/components';
import ReportsHeroCard from './ReportsHeroCard';
import AiAnalystCard from './AiAnalystCard';
import CategoryScoresGrid from './CategoryScoresGrid';
import WebsiteProgressChart from './WebsiteProgressChart';
import ReportHighlightsRow from './ReportHighlightsRow';
import RecentAchievementsCard from './RecentAchievementsCard';
import ReportTypeCards from './ReportTypeCards';
import ReportSchedulesSummary from './ReportSchedulesSummary';
import './Reports.scss';

const scrollToGenerate = () => {
	document
		.getElementById('reports-generate')
		?.scrollIntoView({ behavior: 'smooth' });
};

/**
 * "Reports"'s new default tab — see this folder's sibling files for the
 * per-section real-data mapping (each documents its own data source and,
 * where the mockup shows something with no real backend, its honest
 * fallback). The mockup's "AI Executive Summary" section is dropped
 * entirely — see ReportSchedulesSummary.tsx's own docblock and the plan
 * this was built from for why nothing in it had a real partial subset
 * worth salvaging.
 */
const OverviewTab = () => (
	<ContainerComponent general>
		<ColumnComponent grid={8}>
			<ReportsHeroCard onScrollToGenerate={scrollToGenerate} />
			<CategoryScoresGrid />
			<WebsiteProgressChart />
			<ReportHighlightsRow />
			<ReportTypeCards />
			<ReportSchedulesSummary />
		</ColumnComponent>

		<ColumnComponent grid={4}>
			<AiAnalystCard />
			<RecentAchievementsCard />
		</ColumnComponent>
	</ContainerComponent>
);

export default OverviewTab;
