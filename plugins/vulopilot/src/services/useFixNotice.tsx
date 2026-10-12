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
 * Slot for the result of a "Fix with AI" click - renders via `vulopilot_fix_outcome_view`.
 *
 * @param onChanged Called after an undo finishes, to refresh whatever lists the finding(s).
 * @return `show` to report an outcome, `fixNotice` - the element to render above the table, and
 *         `isUnfixable` - true once the last outcome shown was the honest "no automatic fix
 *         exists" case, so a caller can stop offering a "Fix with AI" button that can only fail
 *         the same way again.
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

	return {
		show,
		fixNotice,
		isUnfixable: !outcome?.success && !!outcome?.noFixAvailable,
	};
};
