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

/**
 * The "Automations" tab's real type badge — a real `category` column on
 * `vulopilot_automations` (Install.php's own
 * add_automations_category_column() docblock), not a fabricated grouping.
 * Mirrors vulopilot-pro's `AutomationsRest::CATEGORY_OPTIONS` 1:1, same
 * "small matching copy, Free can't import Pro's src/ tree" convention this
 * file's own top docblock already establishes for triggers/actions.
 */
export const CATEGORY_OPTIONS = [
	'monitoring',
	'security',
	'content',
	'commerce',
	'reporting',
	'custom',
] as const;

export const CATEGORY_LABELS: Record<string, string> = {
	monitoring: __('Monitoring', 'vulopilot'),
	security: __('Security', 'vulopilot'),
	content: __('Content', 'vulopilot'),
	commerce: __('Commerce', 'vulopilot'),
	reporting: __('Reporting', 'vulopilot'),
	custom: __('Custom', 'vulopilot'),
};

interface ActionConfigEntry {
	type: string;
}

/**
 * The "Automations" tab's real "What it does" column — parses an
 * automation row's own `actions` JSON (real configured actions, not
 * invented copy) into a plain sentence via ACTION_TYPE_LABELS above. Same
 * parse-and-join logic AutomationOverviewGrid.tsx's own inline version
 * already established for its card grid — pulled out here so the
 * "Automations" tab's table can use the identical real logic instead of a
 * third copy.
 *
 * @param actionsJson An automation row's raw `actions` column (JSON-encoded array).
 * @return A real description, or a real "nothing configured" fallback — never fabricated.
 */
export const describeAutomationActions = (actionsJson: string): string => {
	try {
		const parsed = JSON.parse(actionsJson) as ActionConfigEntry[];
		const labels = parsed.map(
			(action) => ACTION_TYPE_LABELS[action.type] ?? action.type
		);

		return labels.length > 0
			? labels.join(', ')
			: __('No actions configured yet.', 'vulopilot');
	} catch {
		return __('No actions configured yet.', 'vulopilot');
	}
};
