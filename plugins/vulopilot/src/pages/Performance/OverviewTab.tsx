import React from 'react';
import { ColumnComponent, ContainerComponent } from '@zyra/components';
import PerformanceScoreCard from './PerformanceScoreCard';
import SpeedBoostCard from './SpeedBoostCard';
import MetricsGrid from './MetricsGrid';
import TopIssuesCard from './TopIssuesCard';
import SpeedHistoryCard from './SpeedHistoryCard';
import QuickActionsCard from './QuickActionsCard';
import RealTimeMonitoringCard from './RealTimeMonitoringCard';
import PerformanceTipsCard from './PerformanceTipsCard';
import AiSpeedAssistantCard from './AiSpeedAssistantCard';
import './ImproveSpeed.scss';

interface OverviewTabProps {
	onNavigateToPerformanceTab: () => void;
}

/**
 * "Improve Speed"'s new default tab — see this folder's sibling files
 * for the per-section real-data mapping (PerformanceScoreCard,
 * SpeedBoostCard, MetricsGrid, TopIssuesCard, SpeedHistoryCard,
 * QuickActionsCard, RealTimeMonitoringCard, PerformanceTipsCard,
 * AiSpeedAssistantCard — each documents its own data source and, where
 * the mockup shows something with no real backend, its honest
 * fallback).
 */
const OverviewTab: React.FC<OverviewTabProps> = ({
	onNavigateToPerformanceTab,
}) => {
	return (
		<>
			<ContainerComponent general>
				<ColumnComponent grid={8}>
					<ContainerComponent>
						<ColumnComponent grid={6}>
							<PerformanceScoreCard />
						</ColumnComponent>
						<ColumnComponent grid={6}>
							<SpeedBoostCard
								onNavigateToPerformanceTab={onNavigateToPerformanceTab}
							/>
						</ColumnComponent>
					</ContainerComponent>

					<MetricsGrid />

					<ContainerComponent>
						<TopIssuesCard
							onNavigateToPerformanceTab={onNavigateToPerformanceTab}
						/>
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
		</>
	);
};

export default OverviewTab;
