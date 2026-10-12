import { __ } from '@wordpress/i18n';

/** One clickable answer - `isOther` renders as a free-text field instead of a chip. */
export interface GuidedOption {
	value: string;
	label: string;
}

export interface GuidedStep {
	id: string;
	question: string;
	/** Clickable choices. Ignored when `kind: 'findings'` - those are filled from real data. */
	options?: GuidedOption[];
	/** Adds a free-text "Other" option alongside `options`. Default true whenever `options` is set. */
	allowOther?: boolean;
	/**
	 * This step shows real findings instead of a static option list - no AI call, just
	 * `GET /findings/groups` filtered to `findingsCategory` (IssuesList.tsx's own real data).
	 */
	kind?: 'findings';
	findingsCategory?: string;
	/** Shown above the options when this step's answers come from already-known site data (business profile, audience, etc.) rather than a blank question. */
	prefillHint?: string;
}

export interface GuidedFlow {
	id: string;
	title: string;
	/** First message shown instead of the topic title, when it differs (topic 9 only). */
	openingMessage?: string;
	steps: GuidedStep[];
	/** What the final AI call is told to actually do, built from the collected answers. */
	resultSummary: string;
}

/**
 * The 9 "Suggested prompt" guided flows (`AIAssistant.tsx`'s `SUGGESTED_PROMPTS`) - a fixed
 * question tree walked entirely client-side (`useGuidedCopilotFlow`), no AI call per question.
 * AI is only called once, on the last step, with every collected answer as context - see that
 * hook's own docblock for why.
 */
