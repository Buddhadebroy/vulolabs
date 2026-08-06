import { __, sprintf } from '@wordpress/i18n';
import { CardComponent } from '@zyra/components';
import { ButtonInput } from '@zyra/inputs';
import { useApiList } from '../../services/useApiList';

interface FindingRow {
	id: number;
}

interface AiInsightBannerProps {
	onNavigateToWooCommerceTab: () => void;
}

/**
 * "AI Insight" — the mockup's "$7,234 more this month" headline has no
 * backing anywhere in this codebase (no scoring-impact-per-fix/revenue
 * model exists — same gap that ruled out a dollar estimate on every
 * other Overview this session, confirmed here via
 * GEO's own `AiOpportunitiesCard.tsx` precedent, which uses the same
 * finding-count framing with no dollar amount). Real open-finding total
 * for category 'woocommerce' instead. "View AI Opportunities" is a real
 * navigation to the WooCommerce tab.
 */
const AiInsightBanner = ({
	onNavigateToWooCommerceTab,
}: AiInsightBannerProps) => {
	const { total, isLoading } = useApiList<FindingRow>('findings', {
		category: 'woocommerce',
		status: 'open',
		per_page: 1,
	});

	return (
		<CardComponent
			className="sell-more-ai-insight"
			titleIcon="ai"
			title={__('AI Insight', 'vulopilot')}
			isLoading={isLoading}
		>
			{!isLoading && (
				<p className="desc">
					{total > 0
						? sprintf(
								/* translators: %d is the number of open woocommerce findings. */
								__(
									'AI found %d opportunities to increase sales and improve conversions.',
									'vulopilot'
								),
								total
							)
						: __(
								"You're all caught up — no open store opportunities right now.",
								'vulopilot'
							)}
				</p>
			)}
			<ButtonInput
				buttons={{
					text: __('View AI Opportunities', 'vulopilot'),
					icon: 'ai',
					onClick: onNavigateToWooCommerceTab,
				}}
			/>
		</CardComponent>
	);
};

export default AiInsightBanner;
