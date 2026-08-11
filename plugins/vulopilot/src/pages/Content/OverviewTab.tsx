import React from 'react';
import { ColumnComponent, ContainerComponent } from '@zyra/components';
import ContentToolsGrid from './ContentToolsGrid';
import QuickStartCard from './QuickStartCard';
import ContentStatsCard from './ContentStatsCard';
import RecentContentCard from './RecentContentCard';
import ContentScoreCard from './ContentScoreCard';
import ContentOpenIssuesCard from './ContentOpenIssuesCard';
import AiContentAssistantSidebar from './AiContentAssistantSidebar';
import './CreateContent.scss';

/**
 * "Create Content"'s new default tab — see this folder's sibling files
 * for the per-section real-data mapping (ContentToolsGrid, QuickStartCard,
 * ContentStatsCard, RecentContentCard, ContentOpenIssuesCard,
 * AiContentAssistantSidebar — each documents its own data source and,
 * where the mockup shows something with no real backend, its honest
 * fallback).
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

			{/*
			 * ContentOpenIssuesCard owns its own `ColumnComponent grid={6}`
			 * internally (OpenIssuesGlimpse's own shape) — paired here with
			 * ContentStatsCard in an explicit grid={6} column to fill the
			 * row, same "glimpse card + adjacent stats card share a 12-wide
			 * row" pattern GEO's OverviewTab (VisibilityScoreCard +
			 * AiOpportunitiesCard) and Security's OverviewTab
			 * (SecurityOverviewCard + VulnerabilitiesFoundCard) already use.
			 */}
			<ContainerComponent general>
				<ColumnComponent grid={6}>
					<ContentStatsCard />
				</ColumnComponent>
				<ContentOpenIssuesCard />
			</ContainerComponent>
		</>
	);
};

export default OverviewTab;
