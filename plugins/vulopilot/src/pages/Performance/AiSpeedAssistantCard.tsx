import { __, sprintf, _n } from '@wordpress/i18n';
import { CardComponent, TooltipComponent } from '@zyra/components';
import { ButtonInput } from '@zyra/inputs';
import AiCopilotGuard from '../../components/AiCopilotGuard';
import { useApiList } from '../../services/useApiList';
import './Performance.scss';

interface FindingRow {
	id: number;
}

interface AiSpeedAssistantCardProps {
	onReviewIssues: () => void;
}

/**
 * "AI Speed Assistant" — this page's one real "N optimizations available"
 * card, per direct instruction: used to have a separate "Speed Boost
 * Available" card (SpeedBoostCard.tsx, now deleted) right above it, with
 * its own "Fix All Issues with AI"/"View Details" pair reading the exact
 * same `category: 'performance'` open-finding count this card already
 * showed via its own honestly-disabled "Let AI Optimize Speed"/"Review
 * Speed Issues" pair — two CTAs for the same action. Merged into this one
 * card; the plain count line below replaces the old chat-bubble framing,
 * matching the simpler "N optimizations available" shape the removed
 * card used, and the two buttons ("Optimize with AI"/"Review First") stay
 * this card's own copy.
 *
 * No *bulk* AI action-trigger engine exists for performance findings
 * anywhere in this codebase (WooCommerceAi's own `BulkOptimizePanel.tsx`
 * is real, but scoped to WooCommerce products — there's no equivalent for
 * performance), so "Optimize with AI" stays honestly disabled with a
 * tooltip rather than silently doing nothing, same as before. Real
 * open-finding count for category 'performance' (same `useApiList('findings',
 * ...)` pattern AiInsightBanner.tsx/AiSalesAssistantCard.tsx already use).
 * Gated on the real AI Copilot module (AiCopilotGuard).
 */
const AiSpeedAssistantCard = ({ onReviewIssues }: AiSpeedAssistantCardProps) => {
	const { total, isLoading } = useApiList<FindingRow>('findings', {
		category: 'performance',
		status: 'open',
		per_page: 1,
	});

	return (
		<CardComponent
			title={__('AI Speed Assistant', 'vulopilot')}
			titleIcon="ai"
			isLoading={isLoading}
		>
			<AiCopilotGuard>
				{!isLoading && (
					<div className="desc">
						{total > 0
							? sprintf(
									/* translators: %d is the number of open performance findings. */
									_n(
										'%d optimization available',
										'%d optimizations available',
										total,
										'vulopilot'
									),
									total
								)
							: __(
									"You're all caught up — no open speed issues right now.",
									'vulopilot'
								)}
					</div>
				)}
				<TooltipComponent
					text={__(
						"Bulk auto-fix isn't available yet — there's no AI action-trigger engine wired up for performance findings.",
						'vulopilot'
					)}
				>
					<ButtonInput
						position="full-width"
						buttons={{
							text: __('Optimize with AI', 'vulopilot'),
							icon: 'ai',
							disabled: true,
							onClick: () => {},
						}}
					/>
				</TooltipComponent>
				<ButtonInput
					position="full-width"
					buttons={{
						text: __('Review First', 'vulopilot'),
						color: 'border-purple',
						onClick: onReviewIssues,
					}}
				/>
			</AiCopilotGuard>
		</CardComponent>
	);
};

export default AiSpeedAssistantCard;
