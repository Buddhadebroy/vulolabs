import { __ } from '@wordpress/i18n';
import { CardComponent, ChatMessageComponent, TooltipComponent } from '@zyra/components';
import AiCopilotGuard from '../../components/AiCopilotGuard';
import './ImproveSpeed.scss';

/**
 * "AI Speed Assistant" — the mockup's own copy claims it "can
 * automatically fix speed issues, optimize assets, and make your website
 * lightning fast," but no AI action-trigger engine is wired up anywhere
 * in this codebase (same gap as every other "Fix with AI" control on
 * this page) — softened to an honest message, same treatment Grow My
 * Traffic's `AiRecommendationsSidebar.tsx` already gave its own
 * fabricated "+18%" claim. "Let AI Optimize Speed" is honestly disabled
 * with a tooltip rather than silently doing nothing. Gated on the real AI
 * Copilot module (AiCopilotGuard) — previously this whole card ran
 * unconditionally regardless of module state.
 */
const AiSpeedAssistantCard = () => {
	return (
		<CardComponent title={__('AI Speed Assistant', 'vulopilot')} titleIcon="ai">
			<AiCopilotGuard>
				<ChatMessageComponent sender="ai" avatarIcon="ai">
					{__(
						"I can help you find and understand your site's speed issues — bulk auto-fix isn't connected yet.",
						'vulopilot'
					)}
				</ChatMessageComponent>
				<TooltipComponent
					text={__(
						"Bulk auto-fix isn't available yet — there's no AI action-trigger engine wired up.",
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
			</AiCopilotGuard>
		</CardComponent>
	);
};

export default AiSpeedAssistantCard;
