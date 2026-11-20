import { __ } from '@wordpress/i18n';
import { ColumnComponent, ContainerComponent, NavigatorHeaderComponent } from '@zyra/components';
import RunScanHeaderExtra from '../../components/RunScanHeaderExtra';
import ContentStatsCard from './ContentStatsCard';
import ContentAssistant from './ContentAssistant';
import ContentToolsGrid from './ContentToolsGrid';
import RecentContentCard from './RecentContentCard';
import '../../dashboard-widgets/dashboard.scss';
import '../AIAssistant/copilot.scss';
import './CreateContent.scss';

/**
 * Content: what VuloPilot wrote for you and what the content audit found, the writing assistant, the AI writing
 * tools (free's own, plus VuloPilot Pro's when its Content Optimization module is on), and every page's content
 * health.
 */
const Content = () => (
	<>
		<NavigatorHeaderComponent
			headerIcon="image"
			headerTitle={__('Content', 'vulopilot')}
			headerDescription={__('Write new content with AI and keep what you have readable, complete and easy to find.', 'vulopilot')}
			headerCustomContent={
				<RunScanHeaderExtra categories={['content']} label={__('Run content audit', 'vulopilot')} settingsSubtab="seo-content" />
			}
		/>
		<ContainerComponent general>
			<ColumnComponent>
				<div className="vp-page vp-content">
					<ContentStatsCard />
					<ContentAssistant />
					<ContentToolsGrid />
				</div>
			</ColumnComponent>
			<ColumnComponent>
				<RecentContentCard />
			</ColumnComponent>
		</ContainerComponent>
	</>
);

export default Content;
