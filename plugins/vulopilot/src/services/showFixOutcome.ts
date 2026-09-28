/**
 * What VuloPilot Pro's fix handlers (`vulopilot_finding_fix_handler`,
 * `vulopilot_finding_bulk_fix_handler`) resolve to. `message` is what happened, including why when
 * nothing could be fixed; `undo` is present only when reversible. Free never interprets this; it
 * hands it to the Pro-provided view (see useFixNotice).
 */
export interface FixOutcome {
	success: boolean;
	message: string;
	label?: string;
	/** Where to change what the fix reported on (e.g. the author's profile). */
	link?: { url: string; label: string };
	undo?: () => Promise<{ success: boolean; message: string }>;
}
