import { __ } from '@wordpress/i18n';
import { NavigatorHeaderComponent } from '@zyra/components';
import OverviewTab from './OverviewTab';

/**
 * "Create Content" (WP menu slug `content`) — used to be a tab shell over
 * Overview (OverviewTab.tsx) and "AI Content" (AiContentTab.tsx, moved
 * here from "Grow My Traffic"). AI Content's one real section — the
 * "Open Issues" glimpse — has since moved onto Overview itself
 * (ContentOpenIssuesCard.tsx) and the tab was removed; with only one view
 * left, this collapsed from a `TabsComponent` shell down to a plain
 * header + single body, same as any other single-view admin page in this
 * codebase — a tab bar with exactly one, permanently-active tab isn't
 * real navigation.
 */
const Content = () => {
	return (
		<>
			<NavigatorHeaderComponent
				headerIcon="image"
				headerTitle={__('Create Content', 'vulopilot')}
				headerDescription={__(
					'AI-powered tools to help you create, optimize and rank content that drives traffic and engagement.',
					'vulopilot'
				)}
				buttons={[
					{
						label: __('Content Settings', 'vulopilot'),
						icon: 'setting',
						onClick: () => {
							window.location.href =
								'?page=vulopilot#&tab=settings';
						},
					},
				]}
			/>
			<OverviewTab />
		</>
	);
};

export default Content;
