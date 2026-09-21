/**
 * zyra's own `EmailInput` (`@zyra/inputs`) only commits typed text into its
 * `value` array on Enter/comma/space (that component's own `handleKeyDown`)
 * — never on blur, and never just because a sibling submit button gets
 * clicked. A user who types a real address and clicks straight to "Create
 * Report"/"Schedule Report" without pressing Enter first has a
 * perfectly valid-looking email still sitting in the input's own DOM
 * value, invisible to whichever modal's own `recipients` state — which
 * then fails its own "add at least one recipient" check even though
 * there's visibly text in the box.
 *
 * Reads that raw, not-yet-committed text straight off the input's own DOM
 * node (`EmailInput` forwards its ref there) at submit time and folds it
 * into the already-committed list, rather than either patching that
 * external package (real source lives outside this repo, see
 * zyra-local-source.md) or asking the user to remember to press Enter.
 * Same email-shape check `EmailInput`'s own `isValidEmail` already uses,
 * so this never accepts something that component itself would have
 * rejected as a chip.
 *
 * @param committed Already-committed recipients (the modal's own `recipients` state).
 * @param inputEl   The `EmailInput`'s forwarded ref's current DOM node, or null.
 * @return Deduplicated recipients, pending text included.
 */
export const resolvePendingRecipients = (
	committed: string[],
	inputEl: HTMLInputElement | null
): string[] => {
	const pending = (inputEl?.value ?? '')
		.split(/[\s,]+/)
		.map((email) => email.trim())
		.filter((email) => /^\S+@\S+\.([a-zA-Z]{2,})$/.test(email));

	if (0 === pending.length) {
		return committed;
	}

	return Array.from(new Set([...committed, ...pending]));
};
