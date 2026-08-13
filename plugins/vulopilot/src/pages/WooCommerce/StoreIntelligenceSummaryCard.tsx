import { __, sprintf, _n } from '@wordpress/i18n';
import { CardComponent, ModuleGuardComponent } from '@zyra/components';
import { useSalesInsights } from '../../services/useSalesInsights';
import { useSectionStatus } from '../../services/useSectionStatus';
import type { WooCommerceIssueTab } from './WooCommerceIssuesTable';

interface StoreIntelligenceSummaryCardProps {
	onExploreInsights: () => void;
	onReviewTab: (tab: WooCommerceIssueTab) => void;
	onFindOpportunities: () => void;
}

interface NoticedRow {
	id: string;
	icon: string;
	color: 'orange' | 'green' | 'red' | 'blue';
	title: string;
	desc: string;
	linkText: string;
	onClick: () => void;
}

/**
 * "Store Intelligence" — real per-signal rows from `GET /sales-insights`
 * (Pro's WooCommerceIntelligence module) plus the existing real
 * `inventory-intelligence` open-finding count (useSectionStatus, same
 * hook other cards on this page already use for that exact number).
 * Merges what used to be two near-duplicate presentations of this same
 * real data (a plain bulleted list here, plus a differently-styled
 * "VuloPilot noticed" row-list mockup) into one: each real signal is now
 * a row with its own icon and its own specific "Review →" deep link,
 * rather than one bullet + one generic button. Every link reuses
 * navigation this page's other cards already wire up — stock/stale
 * products go to the Issues table's "Products" tab (same destination
 * WooCommerceCategoryGrid.tsx's own Inventory/Products cards use),
 * payment failures go to its "Checkout" tab (same as the Checkout &
 * Payments card), and the cross-sell pair goes to the "Bulk AI
 * optimization" panel (same `onFindOpportunities` destination
 * AiSalesOptimizerCard.tsx already uses for cross-sell/upsell/bundle
 * actions) — no new destination invented for any row. The locked state
 * (Pro/module inactive) is unchanged.
 */
const StoreIntelligenceSummaryCard = ({
	onExploreInsights,
	onReviewTab,
	onFindOpportunities,
}: StoreIntelligenceSummaryCardProps) => {
	const { data, isLoading } = useSalesInsights();
	const stockoutRisk = useSectionStatus('woocommerce', ['inventory-intelligence']);

	const rows: NoticedRow[] = [];

	if (stockoutRisk.badge && !stockoutRisk.isLoading) {
		const match = stockoutRisk.badge.text.match(/^(\d+)/);
		const count = match ? parseInt(match[1], 10) : 0;

		if (count > 0) {
			rows.push({
				id: 'stockout',
				icon: 'database',
				color: 'orange',
				title: __('Popular product may run out soon', 'vulopilot'),
				desc: sprintf(
					/* translators: %d is the number of products projected to run out of stock soon. */
					_n(
						'%d product has only a few left in stock.',
						'%d products have only a few left in stock.',
						count,
						'vulopilot'
					),
					count
				),
				linkText: __('Review stock →', 'vulopilot'),
				onClick: () => onReviewTab('products'),
			});
		}
	}

	if (data?.bundle_top_pair) {
		rows.push({
			id: 'bundle',
			icon: 'link',
			color: 'green',
			title: __('Customers often buy these together', 'vulopilot'),
			desc: sprintf(
				/* translators: 1: first product name, 2: second product name. */
				__('%1$s + %2$s', 'vulopilot'),
				data.bundle_top_pair.product_a,
				data.bundle_top_pair.product_b
			),
			linkText: __('Create cross-sell →', 'vulopilot'),
			onClick: onFindOpportunities,
		});
	}

	if (data && data.frequent_payment_failure_count > 0) {
		rows.push({
			id: 'payment-failures',
			icon: 'cash',
			color: 'red',
			title: sprintf(
				/* translators: %d is the number of products with repeated payment failures. */
				_n(
					'%d recent purchase failed',
					'%d recent purchases failed',
					data.frequent_payment_failure_count,
					'vulopilot'
				),
				data.frequent_payment_failure_count
			),
			desc: __('Worth checking before more are lost.', 'vulopilot'),
			linkText: __('Review payments →', 'vulopilot'),
			onClick: () => onReviewTab('checkout'),
		});
	}

	if (data && data.stale_products_count > 0) {
		rows.push({
			id: 'stale-products',
			icon: 'bar-chart',
			color: 'blue',
			title: sprintf(
				/* translators: %d is the number of products with no recent sales. */
				_n(
					"%d product hasn't sold recently",
					"%d products haven't sold recently",
					data.stale_products_count,
					'vulopilot'
				),
				data.stale_products_count
			),
			desc: __('Consider reviewing their offer.', 'vulopilot'),
			linkText: __('Review products →', 'vulopilot'),
			onClick: () => onReviewTab('products'),
		});
	}

	return (
		<CardComponent
			className="store-intelligence-summary-card"
			titleIcon="ai"
			title={__('Store Intelligence', 'vulopilot')}
			badges={[{ text: __('PRO', 'vulopilot'), color: 'purple' }]}
			isLoading={isLoading}
		>
			{!isLoading && !data && (
				<ModuleGuardComponent
					icon="lock"
					title={__('Unlock Store Intelligence', 'vulopilot')}
					desc={__(
						'Enable the WooCommerce Intelligence module for real patterns worth acting on — stockout risk, co-purchase trends, and payment-failure hotspots.',
						'vulopilot'
					)}
					buttonText={__('Learn more', 'vulopilot')}
					onButtonClick={onExploreInsights}
				/>
			)}
			{!isLoading && data && (
				<>
					<div className="desc">
						{__(
							'VuloPilot looks at your store data to find patterns worth acting on.',
							'vulopilot'
						)}
					</div>
					{0 === rows.length ? (
						<div className="desc">
							{__(
								'No notable patterns right now — check back as more orders come in.',
								'vulopilot'
							)}
						</div>
					) : (
						<div className="store-intelligence-noticed-list">
							{rows.map((row) => (
								<div className="store-intelligence-noticed-row" key={row.id}>
									<span
										className={`store-intelligence-noticed-icon ${row.color}`}
									>
										<i className={`adminfont-${row.icon}`} />
									</span>
									<div className="store-intelligence-noticed-body">
										<div className="store-intelligence-noticed-title">
											{row.title}
										</div>
										<div className="desc">{row.desc}</div>
									</div>
									<span
										className="store-intelligence-noticed-link"
										role="button"
										tabIndex={0}
										onClick={row.onClick}
									>
										{row.linkText}
									</span>
								</div>
							))}
						</div>
					)}
				</>
			)}
		</CardComponent>
	);
};

export default StoreIntelligenceSummaryCard;
