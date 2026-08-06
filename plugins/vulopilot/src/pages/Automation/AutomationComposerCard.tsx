import React, { useState } from 'react';
import { __ } from '@wordpress/i18n';
import { CardComponent, ChatInputComponent } from '@zyra/components';

const AUTOMATE_PROMPTS = [
	{ id: 'nightly', title: __('Optimize my website every night', 'vulopilot') },
	{ id: 'blog', title: __('Publish a blog every Monday', 'vulopilot') },
	{ id: 'woocommerce', title: __('Keep WooCommerce healthy', 'vulopilot') },
	{ id: 'security', title: __('Monitor security 24/7', 'vulopilot') },
	{ id: 'seo', title: __('Improve SEO automatically', 'vulopilot') },
	{ id: 'links', title: __('Fix broken links', 'vulopilot') },
	{ id: 'report', title: __('Weekly performance report', 'vulopilot') },
	{ id: 'custom', title: __('Build a custom workflow', 'vulopilot') },
];

/**
 * The mockup's "What would you like me to automate?" composer — same
 * honest treatment as AI Assistant's ChatTab.tsx composer: there's no
 * NLP-to-automation-config engine to send this to (only the form-based
 * Workflow Builder further down the page — see ManageAutomationsSection.tsx),
 * so sending is disabled with an explanation rather than faking a build.
 * The prompt pills still really prefill the composer text, since that part
 * needs no backend.
 */
const AutomationComposerCard = () => {
	const [message, setMessage] = useState('');

	return (
		<CardComponent className="automate-composer-card">
			<h2 className="automate-composer-title">
				{__('What would you like me to automate?', 'vulopilot')}
			</h2>
			<ChatInputComponent
				value={message}
				onChange={setMessage}
				onSend={() => setMessage('')}
				placeholder={__(
					'Ask VuloPilot to automate anything…',
					'vulopilot'
				)}
				sendDisabledReason={__(
					"Automating from a free-text request isn't available yet — build an automation with the form below instead.",
					'vulopilot'
				)}
			/>
			<div className="automate-composer-prompts">
				{AUTOMATE_PROMPTS.map((prompt) => (
					<button
						key={prompt.id}
						type="button"
						className="automate-composer-prompt"
						onClick={() => setMessage(prompt.title)}
					>
						{prompt.title}
					</button>
				))}
			</div>
			<p className="automate-composer-note">
				{__(
					"Automations run in the background on their own schedule — even while you're offline.",
					'vulopilot'
				)}
			</p>
		</CardComponent>
	);
};

export default AutomationComposerCard;
