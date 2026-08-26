/* global appLocalizer */
import { useModules } from '@zyra/core';

/**
 * Keeps `window.appLocalizer.active_modules` — the plain, PHP-localized
 * snapshot every module gate check in this app (and vulopilot-pro's own)
 * reads directly (`appLocalizer.active_modules.includes(moduleId)`, ~15
 * call sites) — in sync with zyra's own `useModules()` zustand store, the
 * one thing ModuleGridComponent.tsx (Settings → Modules' real toggle) ever
 * updates when a toggle succeeds.
 *
 * Without this, `appLocalizer.active_modules` stays the page-load snapshot
 * forever: a locked-feature popup's own "Enable Now" button sends the user
 * to the Modules tab, they flip the toggle on, hit back — the previous tab
 * remounts, re-reads that same stale snapshot, and shows the exact same
 * popup again, with nothing short of a full page refresh fixing it
 * (confirmed live).
 *
 * Diffing against the store's own previous value (rather than replacing
 * `active_modules` wholesale with the store's current list) keeps this
 * safe regardless of that store's own quirky bootstrap: `useModules`
 * defaults to an empty array and is only ever backfilled from a real API
 * fetch behind a `force_{plugin}_context_reload` localStorage flag (see
 * `initializeModules()`, called once from this plugin's own index.tsx) —
 * a wholesale replace on that first, often-still-empty snapshot would wipe
 * out every module `appLocalizer.active_modules` already had correct at
 * page load. Diffing only ever applies the incremental add/remove a real
 * toggle click makes.
 *
 * Also fires a `vulopilot_active_modules_changed` window event with the
 * diff — vulopilot-pro's own src/index.tsx listens for it (same cross-
 * bundle DOM-event wiring `vulopilot_pro_modules_loaded` already
 * establishes the other direction, see that file's own docblock) to
 * `require.context`-load any Pro module whose own JS chunk didn't ship at
 * page load because it was inactive then. Without this second half, a
 * *Pro* module's "Enable Now" round-trip (Settings → Modules → toggle on →
 * back) fixes every plain `appLocalizer.active_modules.includes(id)` gate
 * check, but a slot-based one (`useFilterSlot`, e.g. Automations.tsx's own
 * wizard/"Build with AI" popups) stays locked until a real page refresh,
 * since that Pro module's `addFilter()` registration never ran at all —
 * confirmed live.
 */
export const syncActiveModulesWithModuleToggles = (): void => {
	useModules.subscribe((state, prevState) => {
		const added = state.modules.filter((id) => !prevState.modules.includes(id));
		const removed = prevState.modules.filter((id) => !state.modules.includes(id));

		if (0 === added.length && 0 === removed.length) {
			return;
		}

		const current = new Set(appLocalizer.active_modules ?? []);
		added.forEach((id) => current.add(id));
		removed.forEach((id) => current.delete(id));
		appLocalizer.active_modules = Array.from(current);

		window.dispatchEvent(
			new CustomEvent('vulopilot_active_modules_changed', {
				detail: { added, removed },
			})
		);
	});
};
