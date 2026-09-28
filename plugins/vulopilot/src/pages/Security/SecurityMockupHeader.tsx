import { ColumnComponent, ContainerComponent } from '@zyra/components';
import type { SectionedIssuesTab } from './SectionedIssuesTable';
import SecurityStatusCard from './SecurityStatusCard';
import RecentActivityCard from './RecentActivityCard';
import SecurityTrendCard from './SecurityTrendCard';

interface SecurityMockupHeaderProps {
	/** Forwarded to SecurityMetricsGrid.tsx's own scanner-backed tiles' "View" buttons. */
	 
	// eslint-disable-next-line no-unused-vars
	onViewSection: (tab: SectionedIssuesTab) => void;
}

/**
 * RecentActivityCard/SecurityTrendCard (real daily score history, its own dedicated table - see
 * that component's own docblock) stack directly below SecurityStatusCard in this same grid={4}
 * sidebar column rather than living in SecurityTab.tsx as a standalone row.
 */
const SecurityMockupHeader = ({
	onViewSection,
}: SecurityMockupHeaderProps) => {

	return (
		<ContainerComponent>
			<ColumnComponent grid={7} fullHeight>
				<SecurityStatusCard onViewSection={onViewSection} />
			</ColumnComponent>
			<ColumnComponent grid={5} fullHeight>
				<SecurityTrendCard />
			</ColumnComponent>

			<ColumnComponent fullHeight>
				<RecentActivityCard />
			</ColumnComponent>
		</ContainerComponent>
	);
};

export default SecurityMockupHeader;
