import { __, sprintf, _n } from '@wordpress/i18n';
import { CardComponent, TooltipComponent } from '@zyra/components';
import { ButtonInput } from '@zyra/inputs';
import { useApiList } from '../../services/useApiList';
import { useContentGate } from '../../services/useContentGate';
import './Performance.scss';

interface FindingRow {
	id: number;
}

interface AiSpeedAssistantCardProps {
	onReviewIssues: () => void;
}

/**
 * "AI Speed Assistant" - this page's one real "N optimizations available"
 * card, per direct instruction: used to have a separate "Speed Boost
 * Available" card (SpeedBoostCard.tsx, now deleted) right above it, with
 * its own "Fix All Issues with AI"/"View Details" pair reading the exact
 * same `category: 'performance'` open-finding count this card already
 * showed via its own honestly-disabled "Let AI Optimize Speed"/"Review
 * Speed Issues" pair - two CTAs for the same action. Merged into this one
 * card; the plain count line below replaces the old chat-bubble framing,
 * matching the simpler "N optimizations available" shape the removed
 * card used, and the two buttons ("Optimize with AI"/"Review First") stay
 * this card's own copy.
 */
const AiSpeedAssistantCard = ({ onReviewIssues }: AiSpeedAssistantCardProps) => {
	const { total, isLoading } = useApiList<FindingRow>('findings', {
		category: 'performance',
		status: 'open',
		per_page: 1,
	});
	const { wrap } = useContentGate('ai-copilot');

	// This card's own mock preview for useContentGate.tsx's own locked
	// state - same shape as the real content below (a count line + the
	// same two buttons), fake numbers, both buttons disabled - rather than
	// falling back to that hook's generic default.
	const dummyContent = (
		<>
			<div className="desc">
				{sprintf(
					/* translators: %d is a placeholder example count, not real data. */
					_n('%d optimization available', '%d optimizations available', 12, 'vulopilot'),
					12
				)}
			</div>
			<ButtonInput
				position="full-width"
				buttons={{ text: __('Optimize with AI', 'vulopilot'), icon: 'ai', color: 'orange-bg', disabled: true, onClick: () => {} }}
			/>
			<ButtonInput
				position="full-width"
				buttons={{ text: __('Review First', 'vulopilot'), icon: 'eye', color: 'border-purple', disabled: true, onClick: () => {} }}
			/>
		</>
	);

	return (
		<CardComponent
			title={__('AI Speed Assistant', 'vulopilot')}
			titleIcon="ai"
			desc={__('Real open performance findings, summarized.', 'vulopilot')}
			isLoading={isLoading}
		>
			{wrap(
				<>
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
										"You're all caught up - no open speed issues right now.",
										'vulopilot'
									)}
						</div>
					)}
					<TooltipComponent
						text={__(
							"Bulk auto-fix isn't available yet - there's no AI action-trigger engine wired up for performance findings.",
							'vulopilot'
						)}
					>
						<ButtonInput
							position="full-width"
							buttons={{
								text: __('Optimize with AI', 'vulopilot'),
								icon: 'ai',
								color: 'orange-bg',
								disabled: true,
								onClick: () => {},
							}}
						/>
					</TooltipComponent>
					<ButtonInput
						position="full-width"
						buttons={{
							text: __('Review First', 'vulopilot'),
							icon: 'eye',
							color: 'border-purple',
							onClick: onReviewIssues,
						}}
					/>
				</>,
				dummyContent
			)}
		</CardComponent>
	);
};

export default AiSpeedAssistantCard;
