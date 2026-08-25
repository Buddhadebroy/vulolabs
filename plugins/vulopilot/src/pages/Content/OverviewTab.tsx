import React from 'react';
import { ColumnComponent, ContainerComponent } from '@zyra/components';
import ContentToolsGrid from './ContentToolsGrid';
import ContentStatsCard from './ContentStatsCard';
import RecentContentCard from './RecentContentCard';
import ContentQualityCard from './ContentQualityCard';
import QuickActionsCard from './QuickActionsCard';
import AiContentAssistantSidebar from './AiContentAssistantSidebar';
import './CreateContent.scss';

/**
 * "Create Content"'s new default tab — see this folder's sibling files
 * for the per-section real-data mapping (ContentToolsGrid, ContentQualityCard,
 * ContentStatsCard, RecentContentCard, AiContentAssistantSidebar — each
 * documents its own data source and, where the mockup shows something
 * with no real backend, its honest fallback).
 *
 * There's no separate "Content Quality Issues" card here — that section
 * (formerly ContentOpenIssuesCard.tsx) was merged directly into
 * RecentContentCard.tsx, which now shows each post's own real open
 * content-quality findings (with real Fix with AI/Resolve/Ignore/Review
 * actions) inline in its own row, rather than a second, separate glimpse
 * card pointing elsewhere. See that file's own docblock.
 */
const OverviewTab: React.FC = () => {
	return (
		<ContainerComponent general>
			<ColumnComponent grid={8}>
				<AiContentAssistantSidebar />
				<ContentToolsGrid />
				<ContentQualityCard />
			</ColumnComponent>
			<ColumnComponent grid={4}>
				<ContentStatsCard />
				<QuickActionsCard />
			</ColumnComponent>

			<ColumnComponent >
				<RecentContentCard />
			</ColumnComponent>
		</ContainerComponent>
	);
};

export default OverviewTab;
