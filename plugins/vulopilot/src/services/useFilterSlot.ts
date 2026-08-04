import { useEffect, useState } from 'react';
import { applyFilters } from '@wordpress/hooks';
import type { ComponentType } from 'react';

/**
 * `vulopilot-pro-admin-script` is a hard WP script dependency of
 * `vulopilot-admin-script` (FrontendScriptsPro.php's own docblock: Pro's
 * src/index.tsx reads the `appLocalizer` global only Free's own
 * `wp_localize_script()` call defines), so Free's bundle is always
 * requested and parsed first. But "requested first" isn't "finishes
 * executing before Free needs it": both are plain, non-deferred <script>
 * tags, and the browser can yield to the event loop in the gap while it
 * fetches Pro's script over the network — long enough for Free's own
 * first post-mount effect to already have fired and missed Pro's
 * `addFilter()` calls (measured live: Free's own effect ran with every
 * slot still unregistered). Free's routes.ts also eagerly imports every
 * page (no route-level code splitting), so a plain
 * `applyFilters(hookName, null)` read at module scope or on first render
 * is even more exposed to the same race — it runs during that same early
 * pass and permanently misses Pro's registration, regardless of which
 * modules are actually active: the slot renders nothing forever, not
 * just while locked.
 *
 * Fixed by re-checking on a second, timing-independent signal instead of
 * a single guess: Pro's own src/index.tsx dispatches
 * `vulopilot_pro_modules_loaded` once every active module's `addFilter()`
 * calls have actually run. Still also re-checks once on mount (cheap,
 * and correct if Pro's script happens to have already finished by then),
 * so this only ever depends on Pro's event when the race is actually
 * lost.
 */
export const useFilterSlot = <T = ComponentType>(
	hookName: string
): T | null => {
	const [component, setComponent] = useState<T | null>(
		() => applyFilters(hookName, null) as T | null
	);

	useEffect(() => {
		const recheck = () => {
			const resolved = applyFilters(hookName, null) as T | null;
			setComponent(() => resolved);
		};

		recheck();

		window.addEventListener('vulopilot_pro_modules_loaded', recheck);
		return () =>
			window.removeEventListener(
				'vulopilot_pro_modules_loaded',
				recheck
			);
	}, [hookName]);

	return component;
};
