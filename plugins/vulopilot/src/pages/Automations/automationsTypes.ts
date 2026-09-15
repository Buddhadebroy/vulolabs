import { __ } from '@wordpress/i18n';
import { applyFilters } from '@wordpress/hooks';
import { TableRow } from '@zyra/table';

/**
 * One row of the shared `vulopilot_automations` table — used by
 * BuiltinAutomationCards.tsx (the 2 free built-in rows), Automations.tsx
 * (the wizard's `viewAutomation` prop), AutomationsAttentionCard.tsx, and
 * vulopilot-pro's own ManageAutomationsSection.tsx (the real "Your
 * automations" list of everything else, registered into
 * Automations.tsx via the `vulopilot_automations_panel` filter slot's
 * `Manage` member — see that file's own docblock for why this real table's
 * management UI lives in Pro while this plain row shape stays here, free
 * for every one of the free-side call sites above to keep using).
 *
 * Pulled out of the now-Pro ManageAutomationsSection.tsx (its previous
 * home) into its own type here, merged into this shared automationsTypes.ts
 * (alongside AutomationTemplate below — same folder, same real "small data
 * shape backing this feature" concern, no reason to keep them in two files).
 */
export interface AutomationRow extends TableRow {
	id: number;
	name: string;
	category: string;
	trigger_type: string;
	actions: string;
	conditions?: string | null;
	status: 'enabled' | 'disabled' | 'draft';
	last_triggered_at: string | null;
	last_run_status: 'running' | 'completed' | 'failed' | null;
	last_run_actions_executed: number | null;
	last_run_actions_failed: number | null;
	last_run_changes_made: number | null;
	/** Real for the 4 cron-based trigger types only (see `AutomationsRest::with_next_run()`'s own docblock) — null for event/manual/webhook triggers, which have no "next scheduled" concept at all. */
	next_run_at: string | null;
	last_run_finished_at: string | null;
}

export interface AutomationTemplate {
	id: string;
	icon: string;
	label: string;
	description: string;
	/** null = "Create from scratch" — no prefill, opens today's blank form. */
	category: 'monitoring' | 'security' | 'content' | 'commerce' | 'reporting' | 'custom' | null;
	triggerType: string | null;
	actionTypes: ('create-notification' | 'run-ai-action')[] | null;
	/** True for the 3 templates that prefill Pro's own full trigger/condition/action wizard — same `pro?: boolean` shape ContentToolsGrid.tsx's own `ContentTool` uses. Omitted (falsy) for the 2 real free built-in automations at the top of this list. */
	pro?: boolean;
	/**
	 * True only for the 2 real free built-in automations
	 * (BuiltinAutomationSeeder.php's own `free_full_site_scan`/
	 * `free_visibility_report` rows, rendered by
	 * BuiltinAutomationCards.tsx on the Automations page) — these aren't
	 * Pro wizard templates at all (no category/trigger/actionTypes to
	 * prefill, hence all three `null` below), so a click just links
	 * straight to where they already live rather than opening any wizard.
	 * See AutomationsTemplatesCard.tsx's own click handler.
	 */
	linkOnly?: boolean;
}

/**
 * The 2 real free built-in automations, per direct instruction shown first
 * — see `AutomationTemplate.linkOnly`'s own docblock.
 */
const FREE_TEMPLATES: AutomationTemplate[] = [
	{
		id: 'run-full-site-scan',
		icon: 'search blue',
		label: __('Run Full Site Scan', 'vulopilot'),
		description: __('Scan your whole site on a schedule', 'vulopilot'),
		category: null,
		triggerType: null,
		actionTypes: null,
		linkOnly: true,
	},
	{
		id: 'send-visibility-report',
		icon: 'bar-chart green',
		label: __('Send Visibility Report', 'vulopilot'),
		description: __('Email your SEO visibility summary on a schedule', 'vulopilot'),
		category: null,
		triggerType: null,
		actionTypes: null,
		linkOnly: true,
	},
];

/**
 * Display-only shells for Pro's own 3 templates (per direct instruction,
 * trimmed down from the previous 6) — id/icon/label/desc only, deliberately
 * WITHOUT the real `category`/`triggerType`/`actionTypes` "recipe" each one
 * actually prefills Automate Work's wizard with. That recipe is genuine Pro
 * business knowledge (which trigger/condition/action combination actually
 * makes a working "security monitoring" or "WooCommerce monitor"
 * automation), so it lives in vulopilot-pro's own
 * modules/Automations/src/automationTemplates.ts and is merged onto these
 * same ids at runtime via the `vulopilot_automation_templates` filter below
 * — same "register a source, don't duplicate the registry" shape
 * `vulopilot_dashboard_widgets` already uses
 * (dashboard-widgets/registry.ts). These shells exist so the row itself
 * (icon, label, PRO badge) still renders — locked, inert — even on a site
 * with no Pro plugin installed at all, the same "tile always visible, only
 * the backing logic moves to Pro" shape ContentToolsGrid.tsx's own 9 Pro
 * tiles use; only the recipe values are genuinely absent until Pro's own
 * filter callback supplies them.
 */
const PRO_TEMPLATE_SHELLS: AutomationTemplate[] = [
	{
		id: 'security-monitoring',
		icon: 'security yellow',
		label: __('Security monitoring', 'vulopilot'),
		description: __('Keep your site safe', 'vulopilot'),
		category: null,
		triggerType: null,
		actionTypes: null,
		pro: true,
	},
	{
		id: 'woocommerce-monitor',
		icon: 'woocommerce orange',
		label: __('WooCommerce monitor', 'vulopilot'),
		description: __('Keep your store running smoothly', 'vulopilot'),
		category: null,
		triggerType: null,
		actionTypes: null,
		pro: true,
	},
	{
		id: 'from-scratch',
		icon: 'plus rose',
		label: __('Create from scratch', 'vulopilot'),
		description: __('Build a custom automation', 'vulopilot'),
		category: null,
		triggerType: null,
		actionTypes: null,
		pro: true,
	},
];

/**
 * Resolves "Create new automation"'s real template list fresh on every
 * call — deliberately NOT a precomputed module-scope constant. Free's
 * bundle can finish evaluating this module before Pro's own script (a
 * second, separately-fetched `<script>` tag) has run its `addFilter()`
 * call — the exact same real race `useFilterSlot.ts`'s own docblock
 * documents — so a one-time `applyFilters()` read at import time would
 * often permanently miss Pro's 3 real template recipes. Callers that
 * render live (AutomationsTemplatesCard.tsx) re-call this on the same
 * `vulopilot_pro_modules_loaded` event `useFilterSlot` re-checks on;
 * callers that only run after Pro's own `Wizard` slot has already resolved
 * (Automations.tsx's `automation_template` URL effect, gated on
 * `[Wizard]`) are safe by construction, since that `Wizard` reference comes
 * from the exact same Pro script load that also ran this filter's
 * `addFilter()` call.
 */
export const getAutomationTemplates = (): AutomationTemplate[] =>
	applyFilters(
		'vulopilot_automation_templates',
		[...FREE_TEMPLATES, ...PRO_TEMPLATE_SHELLS]
	) as AutomationTemplate[];

export const getAutomationTemplateById = (id: string): AutomationTemplate | null =>
	getAutomationTemplates().find((template) => template.id === id) ?? null;
