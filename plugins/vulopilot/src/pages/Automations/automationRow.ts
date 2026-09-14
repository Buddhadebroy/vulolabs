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
 * home) into its own file so those free call sites don't need to import
 * from a component that no longer exists in this plugin.
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
