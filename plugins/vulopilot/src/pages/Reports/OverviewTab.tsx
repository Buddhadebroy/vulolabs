import ReportsOverviewHeader from './ReportsOverviewHeader';
import RecentReportsCard from './RecentReportsCard';
import ScheduledReportsTable from './ScheduledReportsTable';
import ReportHistoryTable from './ReportHistoryTable';
import { ContainerComponent} from '@zyra/components';
import './Reports.scss';

interface OverviewTabProps {
	days: number;
	refreshKey: number;
}

/**
 * "Reports"'s Overview tab - rebuilt to match the reference mockup exactly: a title/desc header
 * (ReportsOverviewHeader.tsx). `days`/`refreshKey` now come from Reports.tsx, which also drives
 * the page header's own "Last N days"/Create Report/Schedule Report/Download PDF row
 * (ReportsOverviewActions.tsx) - this tab just reads the same real state, not a second copy of it.
 */
const OverviewTab = ({ days, refreshKey }: OverviewTabProps) => {
	return (
		<ContainerComponent>
			<ReportsOverviewHeader />
			<RecentReportsCard days={days} refreshSignal={refreshKey} />
			<ScheduledReportsTable refreshSignal={refreshKey} />
			<ReportHistoryTable refreshSignal={refreshKey} />
		</ContainerComponent>
	);
};

export default OverviewTab;
