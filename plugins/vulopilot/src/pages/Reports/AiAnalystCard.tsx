import React from 'react';
import { __ } from '@wordpress/i18n';
import { CardComponent, TooltipComponent } from '@zyra/components';
import { ButtonInput } from '@zyra/inputs';
import AiCopilotGuard from '../../components/AiCopilotGuard';

const ISSUES_TAB_URL =
	'?page=vulopilot#&tab=ai-assistant&subtab=issues';

/**
 * The mockup's "AI Analyst" claims specific predicted future numbers ("23
 * new opportunities... increase traffic by 14%... improve revenue by
 * approximately $3,200") — no prediction/forecasting model exists anywhere
 * in this codebase, same fabricated-claim treatment as `AiForemanCard.tsx`/
 * `AiSalesAssistantCard.tsx` this session. "Let AI Execute Recommendations"
 * is honestly disabled (no bulk-execute mechanism exists); "Review
 * Recommendations" is a real link to the AI Assistant's Issues tab, the
 * closest real "recommendations" surface in the app. Gated on the real AI
 * Copilot module (AiCopilotGuard) — previously this whole card ran
 * unconditionally regardless of module state.
 */
const AiAnalystCard = () => (
	<CardComponent
		className="ai-analyst-card"
		titleIcon="ai"
		title={__('AI Analyst', 'vulopilot')}
	>
		<AiCopilotGuard>
			<p className="ai-analyst-desc">
				{__(
					'I keep an eye on your scans and reports. Open findings across your site are real opportunities to improve — review them and decide what to fix.',
					'vulopilot'
				)}
			</p>
			<TooltipComponent
				text={__(
					"Bulk-executing recommendations isn't available yet — review and apply fixes individually from the AI Assistant tab.",
					'vulopilot'
				)}
			>
				<ButtonInput
					buttons={{
						text: __('Let AI Execute Recommendations', 'vulopilot'),
						icon: 'ai',
						color: 'orange-bg',
						disabled: true,
						onClick: () => {},
					}}
				/>
			</TooltipComponent>
			<ButtonInput
				buttons={{
					text: __('Review Recommendations', 'vulopilot'),
					onClick: () => {
						window.location.href = ISSUES_TAB_URL;
					},
				}}
			/>
		</AiCopilotGuard>
	</CardComponent>
);

export default AiAnalystCard;
