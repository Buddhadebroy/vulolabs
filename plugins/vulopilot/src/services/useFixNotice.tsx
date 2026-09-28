import { useState, type ComponentType, type ReactNode } from 'react';
import type { FixOutcome } from './showFixOutcome';
import { useFilterSlot } from './useFilterSlot';

interface FixOutcomeViewProps {
	outcome: FixOutcome;
	// eslint-disable-next-line no-unused-vars
	onUpdate: (outcome: FixOutcome | null) => void;
	onChanged?: () => void;
}

/**
 * Slot for the result of a "Fix with AI" click. Fix with AI is a Pro feature, so
 * how the result looks (and the Undo button) is Pro's: Pro registers a component on
 * `vulopilot_fix_outcome_view`. Without Pro nothing is rendered.
 *
 * @param onChanged Called after an undo finishes, to refresh whatever lists the finding(s).
 * @return `show` to report an outcome, and `fixNotice` - the element to render above the table.
 */
export const useFixNotice = (onChanged?: () => void) => {
	const [outcome, setOutcome] = useState<FixOutcome | null>(null);
	const View = useFilterSlot<ComponentType<FixOutcomeViewProps>>(
		'vulopilot_fix_outcome_view'
	);

	const show = (next: FixOutcome | undefined) =>
		setOutcome(next?.message ? next : null);

	const fixNotice: ReactNode =
		View && outcome ? (
			<View outcome={outcome} onUpdate={setOutcome} onChanged={onChanged} />
		) : null;

	return { show, fixNotice };
};
