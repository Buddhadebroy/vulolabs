/* global vulopilotAppLocalizer */
import { useModules } from '@zyra/core';

/**
 * Without this, `vulopilotAppLocalizer.active_modules` stays the page-load snapshot forever.
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
