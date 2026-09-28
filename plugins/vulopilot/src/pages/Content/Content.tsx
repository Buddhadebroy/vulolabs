import { __ } from '@wordpress/i18n';
import { ColumnComponent, ContainerComponent, NavigatorHeaderComponent } from '@zyra/components';
import RunScanHeaderExtra from '../../components/RunScanHeaderExtra';
import ContentToolsGrid from './ContentToolsGrid';
import ContentStatsCard from './ContentStatsCard';
import RecentContentCard from './RecentContentCard';
import QuickActionsCard from './QuickActionsCard';
import AiContentAssistantSidebar from './AiContentAssistantSidebar';
import './CreateContent.scss';

/**
 * "Content" (WP menu slug `content`) - used to be a tab shell over Overview (formerly its own
 * OverviewTab.tsx, inlined here - it had exactly one consumer, this file).
 */
const Content = () => {
	return (
		<>
			<NavigatorHeaderComponent
				headerIcon="image"
				headerTitle={__('Content', 'vulopilot')}
				headerDescription={__(
					'AI-powered tools to help you create, optimize and rank content that drives traffic and engagement.',
					'vulopilot'
				)}
				headerCustomContent={
					<RunScanHeaderExtra
						categories={['content']}
						label={__('Run Content Audit', 'vulopilot')}
						settingsSubtab="seo-content"
					/>
				}
			/>
			<ContainerComponent general>
				<ColumnComponent grid={8}>
					<AiContentAssistantSidebar />
					<ContentToolsGrid />
				</ColumnComponent>
				<ColumnComponent grid={4}>
					<ContentStatsCard />
					<QuickActionsCard />
				</ColumnComponent>

				<ColumnComponent >
					<RecentContentCard />
				</ColumnComponent>
			</ContainerComponent>
		</>
	);
};

export default Content;
