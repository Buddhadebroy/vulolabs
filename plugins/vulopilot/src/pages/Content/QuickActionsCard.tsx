import { __ } from '@wordpress/i18n';
import { CardComponent, ListComponent, NoticeManager } from '@zyra/components';
import { ButtonInput } from '@zyra/inputs';

/**
 * Content page's "Quick Actions" card — 4 shortcuts to real destinations
 * already on this same page or elsewhere in VuloPilot, not a separate
 * duplicated feature. Replaces the never-wired-in QuickStartCard.tsx (same
 * `mini-card list` shape, previously 4 shortcuts into ContentToolsGrid's
 * own tool popups — superseded here since 2 of these 4 rows need real
 * page navigation, not an in-page popup).
 *
 * - "AI Content Audit" scrolls to RecentContentCard (`#content-audit-section`,
 *   this same page) — the real audit: open thin-content/readability/
 *   heading-structure findings per post, with real Fix with AI actions.
 * - "Keyword Research" navigates to the real Keywords tab
 *   (SEO & Visibility → Keywords, Google Search Console-backed).
 * - "Content Templates" scrolls to ContentToolsGrid (`#content-tools-grid`,
 *   this same page) — the real 12 AI content-generation tools (Blog
 *   Generator, Product Descriptions, ...), the closest real equivalent to
 *   "templates" this codebase has.
 * - "Content Planner" (a content editorial calendar) has no real backend
 *   anywhere in this codebase (free or Pro) — rather than link to a
 *   fabricated destination, its row shows a "Coming soon" tag and a
 *   honest notice on click instead of a working arrow.
 */
const QuickActionsCard = () => {
	const scrollTo = (id: string) => {
		document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
	};

	const notifyComingSoon = () => {
		NoticeManager.add({
			uniqueKey: 'vulopilot-content-planner-coming-soon',
			type: 'info',
			position: 'float',
			message: __(
				'Content Planner is not available yet — check back in a future update.',
				'vulopilot'
			),
		});
	};

	return (
		<CardComponent title={__('Quick Actions', 'vulopilot')} titleIcon="ai">
			<ListComponent
				className="mini-card list"
				border
				items={[
					{
						id: 'content-audit',
						icon: 'lock',
						className: 'icon-purple',
						title: __('AI Content Audit', 'vulopilot'),
						desc: __('Scan and audit all your content', 'vulopilot'),
						tags: <i className="adminfont-arrow-right" />,
						action: () => scrollTo('content-audit-section'),
					},
					{
						id: 'keyword-research',
						icon: 'search',
						className: 'icon-blue',
						title: __('Keyword Research', 'vulopilot'),
						desc: __('Discover content opportunities', 'vulopilot'),
						tags: <i className="adminfont-arrow-right" />,
						action: () => {
							window.location.href =
								'?page=vulopilot#&tab=seo-visibility&subtab=keywords';
						},
					},
					{
						id: 'content-planner',
						icon: 'calendar',
						className: 'icon-blue',
						title: __('Content Planner', 'vulopilot'),
						desc: __('Plan and schedule content', 'vulopilot'),
						tags: (
							<span className="quick-actions-coming-soon">
								{__('Coming soon', 'vulopilot')}
							</span>
						),
						action: notifyComingSoon,
					},
					{
						id: 'content-templates',
						icon: 'document',
						className: 'icon-orange',
						title: __('Content Templates', 'vulopilot'),
						desc: __('Use proven content templates', 'vulopilot'),
						tags: <i className="adminfont-arrow-right" />,
						action: () => scrollTo('content-tools-grid'),
					},
				]}
			/>
			<ButtonInput
				wrapperClass="quick-actions-view-all"
				buttons={{
					text: __('View all tools', 'vulopilot'),
					rightIcon: 'arrow-right',
					color: 'purple-bg',
					onClick: () => scrollTo('content-tools-grid'),
				}}
			/>
		</CardComponent>
	);
};

export default QuickActionsCard;
