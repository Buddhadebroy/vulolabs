import { __, sprintf } from '@wordpress/i18n';
import { CardComponent, ModuleGuardComponent } from '@zyra/components';
import { ButtonInput } from '@zyra/inputs';
import { useSalesInsights } from '../../services/useSalesInsights';
import { useSectionStatus } from '../../services/useSectionStatus';

interface StoreIntelligenceSummaryCardProps {
	onExploreInsights: () => void;
}

/**
 * "Store Intelligence" summary card — real bullets from `GET
 * /sales-insights` (Pro's WooCommerceIntelligence module) plus the
 * existing real `inventory-intelligence` open-finding count
 * (useSectionStatus, same hook other cards on this page already use for
 * that exact number). "Explore Store Insights →" scrolls down to the
 * existing, unchanged detailed "Store intelligence" panel further down
 * this page (revenue trend chart, stockout-risk table) — this card is a
 * real-data summary/entry point, not a second implementation of it.
 */
const StoreIntelligenceSummaryCard = ({
	onExploreInsights,
}: StoreIntelligenceSummaryCardProps) => {
	const { data, isLoading } = useSalesInsights();
	const stockoutRisk = useSectionStatus('woocommerce', ['inventory-intelligence']);

	const bullets: string[] = [];

	if (stockoutRisk.badge && !stockoutRisk.isLoading) {
		const match = stockoutRisk.badge.text.match(/^(\d+)/);
		const count = match ? parseInt(match[1], 10) : 0;

		if (count > 0) {
			bullets.push(
				sprintf(
					/* translators: %d is the number of products projected to run out of stock soon. */
					__('%d popular products may run out soon', 'vulopilot'),
					count
				)
			);
		}
	}

	if (data?.bundle_top_pair) {
		bullets.push(
			sprintf(
				/* translators: 1: first product name, 2: second product name. */
				__('Customers often buy %1$s and %2$s together', 'vulopilot'),
				data.bundle_top_pair.product_a,
				data.bundle_top_pair.product_b
			)
		);
	}

	if (data && data.frequent_payment_failure_count > 0) {
		bullets.push(
			sprintf(
				/* translators: %d is the number of products with repeated payment failures. */
				__('%d products receive orders but frequently fail payment', 'vulopilot'),
				data.frequent_payment_failure_count
			)
		);
	}

	if (data && data.stale_products_count > 0) {
		bullets.push(
			sprintf(
				/* translators: %d is the number of products with no recent sales. */
				__("%d products haven't sold recently", 'vulopilot'),
				data.stale_products_count
			)
		);
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
					{0 === bullets.length ? (
						<div className="desc">
							{__(
								'No notable patterns right now — check back as more orders come in.',
								'vulopilot'
							)}
						</div>
					) : (
						<ul className="store-intelligence-bullets">
							{bullets.map((bullet) => (
								<li key={bullet}>{bullet}</li>
							))}
						</ul>
					)}
					<ButtonInput
						buttons={{
							text: __('Explore Store Insights →', 'vulopilot'),
							onClick: onExploreInsights,
						}}
					/>
				</>
			)}
		</CardComponent>
	);
};

export default StoreIntelligenceSummaryCard;