export const GUIDED_FLOWS: Record<string, GuidedFlow> = {
	homepage: {
		id: 'homepage',
		title: __('Improve my homepage', 'vulopilot'),
		resultSummary: __('a prioritised homepage improvement plan, with proposed changes to review', 'vulopilot'),
		steps: [
			{
				id: 'goal',
				question: __('What would you like your homepage to do better?', 'vulopilot'),
				options: [
					{ value: 'enquiries', label: __('Bring more enquiries', 'vulopilot') },
					{ value: 'sales', label: __('Increase sales', 'vulopilot') },
					{ value: 'clarity', label: __('Explain my business clearly', 'vulopilot') },
					{ value: 'decide', label: __('Help me decide', 'vulopilot') },
				],
			},
			{
				id: 'main_action',
				question: __('What is the main action you want visitors to take?', 'vulopilot'),
				options: [
					{ value: 'contact', label: __('Contact us', 'vulopilot') },
					{ value: 'buy', label: __('Buy a product', 'vulopilot') },
					{ value: 'book', label: __('Book a call', 'vulopilot') },
					{ value: 'signup', label: __('Sign up', 'vulopilot') },
				],
			},
			{
				id: 'audience',
				question: __('Who are you trying to reach?', 'vulopilot'),
				prefillHint: __('Suggested from your business profile - confirm or edit.', 'vulopilot'),
				options: [],
				allowOther: true,
			},
			{
				id: 'focus_finding',
				question: __('I found these opportunities on your homepage. Which would you like to work on first?', 'vulopilot'),
				kind: 'findings',
				findingsCategory: 'seo',
			},
			{
				id: 'review',
				question: __('Would you like to review my suggested changes?', 'vulopilot'),
				options: [
					{ value: 'preview', label: __('Preview changes', 'vulopilot') },
					{ value: 'howto', label: __('Show me how to edit it', 'vulopilot') },
					{ value: 'another', label: __('Choose another issue', 'vulopilot') },
				],
			},
		],
	},

	traffic: {
		id: 'traffic',
		title: __('Why is traffic dropping?', 'vulopilot'),
		resultSummary: __('evidence-backed findings and next checks - say clearly when a cause is suspected rather than confirmed', 'vulopilot'),
		steps: [
			{
				id: 'when',
				question: __('When did you first notice fewer visitors?', 'vulopilot'),
				options: [
					{ value: 'this_week', label: __('This week', 'vulopilot') },
					{ value: 'this_month', label: __('This month', 'vulopilot') },
					{ value: 'choose_date', label: __('Choose a date', 'vulopilot') },
					{ value: 'not_sure', label: __("I'm not sure", 'vulopilot') },
				],
			},
			{
				id: 'where',
				question: __('Where are you seeing the drop?', 'vulopilot'),
				options: [
					{ value: 'google', label: __('Google search', 'vulopilot') },
					{ value: 'all_traffic', label: __('All website traffic', 'vulopilot') },
					{ value: 'specific_page', label: __('A specific page', 'vulopilot') },
					{ value: 'not_sure', label: __("I'm not sure", 'vulopilot') },
				],
			},
			{
				id: 'changed',
				question: __('Did anything change around that time?', 'vulopilot'),
				options: [
					{ value: 'redesign', label: __('Website redesign', 'vulopilot') },
					{ value: 'content_urls', label: __('Content or URL changes', 'vulopilot') },
					{ value: 'plugins', label: __('Plugin updates', 'vulopilot') },
					{ value: 'nothing', label: __('Nothing I know of', 'vulopilot') },
				],
			},
			{
				id: 'scope',
				question: __('Would you like me to check the whole website or specific pages?', 'vulopilot'),
				options: [
					{ value: 'whole_site', label: __('Whole website', 'vulopilot') },
					{ value: 'choose_pages', label: __('Choose pages', 'vulopilot') },
				],
			},
			{
				id: 'pages_finding',
				question: __('These pages show the biggest decline. Which should we investigate first?', 'vulopilot'),
				kind: 'findings',
				findingsCategory: 'seo',
			},
		],
	},

	vitals: {
		id: 'vitals',
		title: __('Fix my Core Web Vitals', 'vulopilot'),
		resultSummary: __('a page-specific diagnosis and fix path - distinguish immediate test results from field data that takes time to reflect improvements', 'vulopilot'),
		steps: [
			{
				id: 'pages',
				question: __('Which pages would you like to check?', 'vulopilot'),
				options: [
					{ value: 'homepage', label: __('Homepage', 'vulopilot') },
					{ value: 'products', label: __('Product pages', 'vulopilot') },
					{ value: 'choose_url', label: __('Choose a URL', 'vulopilot') },
					{ value: 'find_attention', label: __('Find pages that need attention', 'vulopilot') },
				],
			},
			{
				id: 'device',
				question: __('Where are visitors experiencing problems?', 'vulopilot'),
				options: [
					{ value: 'mobile', label: __('Mobile', 'vulopilot') },
					{ value: 'desktop', label: __('Desktop', 'vulopilot') },
					{ value: 'both', label: __('Both', 'vulopilot') },
					{ value: 'not_sure', label: __("I'm not sure", 'vulopilot') },
				],
			},
			{
				id: 'issues_finding',
				question: __('The scan found these performance issues. Which should we tackle first?', 'vulopilot'),
				kind: 'findings',
				findingsCategory: 'performance',
			},
			{
				id: 'handle',
				question: __('How would you like to handle this fix?', 'vulopilot'),
				options: [
					{ value: 'supported_fix', label: __('Review a supported fix', 'vulopilot') },
					{ value: 'instructions', label: __('Show step-by-step instructions', 'vulopilot') },
					{ value: 'dev_notes', label: __('Prepare notes for my developer', 'vulopilot') },
				],
			},
			{
				id: 'retest',
				question: __('Would you like me to run another test after the change?', 'vulopilot'),
				options: [
					{ value: 'test_again', label: __('Test again', 'vulopilot') },
					{ value: 'later', label: __('Do this later', 'vulopilot') },
				],
			},
		],
	},

	schema: {
		id: 'schema',
		title: __('Generate schema', 'vulopilot'),
		resultSummary: __('validated structured data that matches the visible page content, without duplicate or conflicting entries', 'vulopilot'),
		steps: [
			{
				id: 'page',
				question: __('Which page would you like to add structured data to?', 'vulopilot'),
				options: [
					{ value: 'search', label: __('Search existing pages', 'vulopilot') },
					{ value: 'paste_url', label: __('Paste a URL', 'vulopilot') },
				],
			},
			{
				id: 'type',
				question: __('What does this page mainly describe?', 'vulopilot'),
				prefillHint: __('Suggested from the page content - confirm or edit.', 'vulopilot'),
				options: [
					{ value: 'article', label: __('Article', 'vulopilot') },
					{ value: 'product', label: __('Product', 'vulopilot') },
					{ value: 'business', label: __('Business', 'vulopilot') },
					{ value: 'service', label: __('Service', 'vulopilot') },
					{ value: 'event', label: __('Event', 'vulopilot') },
				],
				allowOther: true,
			},
			{
				id: 'confirm_details',
				question: __('Can you confirm these details?', 'vulopilot'),
				prefillHint: __('Shown from the page itself - only the details that type needs and that are missing are asked for.', 'vulopilot'),
				options: [
					{ value: 'confirmed', label: __('Looks right', 'vulopilot') },
					{ value: 'edit', label: __('I need to edit something', 'vulopilot') },
				],
			},
			{
				id: 'existing_markup',
				question: __('This page already has structured data. What would you like to do?', 'vulopilot'),
				options: [
					{ value: 'review', label: __('Review existing markup', 'vulopilot') },
					{ value: 'resolve_conflict', label: __('Resolve a conflict', 'vulopilot') },
					{ value: 'keep', label: __('Keep existing markup', 'vulopilot') },
				],
			},
			{
				id: 'use',
				question: __('Your structured data is ready to review. How would you like to use it?', 'vulopilot'),
				options: [
					{ value: 'preview', label: __('Preview', 'vulopilot') },
					{ value: 'integration', label: __('Add through a supported integration', 'vulopilot') },
					{ value: 'copy', label: __('Copy the code', 'vulopilot') },
				],
			},
		],
	},

	checkout: {
		id: 'checkout',
		title: __('Improve checkout', 'vulopilot'),
		resultSummary: __('a diagnosis and a controlled fix plan - any live test order or payment needs an explicit user action', 'vulopilot'),
		steps: [
			{
				id: 'symptom',
				question: __('What is happening at checkout?', 'vulopilot'),
				options: [
					{ value: 'cannot_order', label: __('Customers cannot place orders', 'vulopilot') },
					{ value: 'payment_fails', label: __('Payment fails', 'vulopilot') },
					{ value: 'slow', label: __('Checkout is slow', 'vulopilot') },
					{ value: 'abandon', label: __('Customers leave before paying', 'vulopilot') },
					{ value: 'review', label: __('Review my checkout', 'vulopilot') },
				],
			},
			{
				id: 'affected',
				question: __('Which customers are affected?', 'vulopilot'),
				options: [
					{ value: 'everyone', label: __('Everyone', 'vulopilot') },
					{ value: 'mobile', label: __('Mobile users', 'vulopilot') },
					{ value: 'guest', label: __('Guest customers', 'vulopilot') },
					{ value: 'country', label: __('A particular country', 'vulopilot') },
					{ value: 'not_sure', label: __("I'm not sure", 'vulopilot') },
				],
			},
			// Conditional: only asked when `symptom` is a payment failure.
			{
				id: 'payment_method',
				question: __('Which payment method is affected?', 'vulopilot'),
				options: [],
				allowOther: true,
			},
			{
				id: 'what_shows',
				question: __('What do customers see when it happens?', 'vulopilot'),
				options: [
					{ value: 'error_message', label: __('Enter error message', 'vulopilot') },
					{ value: 'screenshot', label: __('Upload a screenshot', 'vulopilot') },
					{ value: 'no_error', label: __('No error appears', 'vulopilot') },
				],
			},
			{
				id: 'when',
				question: __('When did this start?', 'vulopilot'),
				options: [
					{ value: 'after_update', label: __('After an update', 'vulopilot') },
					{ value: 'after_settings', label: __('After changing settings', 'vulopilot') },
					{ value: 'choose_date', label: __('Choose a date', 'vulopilot') },
					{ value: 'not_sure', label: __("I'm not sure", 'vulopilot') },
				],
			},
			{
				id: 'issues_finding',
				question: __('I found these possible issues. Which would you like help resolving?', 'vulopilot'),
				kind: 'findings',
				findingsCategory: 'commerce',
			},
		],
	},

	woocommerce: {
		id: 'woocommerce',
		title: __('Optimize WooCommerce', 'vulopilot'),
		resultSummary: __('a scoped store improvement plan - route any checkout-specific problem into the checkout flow instead', 'vulopilot'),
		steps: [
			{
				id: 'goal',
				question: __('What would you like to improve in your store?', 'vulopilot'),
				options: [
					{ value: 'visibility', label: __('Product visibility', 'vulopilot') },
					{ value: 'content', label: __('Product content', 'vulopilot') },
					{ value: 'speed', label: __('Store speed', 'vulopilot') },
					{ value: 'shopping', label: __('Shopping experience', 'vulopilot') },
					{ value: 'review', label: __('Run a store review', 'vulopilot') },
				],
			},
			{
				id: 'scope',
				question: __('Where should we focus?', 'vulopilot'),
				options: [
					{ value: 'all_products', label: __('All products', 'vulopilot') },
					{ value: 'category', label: __('A category', 'vulopilot') },
					{ value: 'specific', label: __('Specific products', 'vulopilot') },
					{ value: 'recommend', label: __('Recommend a starting point', 'vulopilot') },
				],
			},
			{
				id: 'priority',
				question: __('What matters most right now?', 'vulopilot'),
				options: [
					{ value: 'find_products', label: __('Help shoppers find products', 'vulopilot') },
					{ value: 'choose', label: __('Help shoppers choose', 'vulopilot') },
					{ value: 'easier', label: __('Make shopping easier', 'vulopilot') },
					{ value: 'technical', label: __('Find technical problems', 'vulopilot') },
				],
			},
			{
				id: 'opportunities_finding',
				question: __('These are the main opportunities I found. Which should we start with?', 'vulopilot'),
				kind: 'findings',
				findingsCategory: 'commerce',
			},
			{
				id: 'preview',
				question: __('Would you like to preview changes to one product first?', 'vulopilot'),
				options: [
					{ value: 'one_product', label: __('Preview one product', 'vulopilot') },
					{ value: 'selected', label: __('Review selected products', 'vulopilot') },
					{ value: 'instructions', label: __('Show instructions', 'vulopilot') },
				],
			},
		],
	},

	blog: {
		id: 'blog',
		title: __('Write a blog', 'vulopilot'),
		resultSummary: __('an editable article draft with a suggested title and description - treat tone and length as optional controls, not compulsory questions', 'vulopilot'),
		steps: [
			{
				id: 'topic',
				question: __('What would you like to write about?', 'vulopilot'),
				options: [
					{ value: 'suggest', label: __('Suggest topics for my website', 'vulopilot') },
				],
				allowOther: true,
			},
			{
				id: 'audience',
				question: __('Who is this article for?', 'vulopilot'),
				prefillHint: __('Suggested from your saved audience - confirm or edit.', 'vulopilot'),
				options: [],
				allowOther: true,
			},
			{
				id: 'outcome',
				question: __('What should readers get from it?', 'vulopilot'),
				options: [
					{ value: 'learn', label: __('Learn something', 'vulopilot') },
					{ value: 'solve', label: __('Solve a problem', 'vulopilot') },
					{ value: 'compare', label: __('Compare options', 'vulopilot') },
					{ value: 'understand_product', label: __('Understand my product', 'vulopilot') },
				],
			},
			{
				id: 'details',
				question: __('Do you have any details or sources I should include?', 'vulopilot'),
				options: [
					{ value: 'key_points', label: __('Add key points', 'vulopilot') },
					{ value: 'links', label: __('Add links', 'vulopilot') },
					{ value: 'product_info', label: __('Add product information', 'vulopilot') },
					{ value: 'skip', label: __('Skip', 'vulopilot') },
				],
			},
		],
	},

	security: {
		id: 'security',
		title: __('Find security issues', 'vulopilot'),
		resultSummary: __('findings with severity, affected areas and recommended next steps - never present a clean scan as a guarantee of security', 'vulopilot'),
		steps: [
			{
				id: 'reason',
				question: __('Are you checking as a precaution, or have you noticed something unusual?', 'vulopilot'),
				options: [
					{ value: 'routine', label: __('Routine check', 'vulopilot') },
					{ value: 'suspicious', label: __('Suspicious activity', 'vulopilot') },
					{ value: 'warning', label: __('Website warning', 'vulopilot') },
					{ value: 'unexpected_changes', label: __('Unexpected changes', 'vulopilot') },
				],
			},
			// Conditional: only asked for a reported problem (reason !== 'routine').
			{
				id: 'noticed',
				question: __('What have you noticed?', 'vulopilot'),
				options: [
					{ value: 'unknown_users', label: __('Unknown users', 'vulopilot') },
					{ value: 'redirects', label: __('Redirects', 'vulopilot') },
					{ value: 'changed_files', label: __('Changed files or content', 'vulopilot') },
					{ value: 'browser_warning', label: __('Browser warning', 'vulopilot') },
				],
				allowOther: true,
			},
			{
				id: 'when',
				question: __('When did you first notice it?', 'vulopilot'),
				options: [
					{ value: 'today', label: __('Today', 'vulopilot') },
					{ value: 'this_week', label: __('This week', 'vulopilot') },
					{ value: 'choose_date', label: __('Choose a date', 'vulopilot') },
					{ value: 'not_sure', label: __("I'm not sure", 'vulopilot') },
				],
			},
			{
				id: 'issues_finding',
				question: __('The scan found these issues. Would you like to review the most urgent first?', 'vulopilot'),
				kind: 'findings',
				findingsCategory: 'security',
			},
			{
				id: 'address',
				question: __('How would you like to address this issue?', 'vulopilot'),
				options: [
					{ value: 'supported_fix', label: __('Review a supported fix', 'vulopilot') },
					{ value: 'instructions', label: __('Get instructions', 'vulopilot') },
					{ value: 'dev_report', label: __('Prepare a developer report', 'vulopilot') },
				],
			},
		],
	},

	geo: {
		id: 'geo',
		title: __('Make my site GEO ready', 'vulopilot'),
		openingMessage: __("Let's check how clearly your website explains your business to AI tools.", 'vulopilot'),
		resultSummary: __('a practical improvement plan for AI discoverability and understanding - never promise inclusion in AI answers', 'vulopilot'),
		steps: [
			{
				id: 'understand',
				question: __('What would you like AI tools to understand about your business?', 'vulopilot'),
				options: [
					{ value: 'what_we_do', label: __('What we do', 'vulopilot') },
					{ value: 'products', label: __('Our products or services', 'vulopilot') },
					{ value: 'expertise', label: __('Our expertise', 'vulopilot') },
					{ value: 'location', label: __('Our location', 'vulopilot') },
					{ value: 'all', label: __('All of these', 'vulopilot') },
				],
			},
			{
				id: 'description_check',
				question: __('Does this description of your business look right?', 'vulopilot'),
				prefillHint: __('Shown from your saved or detected business description.', 'vulopilot'),
				options: [
					{ value: 'confirm', label: __('Confirm', 'vulopilot') },
					{ value: 'edit', label: __('Edit', 'vulopilot') },
				],
			},
			{
				id: 'questions',
				question: __('What questions would you want potential customers to find you through?', 'vulopilot'),
				prefillHint: __('Suggested relevant questions - pick any, or add your own.', 'vulopilot'),
				options: [],
				allowOther: true,
			},
			{
				id: 'pages',
				question: __('Which pages should we focus on?', 'vulopilot'),
				options: [
					{ value: 'homepage', label: __('Homepage', 'vulopilot') },
					{ value: 'service_pages', label: __('Service pages', 'vulopilot') },
					{ value: 'product_pages', label: __('Product pages', 'vulopilot') },
					{ value: 'articles', label: __('Articles', 'vulopilot') },
					{ value: 'recommend', label: __('Recommend pages', 'vulopilot') },
				],
			},
			{
				id: 'gaps_finding',
				question: __('I found these gaps. Which would you like to improve first?', 'vulopilot'),
				kind: 'findings',
				findingsCategory: 'geo',
			},
			{
				id: 'review',
				question: __('Would you like to review the suggested improvements?', 'vulopilot'),
				options: [
					{ value: 'preview', label: __('Preview changes', 'vulopilot') },
					{ value: 'instructions', label: __('Show instructions', 'vulopilot') },
					{ value: 'another', label: __('Choose another finding', 'vulopilot') },
				],
			},
		],
	},
};

/** `SUGGESTED_PROMPTS` id -> `GUIDED_FLOWS` key - identical today, kept separate so a prompt's id can change without touching the flow key. */
export const GUIDED_FLOW_ID_BY_PROMPT: Record<string, string> = {
	homepage: 'homepage',
	traffic: 'traffic',
	vitals: 'vitals',
	schema: 'schema',
	checkout: 'checkout',
	woocommerce: 'woocommerce',
	blog: 'blog',
	security: 'security',
	geo: 'geo',
};
