import { __, sprintf, _n } from '@wordpress/i18n';
import { ButtonInput } from '@zyra/inputs';
import { useApiList } from '../../services/useApiList';

interface FindingRow {
	id: number;
}

interface StoreHealthBannerProps {
	onReviewIssues: () => void;
	onViewSummary: () => void;
}

/**
 * "Sell More" WooCommerce tab's top attention banner — real open-finding
 * total for category 'woocommerce' (same `GET /findings` count every
 * other real-data banner this session reads), covering every scanner
 * feeding this page's issues table (the 12 existing Product* scanners +
 * the 5 new Checkout/Order-health/Compatibility scanners +
 * WooCommerceScanner's own store-setup checks). "All caught up" when
 * that total is genuinely 0 — never a fabricated "Good" state.
 */
const StoreHealthBanner = ({
	onReviewIssues,
	onViewSummary,
}: StoreHealthBannerProps) => {
	const { total, isLoading } = useApiList<FindingRow>('findings', {
		category: 'woocommerce',
		status: 'open',
		per_page: 1,
	});

	const isHealthy = !isLoading && total === 0;

	return (
		<div
			className={`store-health-banner ${isHealthy ? 'is-healthy' : 'needs-attention'}`}
		>
			<span className="store-health-banner-icon">
				<i className="adminfont-cart" />
			</span>
			<div className="store-health-banner-body">
				<div className="store-health-banner-title">
					{isHealthy
						? __('Your store is in great shape', 'vulopilot')
						: __('Your store needs some attention', 'vulopilot')}
				</div>
				{!isLoading && (
					<div className="store-health-banner-count">
						{isHealthy
							? __(
									"You're all caught up — nothing open is interfering with sales right now.",
									'vulopilot'
								)
							: sprintf(
									/* translators: %d is the number of open WooCommerce findings. */
									_n(
										'%d thing could interfere with sales.',
										'%d things could interfere with sales.',
										total,
										'vulopilot'
									),
									total
								)}
					</div>
				)}
				<div className="store-health-banner-desc">
					{__(
						'Customers can shop and checkout, but some products, payments, and automatic store tasks may need attention.',
						'vulopilot'
					)}
				</div>
				<ButtonInput
					position="full-width"
					buttons={[
						{
							text: __('Review Important Issues →', 'vulopilot'),
							onClick: onReviewIssues,
						},
						{
							text: __('View Store Summary', 'vulopilot'),
							color: 'border-purple',
							onClick: onViewSummary,
						},
					]}
				/>
			</div>
		</div>
	);
};

export default StoreHealthBanner;
