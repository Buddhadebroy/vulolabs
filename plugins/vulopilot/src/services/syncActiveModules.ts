/* global vulopilotAppLocalizer */
import { useModules } from '@zyra/core';

/**
 * Without this, `vulopilotAppLocalizer.active_modules` stays the page-load snapshot
 * forever: a locked-feature popup's own "Enable Now" button sends the user
 * to the Modules tab, they flip the toggle on, hit back - the previous tab
 * remounts, re-reads that same stale snapshot, and shows the exact same
 * popup again, with nothing short of a full page refresh fixing it
 * (confirmed live).
 *
 * Diffing against the store's own previous value (rather than replacing
 * `active_modules` wholesale with the store's current list) keeps this
 * safe regardless of that store's own quirky bootstrap: `useModules`
 * defaults to an empty array and is only ever backfilled from a real API
 * fetch behind a `force_{plugin}_context_reload` localStorage flag (see
 * `initializeModules()`, called once from this plugin's own index.tsx) -
 * a wholesale replace on that first, often-still-empty snapshot would wipe
 * out every module `vulopilotAppLocalizer.active_modules` already had correct at
 * page load. Diffing only ever applies the incremental add/remove a real
 * toggle click makes.
 */
export const syncActiveModulesWithModuleToggles = (): void => {
	useModules.subscribe((state, prevState) => {
		const added = state.modules.filter((id) => !prevState.modules.includes(id));
		const removed = prevState.modules.filter((id) => !state.modules.includes(id));

		if (0 === added.length && 0 === removed.length) {
			return;
		}

		const current = new Set(vulopilotAppLocalizer.active_modules ?? []);
		added.forEach((id) => current.add(id));
		removed.forEach((id) => current.delete(id));
		vulopilotAppLocalizer.active_modules = Array.from(current);

		window.dispatchEvent(
			new CustomEvent('vulopilot_active_modules_changed', {
				detail: { added, removed },
			})
		);
	});
};
