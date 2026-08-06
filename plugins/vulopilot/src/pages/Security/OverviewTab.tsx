import React from 'react';
import { ColumnComponent, ContainerComponent } from '@zyra/components';
import VulnerabilityHeroCard from './VulnerabilityHeroCard';
import SecurityMetricsGrid from './SecurityMetricsGrid';
import VulnerabilitiesFoundCard from './VulnerabilitiesFoundCard';
import SecurityOverviewCard from './SecurityOverviewCard';
import SecurityTrendCard from './SecurityTrendCard';
import SecurityStatusCard from './SecurityStatusCard';
import LiveThreatMonitorCard from './LiveThreatMonitorCard';
import RecentActivityCard from './RecentActivityCard';
import './ProtectMySite.scss';

interface OverviewTabProps {
	onNavigateToSecurityTab: () => void;
}

/**
 * "Protect My Site"'s new default tab — see this folder's sibling files
 * for the per-section real-data mapping (VulnerabilityHeroCard,
 * SecurityMetricsGrid, VulnerabilitiesFoundCard, SecurityOverviewCard,
 * SecurityTrendCard, SecurityStatusCard, LiveThreatMonitorCard,
 * RecentActivityCard — each documents its own data source and, where the
 * mockup shows something with no real backend, its honest fallback).
 */
const OverviewTab: React.FC<OverviewTabProps> = ({
	onNavigateToSecurityTab,
}) => {
	return (
		<ContainerComponent general>
			<ColumnComponent grid={8}>
				<VulnerabilityHeroCard
					onNavigateToSecurityTab={onNavigateToSecurityTab}
				/>

				<SecurityMetricsGrid />

				<ContainerComponent>
					<VulnerabilitiesFoundCard
						onNavigateToSecurityTab={onNavigateToSecurityTab}
					/>
					<ColumnComponent grid={6}>
						<SecurityOverviewCard />
					</ColumnComponent>
				</ContainerComponent>

				<SecurityTrendCard />
			</ColumnComponent>

			<ColumnComponent grid={4}>
				<SecurityStatusCard />
				<LiveThreatMonitorCard />
				<RecentActivityCard />
			</ColumnComponent>
		</ContainerComponent>
	);
};

export default OverviewTab;
