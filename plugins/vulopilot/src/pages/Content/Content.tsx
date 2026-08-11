import { __ } from '@wordpress/i18n';
import { NavigatorHeaderComponent } from '@zyra/components';
import OverviewTab from './OverviewTab';

/**
 * "Create Content" (WP menu slug `content`) — used to be a tab shell over
 * Overview (OverviewTab.tsx), "AI Content" (AiContentTab.tsx, moved here
 * from "Grow My Traffic"), and later a standalone "Content Quality
 * Issues" card (ContentOpenIssuesCard.tsx) once AI Content was removed.
 * That card's own real data — each post's open content-quality findings,
 * with real Fix with AI/Resolve/Ignore/Review actions — is now shown
 * directly inside RecentContentCard.tsx's own rows instead of a separate
 * card pointing elsewhere, so there's only ever been one real view left:
 * this collapsed from a `TabsComponent` shell down to a plain header +
 * single body, same as any other single-view admin page in this codebase
 * — a tab bar with exactly one, permanently-active tab isn't real
 * navigation.
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
