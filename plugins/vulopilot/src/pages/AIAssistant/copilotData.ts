import { __ } from '@wordpress/i18n';

/**
 * "Try asking me…" starter prompts — static UI copy, not fetched data, so
 * this stays a plain constant unlike Issues/AI Workflows (see
 * IssuesList.tsx/AiWorkflowsList.tsx, which read real `/findings`
 * and `/automations` data instead of placeholder rows).
 */

export interface SuggestedPrompt {
	id: string;
	icon: string;
	title: string;
}

export const SUGGESTED_PROMPTS: SuggestedPrompt[] = [
	{ id: 'homepage', icon: 'home', title: __('Improve my homepage', 'vulopilot') },
	{ id: 'traffic', icon: 'bar-chart', title: __('Why is traffic dropping?', 'vulopilot') },
	{ id: 'vitals', icon: 'bar-chart', title: __('Fix my Core Web Vitals', 'vulopilot') },
	{ id: 'schema', icon: 'coding', title: __('Generate schema', 'vulopilot') },
	{ id: 'checkout', icon: 'cart', title: __('Improve checkout', 'vulopilot') },
	{ id: 'woocommerce', icon: 'woocommerce', title: __('Optimize WooCommerce', 'vulopilot') },
	{ id: 'blog', icon: 'edit', title: __('Write a blog', 'vulopilot') },
	{ id: 'security', icon: 'security', title: __('Find security issues', 'vulopilot') },
	{ id: 'geo', icon: 'geo-location', title: __('Make my site GEO ready', 'vulopilot') },
];
