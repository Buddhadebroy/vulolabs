import { __ } from '@wordpress/i18n';
import { CardComponent, AnalyticsComponent, ModuleGuardComponent } from '@zyra/components';
import { ButtonInput } from '@zyra/inputs';
import { useSalesInsights } from '../../services/useSalesInsights';
import AiCopilotGuard from '../../components/AiCopilotGuard';

interface AiSalesOptimizerCardProps {
	onFindOpportunities: () => void;
}

/**
 * "AI Sales Optimizer" — real cross-sell/upsell/bundle-opportunity counts
 * (`GET /sales-insights`, Pro's WooCommerceIntelligence module). "Find
 * Sales Opportunities →" scrolls down to the existing, unchanged "Bulk AI
 * optimization" panel further down this page — that panel already has
 * the real action picker/product search/approve flow; this card is a
 * real-data summary and entry point, not a second implementation of it.
 * AiCopilotGuard is the outer gate (the free master AI toggle); the
 * ModuleGuardComponent below it is a second, more specific gate for
 * WooCommerce Intelligence (Pro) — both must be satisfied to see real data.
 */
const AiSalesOptimizerCard = ({
	onFindOpportunities,
}: AiSalesOptimizerCardProps) => {
	const { data, isLoading } = useSalesInsights();

	return (
		<CardComponent
			className="ai-sales-optimizer-card"
			titleIcon="ai"
			title={__('AI Sales Optimizer', 'vulopilot')}
			desc={__('Real cross-sell, upsell, and bundle opportunities across your store.', 'vulopilot')}
			badges={[{ text: __('PRO', 'vulopilot'), color: 'purple' }]}
			isLoading={isLoading}
		>
			<AiCopilotGuard>
				{!isLoading && !data && (
					<ModuleGuardComponent
						icon="lock"
						title={__('Unlock AI Sales Optimizer', 'vulopilot')}
						desc={__(
							'Enable the WooCommerce Intelligence module to find real cross-sell, upsell, and bundle opportunities across your catalog.',
							'vulopilot'
						)}
						buttonText={__('Learn more', 'vulopilot')}
						onButtonClick={onFindOpportunities}
					/>
				)}
				{!isLoading && data && (
					<>
						<div className="desc">
							{__(
								'Find cross-sell, upsell, and bundle opportunities across your store.',
								'vulopilot'
							)}
						</div>
						<AnalyticsComponent
							variant="small"
							cols={3}
							data={[
								{
									icon: 'link',
									number: data.cross_sell_count,
									text: __('Cross-sell opportunities', 'vulopilot'),
								},
								{
									icon: 'bar-chart',
									number: data.upsell_count,
									text: __('Upsell opportunities', 'vulopilot'),
								},
								{
									icon: 'refresh',
									number: data.bundle_count,
									text: __('Bundle opportunities', 'vulopilot'),
								},
							]}
						/>
						<ButtonInput
							buttons={{
								text: __('Find Sales Opportunities →', 'vulopilot'),
								onClick: onFindOpportunities,
							}}
						/>
					</>
				)}
			</AiCopilotGuard>
		</CardComponent>
	);
};

export default AiSalesOptimizerCard;
