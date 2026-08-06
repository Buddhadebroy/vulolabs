import { __ } from '@wordpress/i18n';

/**
 * Mirrors vulopilot-pro's TRIGGER_TYPE_OPTIONS/ACTION_TYPE_OPTIONS
 * (modules/Automation/src/AutomationPanel.tsx) 1:1 — Free can't import
 * Pro's src/ tree directly (only the shared zyra package), so this is its
 * own small copy of the same registry defaults, same convention that file
 * itself already uses for mirroring the backend TriggerRegistry/
 * ActionRegistry rather than fetching them.
 */
export const TRIGGER_TYPE_LABELS: Record<string, string> = {
	manual: __('Manual', 'vulopilot'),
	rest: __('External (REST)', 'vulopilot'),
	hourly: __('Hourly', 'vulopilot'),
	daily: __('Daily', 'vulopilot'),
	weekly: __('Weekly', 'vulopilot'),
	monthly: __('Monthly', 'vulopilot'),
	post_published: __('Page published', 'vulopilot'),
	product_created: __('Product created', 'vulopilot'),
	product_updated: __('Product updated', 'vulopilot'),
	order_completed: __('Order completed', 'vulopilot'),
	user_registered: __('User registered', 'vulopilot'),
	low_stock: __('Low stock', 'vulopilot'),
};

/** The 4 cron-based trigger types — the only ones with a real cadence to badge. */
export const SCHEDULE_TRIGGER_TYPES = ['hourly', 'daily', 'weekly', 'monthly'];

export const ACTION_TYPE_LABELS: Record<string, string> = {
	'send-email': __('Send email', 'vulopilot'),
	'resolve-finding': __('Resolve finding', 'vulopilot'),
	'run-ai-action': __('Run AI action', 'vulopilot'),
	'create-notification': __('Create notification', 'vulopilot'),
};
