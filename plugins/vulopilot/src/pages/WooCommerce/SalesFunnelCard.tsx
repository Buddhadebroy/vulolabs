import { Fragment } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { CardComponent } from '@zyra/components';
import type { FindingGroup } from '../AIAssistant/issuesTypes';
import { sumGroupCounts } from './useWooCommerceFindingGroups';
import { PRODUCT_SCANNER_IDS } from './WooCommerceTab.constants';
import type { WooCommerceIssueTab } from './WooCommerceIssuesTable';

interface FunnelStage {
	id: string;
	label: string;
	icon: string;
	/** null = no real tracking exists anywhere in this codebase for this stage. */
	count: number | null;
	statusGood: string;
	statusBad: (count: number) => string;
	tab: WooCommerceIssueTab;
	concernTitle: string;
	concernDesc: string;
}

interface SalesFunnelCardProps {
	groups: FindingGroup[];
	isLoading: boolean;
	onReviewTab: (tab: WooCommerceIssueTab) => void;
}

/**
 * "Where are sales getting stuck?" — a 5-stage funnel (Products → Cart →
 * Checkout → Payment → Orders) reusing the same real `groups`
 * (`GET /findings/groups?category=woocommerce`) this whole tab already
 * fetches once (`useWooCommerceFindingGroups()` in WooCommerceTab.tsx),
 * bucketed via the same `WooCommerceTab.constants.ts` scanner_id groups
 * WooCommerceIssuesTable.tsx's own tab counts already use — so a stage's
 * number here always reconciles with that tab's count. Cart has no real
 * tracking anywhere in vulopilot/vulopilot-pro (same audit
 * WooCommerceCategoryGrid.tsx's own `NOT_TRACKED_TILES` already documents
 * for this exact stage) — shown as an honest "Not tracked yet" stage
 * rather than a fabricated "clear", unlike every other stage which is
 * real. "Biggest concern" surfaces whichever *tracked* stage has the
 * highest real count; hidden entirely when every tracked stage is
 * genuinely at zero, same "no fabricated good state" rule
 * StoreHealthBanner.tsx already follows.
 */
const SalesFunnelCard = ({ groups, isLoading, onReviewTab }: SalesFunnelCardProps) => {
	const productsCount = sumGroupCounts(groups, PRODUCT_SCANNER_IDS);
	const checkoutCount = sumGroupCounts(groups, ['woocommerce-checkout']);
	const paymentCount = sumGroupCounts(groups, ['woocommerce-failed-orders']);
	const ordersCount = sumGroupCounts(groups, [
		'woocommerce-stale-onhold-orders',
		'woocommerce-stale-pending-orders',
	]);

	const stages: FunnelStage[] = [
		{
			id: 'products',
			label: __('Products', 'vulopilot'),
			icon: 'cart',
			count: productsCount,
			statusGood: __('clear', 'vulopilot'),
			statusBad: (count) =>
				sprintf(
					/* translators: %d is the number of products needing attention. */
					__('%d need attention', 'vulopilot'),
					count
				),
			tab: 'products',
			concernTitle: __('Product availability', 'vulopilot'),
			concernDesc: __(
				'Most detected sales blockers happen before customers reach checkout.',
				'vulopilot'
			),
		},
		{
			id: 'cart',
			label: __('Cart', 'vulopilot'),
			icon: 'cart',
			count: null,
			statusGood: __('clear', 'vulopilot'),
			statusBad: () => '',
			tab: 'checkout',
			concernTitle: '',
			concernDesc: '',
		},
		{
			id: 'checkout',
			label: __('Checkout', 'vulopilot'),
			icon: 'cash',
			count: checkoutCount,
			statusGood: __('clear', 'vulopilot'),
			statusBad: (count) =>
				sprintf(
					/* translators: %d is the number of open checkout issues. */
					__('%d issues', 'vulopilot'),
					count
				),
			tab: 'checkout',
			concernTitle: __('Checkout friction', 'vulopilot'),
			concernDesc: __(
				'Checkout is in test mode or has open issues that can stop customers before they can pay.',
				'vulopilot'
			),
		},
		{
			id: 'payment',
			label: __('Payment', 'vulopilot'),
			icon: 'price',
			count: paymentCount,
			statusGood: __('no failures', 'vulopilot'),
			statusBad: (count) =>
				sprintf(
					/* translators: %d is the number of failed orders. */
					__('%d failed', 'vulopilot'),
					count
				),
			tab: 'checkout',
			concernTitle: __('Failed payments', 'vulopilot'),
			concernDesc: __(
				'Orders are failing at payment — check your gateway configuration.',
				'vulopilot'
			),
		},
		{
			id: 'orders',
			label: __('Orders', 'vulopilot'),
			icon: 'order',
			count: ordersCount,
			statusGood: __('healthy', 'vulopilot'),
			statusBad: (count) =>
				sprintf(
					/* translators: %d is the number of orders needing attention. */
					__('%d need attention', 'vulopilot'),
					count
				),
			tab: 'checkout',
			concernTitle: __('Stalled orders', 'vulopilot'),
			concernDesc: __(
				'Orders are stuck on hold or pending too long — customers may be waiting on you.',
				'vulopilot'
			),
		},
	];

	const biggestConcern = stages
		.filter((stage): stage is FunnelStage & { count: number } => null !== stage.count)
		.reduce<(FunnelStage & { count: number }) | null>(
			(worst, stage) =>
				stage.count > 0 && (!worst || stage.count > worst.count) ? stage : worst,
			null
		);

	if (isLoading) {
		return null;
	}

	return (
		<CardComponent
			className="woocommerce-sales-funnel"
			titleIcon="bar-chart"
			title={__('Where are sales getting stuck?', 'vulopilot')}
		>
			<div className="woocommerce-sales-funnel-stages">
				{stages.map((stage, index) => (
					<Fragment key={stage.id}>
						<div className="woocommerce-sales-funnel-stage">
							<span
								className={`woocommerce-sales-funnel-icon ${
									null === stage.count
										? 'is-unknown'
										: stage.count > 0
											? 'is-warning'
											: 'is-good'
								}`}
							>
								<i className={`adminfont-${stage.icon}`} />
							</span>
							<div className="woocommerce-sales-funnel-label">
								{stage.label}
							</div>
							<div
								className={`woocommerce-sales-funnel-status ${
									null === stage.count
										? 'is-unknown'
										: stage.count > 0
											? 'is-warning'
											: 'is-good'
								}`}
							>
								{null === stage.count && (
									<i className="adminfont-error" />
								)}
								{null === stage.count
									? __('Not tracked yet', 'vulopilot')
									: stage.count > 0
										? stage.statusBad(stage.count)
										: stage.statusGood}
							</div>
						</div>
						{index < stages.length - 1 && (
							<i className="adminfont-arrow-right woocommerce-sales-funnel-arrow" />
						)}
					</Fragment>
				))}
			</div>
			{biggestConcern && (
				<div className="woocommerce-sales-funnel-concern">
					<div className="woocommerce-sales-funnel-concern-title">
						{sprintf(
							/* translators: %s is the name of the funnel stage with the most open issues. */
							__('Biggest concern: %s', 'vulopilot'),
							biggestConcern.concernTitle
						)}
					</div>
					<div className="desc">{biggestConcern.concernDesc}</div>
					<span
						className="woocommerce-category-link"
						role="button"
						tabIndex={0}
						onClick={() => onReviewTab(biggestConcern.tab)}
					>
						{__('See WooCommerce details →', 'vulopilot')}
					</span>
				</div>
			)}
		</CardComponent>
	);
};

export default SalesFunnelCard;
