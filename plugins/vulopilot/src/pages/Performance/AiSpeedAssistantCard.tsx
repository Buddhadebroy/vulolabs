import { __, sprintf, _n } from '@wordpress/i18n';
import { CardComponent, ChatMessageComponent, TooltipComponent } from '@zyra/components';
import { ButtonInput } from '@zyra/inputs';
import AiCopilotGuard from '../../components/AiCopilotGuard';
import { useApiList } from '../../services/useApiList';
import './ImproveSpeed.scss';

interface FindingRow {
	id: number;
}

interface AiSpeedAssistantCardProps {
	onReviewIssues: () => void;
}

/**
 * "AI Speed Assistant" — the mockup's own copy claims it "can
 * automatically fix speed issues, optimize assets, and make your website
 * lightning fast," but no *bulk* AI action-trigger engine exists for
 * performance findings anywhere in this codebase (WooCommerceAi's own
 * `BulkOptimizePanel.tsx` is real, but scoped to WooCommerce products —
 * there's no equivalent for performance) — softened to an honest message,
 * same treatment Grow My Traffic's `AiRecommendationsSidebar.tsx` already
 * gave its own fabricated "+18%" claim. "Let AI Optimize Speed" (bulk) is
 * honestly disabled with a tooltip rather than silently doing nothing.
 * Real open-finding count for category 'performance' (same
 * `useApiList('findings', ...)` pattern AiInsightBanner.tsx/
 * AiSalesAssistantCard.tsx already use), and a real "Review Speed
 * Issues →" action — previously this card had no working action at all
 * (only the disabled bulk button), same gap AiSalesAssistantCard.tsx had
 * before its own "Review Suggestions First" fix. Gated on the real AI
 * Copilot module (AiCopilotGuard).
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
					<ChatMessageComponent sender="ai" avatarIcon="ai">
						{total > 0
							? sprintf(
									/* translators: %d is the number of open performance findings. */
									_n(
										"I found %d open speed issue — bulk auto-fix isn't connected yet, but I can help you review it.",
										"I found %d open speed issues — bulk auto-fix isn't connected yet, but I can help you review them.",
										total,
										'vulopilot'
									),
									total
								)
							: __(
									"You're all caught up — no open speed issues right now.",
									'vulopilot'
								)}
					</ChatMessageComponent>
				)}
				<TooltipComponent
					text={__(
						"Bulk auto-fix isn't available yet — there's no AI action-trigger engine wired up for performance findings.",
						'vulopilot'
					)}
				>
					<span
						role="button"
						aria-disabled="true"
						className="ai-speed-optimize disabled"
					>
						<i className="adminfont-ai" />
						{__('Let AI Optimize Speed', 'vulopilot')}
					</span>
				</TooltipComponent>
				<ButtonInput
					buttons={{
						text: __('Review Speed Issues →', 'vulopilot'),
						color: 'border-purple',
						onClick: onReviewIssues,
					}}
				/>
			</AiCopilotGuard>
		</CardComponent>
	);
};

export default AiSpeedAssistantCard;
