import { __ } from '@wordpress/i18n';

/**
 * Placeholder content for the AI Copilot chat UI (mockup implementation —
 * there's no conversational AI endpoint to source this from yet, see
 * AIAssistant.tsx's own docblock). One shared source so the Chat tab's
 * previews and the standalone Suggested Actions/Quick Commands/AI
 * Workflows tabs show the identically-same data, not near-duplicates.
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

export interface SuggestedAction {
	id: string;
	icon: string;
	color: string;
	title: string;
	desc: string;
}

export const SUGGESTED_ACTIONS: SuggestedAction[] = [
	{
		id: 'product-descriptions',
		icon: 'text-fields',
		color: '#2563eb',
		title: __('Improve 12 product descriptions', 'vulopilot'),
		desc: __('High SEO impact', 'vulopilot'),
	},
	{
		id: 'missing-schema',
		icon: 'coding',
		color: '#16a34a',
		title: __('Add missing schema', 'vulopilot'),
		desc: __('5 pages detected', 'vulopilot'),
	},
	{
		id: 'optimize-images',
		icon: 'image',
		color: '#7c3aed',
		title: __('Optimize 37 images', 'vulopilot'),
		desc: __('Can reduce load time by 1.2s', 'vulopilot'),
	},
	{
		id: 'vulnerable-plugins',
		icon: 'lock',
		color: '#f97316',
		title: __('Update 2 vulnerable plugins', 'vulopilot'),
		desc: __('Security risk detected', 'vulopilot'),
	},
];

export interface AiWorkflow {
	id: string;
	icon: string;
	color: string;
	title: string;
	desc: string;
}

export const AI_WORKFLOWS: AiWorkflow[] = [
	{
		id: 'weekly-optimization',
		icon: 'calendar',
		color: '#2563eb',
		title: __('Weekly Site Optimization', 'vulopilot'),
		desc: __('Runs every Monday', 'vulopilot'),
	},
	{
		id: 'content-growth',
		icon: 'document',
		color: '#16a34a',
		title: __('Content Growth Engine', 'vulopilot'),
		desc: __('Auto generate & optimize content', 'vulopilot'),
	},
	{
		id: 'woocommerce-health',
		icon: 'woocommerce',
		color: '#f97316',
		title: __('WooCommerce Health Check', 'vulopilot'),
		desc: __('Monitor store performance', 'vulopilot'),
	},
	{
		id: 'security-guardian',
		icon: 'security',
		color: '#16a34a',
		title: __('Security Guardian', 'vulopilot'),
		desc: __('Continuous threat monitoring', 'vulopilot'),
	},
];

export interface LiveInsight {
	id: string;
	icon: string;
	label: string;
	value: string;
	badge: { text: string; color: string };
	color: string;
	chartData: { name: string; value: number }[];
}

const sparkline = (values: number[]) =>
	values.map((value, index) => ({ name: String(index), value }));

export const LIVE_INSIGHTS: LiveInsight[] = [
	{
		id: 'organic-traffic',
		icon: 'bar-chart',
		label: __('Organic Traffic', 'vulopilot'),
		value: '12,458',
		badge: { text: '↑ 12.4%', color: 'green' },
		color: '#2563eb',
		chartData: sparkline([40, 48, 44, 56, 52, 60, 58]),
	},
	{
		id: 'core-web-vitals',
		icon: 'analytics',
		label: __('Core Web Vitals', 'vulopilot'),
		value: __('Good', 'vulopilot'),
		badge: { text: __('All metrics passed', 'vulopilot'), color: 'green' },
		color: '#16a34a',
		chartData: sparkline([70, 74, 72, 78, 76, 82, 80]),
	},
	{
		id: 'active-security',
		icon: 'security',
		label: __('Active Security', 'vulopilot'),
		value: __('Protected', 'vulopilot'),
		badge: { text: __('No threats found', 'vulopilot'), color: 'green' },
		color: '#7c3aed',
		chartData: sparkline([88, 90, 89, 92, 91, 93, 94]),
	},
	{
		id: 'woocommerce',
		icon: 'woocommerce',
		label: __('WooCommerce', 'vulopilot'),
		value: '$8,462',
		badge: { text: '↑ 18.6%', color: 'orange' },
		color: '#f97316',
		chartData: sparkline([30, 34, 32, 40, 38, 44, 48]),
	},
];
