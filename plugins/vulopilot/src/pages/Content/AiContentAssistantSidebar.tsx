import { useState } from 'react';
import { __ } from '@wordpress/i18n';
import {
	CardComponent,
	ChatInputComponent,
	ChatMessageComponent,
	ListComponent,
} from '@zyra/components';

const PROMPT_CHIPS = [
	{ id: 'blog-ai-ecommerce', icon: 'document', title: __('Write a blog about AI in eCommerce', 'vulopilot') },
	{ id: 'product-description-earbuds', icon: 'cart', title: __('Create a product description for wireless earbuds', 'vulopilot') },
	{ id: 'faq-return-policy', icon: 'question', title: __('Generate FAQs for return policy', 'vulopilot') },
	{ id: 'meta-title-landing-page', icon: 'price', title: __('Create meta title for a landing page', 'vulopilot') },
	{ id: 'cta-saas-product', icon: 'edit', title: __('Write a call-to-action for a SaaS product', 'vulopilot') },
];

/**
 * "AI Content Assistant" sidebar — same honest chat pattern used twice
 * already this session (AI Copilot's ChatTab.tsx, Grow My Traffic's
 * OverviewTab composer): no chat backend exists anywhere in this
 * codebase, so the composer's send button is real-looking but
 * `sendDisabledReason`-disabled rather than silently doing nothing.
 * Prompt chips prefill the input only, same harmless pattern as those
 * two pages' own prompt chips.
 */
const AiContentAssistantSidebar = () => {
	const [message, setMessage] = useState('');

	return (
		<CardComponent
			title={__('AI Content Assistant', 'vulopilot')}
			titleIcon="ai"
		>
			<ChatMessageComponent>
				{__(
					'Hi! I can help you create amazing content. Try one of these prompt ideas or ask your own.',
					'vulopilot'
				)}
			</ChatMessageComponent>
			<ListComponent
				className="chip-grid"
				items={PROMPT_CHIPS.map((prompt) => ({
					id: prompt.id,
					icon: prompt.icon,
					title: prompt.title,
					action: () => setMessage(prompt.title),
				}))}
			/>
			<ChatInputComponent
				value={message}
				onChange={setMessage}
				onSend={() => setMessage('')}
				placeholder={__('Ask Anything…', 'vulopilot')}
				sendDisabledReason={__(
					"AI chat replies aren't available yet — this is a preview of the composer, not a connected assistant.",
					'vulopilot'
				)}
			/>
		</CardComponent>
	);
};

export default AiContentAssistantSidebar;
