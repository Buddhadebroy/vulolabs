import { useState } from 'react';
import ReportsOverviewHeader from './ReportsOverviewHeader';
import RecentReportsCard from './RecentReportsCard';
import ScheduledReportsTable from './ScheduledReportsTable';
import ReportHistoryTable from './ReportHistoryTable';
import { ContainerComponent} from '@zyra/components';
import { DAY_OPTIONS } from './reportsOverview';
import './Reports.scss';

/**
 * "Reports"'s Overview tab - rebuilt to match the reference mockup exactly: a title/desc/date-
 * range/action header (ReportsOverviewHeader.tsx).
 */
const OverviewTab = () => {
	const [days, setDays] = useState<number>(DAY_OPTIONS[1]);
	const [refreshKey, setRefreshKey] = useState(0);

	return (
		<ContainerComponent>
			<ReportsOverviewHeader
				days={days}
				onDaysChange={setDays}
				onDataChanged={() => setRefreshKey((key) => key + 1)}
			/>
			<RecentReportsCard days={days} refreshSignal={refreshKey} />
			<ScheduledReportsTable refreshSignal={refreshKey} />
			<ReportHistoryTable refreshSignal={refreshKey} />
		</ContainerComponent>
	);
};

export default OverviewTab;
