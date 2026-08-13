import React from 'react';
import { __ } from '@wordpress/i18n';
import { CardComponent, TooltipComponent } from '@zyra/components';
import { ButtonInput } from '@zyra/inputs';
import AiCopilotGuard from '../../components/AiCopilotGuard';

interface AiForemanCardProps {
	onScrollToCreate: () => void;
}

/**
 * The mockup's "AI Foreman" claims a specific "I recommend creating 7 new
 * workflows... save 12 hours/week" — there's no AI-suggested-but-not-yet-
 * created workflow concept anywhere in this codebase (every automation row
 * is already a real, created one; no scoring/impact-estimate model exists
 * either), so this is softened to a generic, honest description — same
 * treatment AiSalesAssistantCard.tsx/SecurityDashboardCard.tsx gave their
 * own fabricated mockup claims this session. "Let AI Build My Automations"
 * is honestly disabled (no auto-builder exists); "Review Suggested
 * Workflows" is a real scroll down to the actual Workflow Builder form.
 * Gated on the real AI Copilot module (AiCopilotGuard) — previously this
 * whole card ran unconditionally regardless of module state.
 */
const AiForemanCard = ({ onScrollToCreate }: AiForemanCardProps) => (
	<CardComponent
		className="ai-foreman-card"
		titleIcon="automation"
		title={__('AI Foreman', 'vulopilot')}
	>
		<AiCopilotGuard>
			<p className="ai-foreman-desc">
				{__(
					'I can help you set up automations that react to what your scans find — sending emails, resolving findings, or proposing an AI fix, on a trigger you choose.',
					'vulopilot'
				)}
			</p>
			<TooltipComponent
				text={__(
					"Building automations from a description isn't available yet — use the form below to set up the trigger, conditions, and actions yourself.",
					'vulopilot'
				)}
			>
				<span
					role="button"
					aria-disabled="true"
					className="ai-foreman-build disabled"
				>
					<i className="adminfont-ai" />
					{__('Let AI Build My Automations', 'vulopilot')}
				</span>
			</TooltipComponent>
			<ButtonInput
				buttons={{
					text: __('Review Suggested Workflows', 'vulopilot'),
					onClick: onScrollToCreate,
				}}
			/>
		</AiCopilotGuard>
	</CardComponent>
);

export default AiForemanCard;
