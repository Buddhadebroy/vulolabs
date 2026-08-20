import { __ } from '@wordpress/i18n';

export interface AutomationTemplate {
	id: string;
	icon: string;
	label: string;
	description: string;
	/** null = "Create from scratch" — no prefill, opens today's blank form. */
	category: 'monitoring' | 'security' | 'content' | 'commerce' | 'reporting' | 'custom' | null;
	triggerType: string | null;
	actionTypes: ('create-notification' | 'run-ai-action')[] | null;
}

/**
 * "Create new automation"'s template picker — each row prefills Automate
 * Work's real create form (category/trigger/actions all real fields
 * `AutomationsRest::CATEGORY_OPTIONS`/`TriggerRegistry`/`ActionRegistry`
 * already validate, AutomationPanel.tsx's own `openSignal`/`initial*` props)
 * rather than being decorative. `category` is the real, complete 6-value
 * enum (`monitoring|security|content|commerce|reporting|custom` — confirmed
 * server-side, `automationLabels.ts`'s own `CATEGORY_OPTIONS`) — there is no
 * real `'seo'` automation category (that's a *finding* category, a
 * different enum), so "SEO optimization" honestly maps to `'content'`, the
 * closest real match, rather than a fabricated `'seo'` value the backend
 * would reject.
 */
export const AUTOMATION_TEMPLATES: AutomationTemplate[] = [
	{
		id: 'website-health-scan',
		icon: 'search blue',
		label: __('Website health scan', 'vulopilot'),
		description: __('Check for issues and get alerts', 'vulopilot'),
		category: 'monitoring',
		triggerType: 'daily',
		actionTypes: ['create-notification'],
	},
	{
		id: 'security-monitoring',
		icon: 'security yellow',
		label: __('Security monitoring', 'vulopilot'),
		description: __('Keep your site safe', 'vulopilot'),
		category: 'security',
		triggerType: 'daily',
		actionTypes: ['create-notification'],
	},
	{
		id: 'seo-optimization',
		icon: 'search-discovery pink',
		label: __('SEO optimization', 'vulopilot'),
		description: __('Improve rankings and visibility', 'vulopilot'),
		category: 'content',
		triggerType: 'weekly',
		actionTypes: ['create-notification', 'run-ai-action'],
	},
	{
		id: 'woocommerce-monitor',
		icon: 'woocommerce orange',
		label: __('WooCommerce monitor', 'vulopilot'),
		description: __('Keep your store running smoothly', 'vulopilot'),
		category: 'commerce',
		triggerType: 'daily',
		actionTypes: ['create-notification'],
	},
	{
		id: 'content-optimizer',
		icon: 'document cyan',
		label: __('Content optimizer', 'vulopilot'),
		description: __('Improve content automatically', 'vulopilot'),
		category: 'content',
		triggerType: 'weekly',
		actionTypes: ['create-notification', 'run-ai-action'],
	},
	{
		id: 'from-scratch',
		icon: 'plus rose',
		label: __('Create from scratch', 'vulopilot'),
		description: __('Build a custom automation', 'vulopilot'),
		category: null,
		triggerType: null,
		actionTypes: null,
	},
];

export const getAutomationTemplateById = (id: string): AutomationTemplate | null =>
	AUTOMATION_TEMPLATES.find((template) => template.id === id) ?? null;
