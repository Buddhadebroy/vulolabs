import { __ } from '@wordpress/i18n';
import { CardComponent, ChatMessageComponent, TooltipComponent } from '@zyra/components';
import { ButtonInput } from '@zyra/inputs';

interface AiSalesAssistantCardProps {
	onNavigateToWooCommerceTab: () => void;
}

/**
 * "AI Sales Assistant" — the mockup's own copy claims 4 specific
 * insights (18% conversion increase, $2,420 cart recovery, 15 product
 * pages, 42 products missing schema) — none of which have any real
 * backing (see this folder's plan: no conversion tracking, no abandoned-
 * cart data, no product-schema scanner exist anywhere). Softened to an
 * honest message, same treatment `AiSpeedAssistantCard.tsx` gave its own
 * fabricated claim. "Let AI Optimize My Store" is honestly disabled with
 * a tooltip; "Review Suggestions First" is a real navigation to the
 * WooCommerce tab.
 */
const AiSalesAssistantCard = ({
	onNavigateToWooCommerceTab,
}: AiSalesAssistantCardProps) => {
	return (
		<CardComponent title={__('AI Sales Assistant', 'vulopilot')} titleIcon="ai">
			<ChatMessageComponent sender="ai" avatarIcon="ai">
				{__(
					"I can help you find and understand your store's open findings — bulk auto-optimize isn't connected yet.",
					'vulopilot'
				)}
			</ChatMessageComponent>
			<TooltipComponent
				text={__(
					"Bulk auto-fix isn't available yet — there's no AI action-trigger engine wired up. Fix findings individually from the WooCommerce tab.",
					'vulopilot'
				)}
			>
				<span
					role="button"
					aria-disabled="true"
					className="ai-sales-optimize disabled"
				>
					<i className="adminfont-ai" />
					{__('Let AI Optimize My Store', 'vulopilot')}
				</span>
			</TooltipComponent>
			<ButtonInput
				buttons={{
					text: __('Review Suggestions First', 'vulopilot'),
					onClick: onNavigateToWooCommerceTab,
				}}
			/>
		</CardComponent>
	);
};

export default AiSalesAssistantCard;
