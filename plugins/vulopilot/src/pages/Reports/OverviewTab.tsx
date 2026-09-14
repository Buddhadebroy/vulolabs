import { useState } from 'react';
import ReportsOverviewHeader from './ReportsOverviewHeader';
import RecentReportsCard from './RecentReportsCard';
import ScheduledReportsTable from './ScheduledReportsTable';
import ReportHistoryTable from './ReportHistoryTable';
import { ContainerComponent} from '@zyra/components';
import { DAY_OPTIONS } from './reportsOverview';
import './Reports.scss';

/**
 * "Reports"'s Overview tab — rebuilt to match the reference mockup exactly:
 * a title/desc/date-range/action header (ReportsOverviewHeader.tsx),
 * "Recent Reports" (RecentReportsCard.tsx), "Scheduled Reports"
 * (ScheduledReportsTable.tsx), and "Report History" (ReportHistoryTable.tsx)
 * — in that order, same as the mockup. The mockup's own "Build a New
 * Report" and "Report Templates" sections are deliberately omitted per
 * direct instruction; Report Builder tab (ReportTab.tsx, unchanged) still
 * carries that real generate-report flow, and both this tab's "Create
 * Report" header button and every table's empty state link there.
 *
 * This replaces this tab's previous content wholesale — the earlier
 * `GET /reports-overview`-driven dashboard (hero "Fixed/New/Still open"
 * card, 7-tile category status grid, the 6 Search/AI Visibility/Speed/
 * Security/Content/Store insight panels, activity timeline, next-priorities
 * list, schedule-a-report banner) and, before that, the even earlier
 * WebsiteProgressChart/ReportTypeCards/RecentAchievementsCard/AiAnalystCard
 * row, don't appear anywhere in this mockup and are no longer rendered
 * here. Their own files (ReportsHeroCard.tsx, ReportsCategoryStatusGrid.tsx,
 * ReportsInsightPanels.tsx, ReportsCategoryPanels.tsx,
 * WhatHappenedThisMonth.tsx, NextPrioritiesList.tsx, ScheduleReportBanner.tsx,
 * WebsiteProgressChart.tsx, ReportTypeCards.tsx, RecentAchievementsCard.tsx,
 * AiAnalystCard.tsx, and `reportsOverview.ts`'s own `useReportsOverview`
 * hook/`GET /reports-overview` consumer) are left in place, unused, rather
 * than deleted — same "supersede the render call, don't delete real,
 * working code without an explicit instruction to" posture
 * AiSpeedAssistantCard.tsx's own docblock already establishes elsewhere on
 * this page.
 */
const OverviewTab = () => {
	const [days, setDays] = useState<number>(DAY_OPTIONS[1]);

	return (
		<ContainerComponent>
			<ReportsOverviewHeader days={days} onDaysChange={setDays} />
			<RecentReportsCard days={days} />
			<ScheduledReportsTable />
			<ReportHistoryTable />
		</ContainerComponent>
	);
};

export default OverviewTab;
