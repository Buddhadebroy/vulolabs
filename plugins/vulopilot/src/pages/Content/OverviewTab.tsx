import React from 'react';
import { ColumnComponent, ContainerComponent } from '@zyra/components';
import ContentToolsGrid from './ContentToolsGrid';
import QuickStartCard from './QuickStartCard';
import ContentStatsCard from './ContentStatsCard';
import RecentContentCard from './RecentContentCard';
import ContentScoreCard from './ContentScoreCard';
import AiContentAssistantSidebar from './AiContentAssistantSidebar';
import './CreateContent.scss';

/**
 * "Create Content"'s new default tab — see this folder's sibling files
 * for the per-section real-data mapping (ContentToolsGrid, QuickStartCard,
 * ContentStatsCard, RecentContentCard, AiContentAssistantSidebar — each
 * documents its own data source and, where the mockup shows something
 * with no real backend, its honest fallback).
 */
const OverviewTab: React.FC = () => {
	return (
		<>
			<ContainerComponent general>
				<ColumnComponent grid={8}>
					<ContentToolsGrid />
				</ColumnComponent>
				<ColumnComponent grid={4}>
					<ContentScoreCard />
					<QuickStartCard />
					<ContentStatsCard />
				</ColumnComponent>
			</ContainerComponent>

			<ContainerComponent general>
				<ColumnComponent grid={8}>
					<RecentContentCard />
				</ColumnComponent>
				<ColumnComponent grid={4}>
					<AiContentAssistantSidebar />
				</ColumnComponent>
			</ContainerComponent>
		</>
	);
};

export default OverviewTab;
