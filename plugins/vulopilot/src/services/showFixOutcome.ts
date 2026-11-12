/** What the fix handlers resolve to - `undo` is present only when reversible. */
export interface FixOutcome {
	success: boolean;
	message: string;
	label?: string;
	/** Where to change what the fix reported on (e.g. the author's profile). */
	link?: { url: string; label: string };
	undo?: () => Promise<{ success: boolean; message: string }>;
	/** True when this outcome is the honest "no automatic fix exists for this kind of issue" case. */
	noFixAvailable?: boolean;
}
