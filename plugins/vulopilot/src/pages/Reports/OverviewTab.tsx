import { useState } from 'react';
import { ColumnComponent } from '@zyra/components';
import ReportsOverviewHeader from './ReportsOverviewHeader';
import ReportsHeroCard from './ReportsHeroCard';
import ReportsCategoryStatusGrid from './ReportsCategoryStatusGrid';
import {
	SearchPerformancePanel,
	AiVisibilityPanel,
	SpeedPerformancePanel,
} from './ReportsInsightPanels';
import {
	SecurityPerformancePanel,
	ContentProgressPanel,
	StorePerformancePanel,
} from './ReportsCategoryPanels';
import WhatHappenedThisMonth from './WhatHappenedThisMonth';
import NextPrioritiesList from './NextPrioritiesList';
import ScheduleReportBanner from './ScheduleReportBanner';
import WebsiteProgressChart from './WebsiteProgressChart';
import ReportTypeCards from './ReportTypeCards';
import RecentAchievementsCard from './RecentAchievementsCard';
import AiAnalystCard from './AiAnalystCard';
import { useReportsOverview, DAY_OPTIONS } from './reportsOverview';
import './Reports.scss';

/**
 * "Reports"'s Overview tab — rebuilt to match the reference mockup: a
 * date-range + action header, a real "Fixed/New/Still need attention"
 * hero with real highlight rows, a 7-tile per-category status grid, two
 * 3-column insight rows (Search Performance/AI Visibility/Website Speed,
 * then Security/Content Progress/Store Performance), a real activity
 * timeline, a real "next priorities" list, and a closing schedule-a-report
 * banner. Every number comes from one shared fetch,
 * `GET /reports-overview?days=N` (Controllers\ReportsOverview.php) — see
 * that controller's own docblock for exactly how each section's real data
 * is computed and which mockup numbers (Search Console-style search
 * metrics) have no real backing anywhere in this codebase and were
 * honestly substituted rather than fabricated.
 *
 * The previous version of this tab's own real, but structurally
 * different, cards (WebsiteProgressChart's overall_score trend,
 * ReportTypeCards' per-report-type mini cards, RecentAchievementsCard,
 * AiAnalystCard) aren't part of the new mockup's own layout, but their
 * data is still real and otherwise unrepresented here — kept, appended
 * below the new mockup-matched sections, rather than deleted. The old
 * ReportsHeroCard.tsx/CategoryScoresGrid.tsx *are* fully superseded by
 * this pass's own hero/category-grid (same underlying `category_scores`
 * concept, now with real deltas/status) — those two were rewritten in
 * place rather than kept alongside a near-duplicate.
 */
const OverviewTab = () => {
	const [days, setDays] = useState<number>(DAY_OPTIONS[1]);
	const { data, isLoading } = useReportsOverview(days);

	return (
		<ColumnComponent>
			<ReportsOverviewHeader
				days={days}
				onDaysChange={setDays}
				period={data?.period ?? null}
			/>
			<ReportsHeroCard
				summary={data?.summary ?? null}
				highlights={data?.highlights ?? []}
				isLoading={isLoading}
			/>
			<ReportsCategoryStatusGrid
				categories={data?.categories ?? []}
				isLoading={isLoading}
			/>
			<div className="reports-panel-row">
				<SearchPerformancePanel
					panel={data?.seo_summary ?? null}
					isLoading={isLoading}
				/>
				<AiVisibilityPanel
					checks={data?.ai_visibility_summary.checks ?? []}
					isLoading={isLoading}
				/>
				<SpeedPerformancePanel
					speed={data?.speed_summary ?? null}
					isLoading={isLoading}
				/>
			</div>
			<div className="reports-panel-row">
				<SecurityPerformancePanel
					panel={data?.security_summary ?? null}
					isLoading={isLoading}
				/>
				<ContentProgressPanel
					content={data?.content_summary ?? null}
					isLoading={isLoading}
				/>
				<StorePerformancePanel
					store={data?.store_summary ?? null}
					isLoading={isLoading}
				/>
			</div>
			<WhatHappenedThisMonth />
			<NextPrioritiesList
				priorities={data?.next_priorities ?? []}
				isLoading={isLoading}
			/>
			<ScheduleReportBanner />

			<WebsiteProgressChart />
			<ReportTypeCards />
			<div className="reports-legacy-row">
				<ColumnComponent grid={6}>
					<RecentAchievementsCard />
				</ColumnComponent>
				<ColumnComponent grid={6}>
					<AiAnalystCard />
				</ColumnComponent>
			</div>
		</ColumnComponent>
	);
};

export default OverviewTab;
