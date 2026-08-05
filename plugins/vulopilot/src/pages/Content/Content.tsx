import { useState } from 'react';
import { __ } from '@wordpress/i18n';
import { useLocation } from 'react-router-dom';
import { NavigatorHeaderComponent, TabsComponent } from '@zyra/components';
import OverviewTab from './OverviewTab';
import ContentTab from './ContentTab';
import AiContentTab from './AiContentTab';

const TAB_IDS = ['overview', 'content', 'ai-content'] as const;

/**
 * "Create Content" (WP menu slug `content`) — a tab shell over three
 * views: the mockup's new Overview (OverviewTab.tsx), today's real
 * Content Intelligence scanner (ContentTab.tsx, kept rather than dropped
 * — same "keep the real page, add the new mockup alongside it" move
 * `GEO.tsx` made for its own Overview/GEO/AEO split), and "AI Content"
 * (AiContentTab.tsx), moved here from "Grow My Traffic" — see that
 * file's own docblock for what it covers. Same shape as `GEO.tsx`'s tab
 * shell: a constant header above `TabsComponent`, with the same `subtab`
 * deep-link convention `StatusAndTools.tsx`/`GEO.tsx` already established
 * (`?page=vulopilot#&tab=content&subtab=<inner-tab>`).
 */
const Content = () => {
	const subtab = new URLSearchParams(useLocation().hash.substring(1)).get(
		'subtab'
	);
	const initialTab = (
		subtab && (TAB_IDS as readonly string[]).includes(subtab)
			? subtab
			: 'overview'
	) as (typeof TAB_IDS)[number];

	const [activeTab, setActiveTab] = useState<(typeof TAB_IDS)[number]>(
		initialTab
	);

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
			<TabsComponent
				className="create-content-tabs"
				activeIndex={TAB_IDS.indexOf(activeTab)}
				onTabChange={(index) => setActiveTab(TAB_IDS[index])}
				tabs={[
					{
						label: __('Overview', 'vulopilot'),
						content: <OverviewTab />,
					},
					{
						label: __('Content', 'vulopilot'),
						content: <ContentTab />,
					},
					{
						label: __('AI Content', 'vulopilot'),
						content: <AiContentTab />,
					},
				]}
			/>
		</>
	);
};

export default Content;
