import { __ } from '@wordpress/i18n';

/**
 * Only `id`/`priority`/`headerTitle`/`headerIcon` are actually used —
 * NavigatorComponent reads these to list the tab and route to it, but
 * Settings.tsx's GetForm() special-cases `currentTab === 'modules'` to
 * render ModulesPanel.tsx instead of InputRenderer (the same escape hatch
 * 'ai-providers'/'indexnow'/'google-services' already use), so `modal`
 * below is never read. Module enable/disable state isn't a field in this
 * plugin's flat settings option row either — it's its own dedicated
 * endpoint (Controllers\Settings::set_modules()/get_modules()), which is
 * why this tab can't just be a normal InputRenderer-driven field list
 * like its siblings.
 *
 * This tab's own content (zyra's ModuleGridComponent) used to live only on
 * a separate, standalone top-level "Modules" page
 * (components/Modules/Modules.tsx) — moved here per direct instruction
 * ("move the modules tab in settings after general tab"). That standalone
 * page's own route (`tab=modules`, src/routes.ts) is left registered and
 * still directly reachable, and its WP submenu row was removed rather than
 * the page itself deleted — same "route stays real, just not in the native
 * submenu list" treatment Admin.php's own `legacy_submenus()` already
 * documents for every other tab folded into a new home.
 *
 * Sorts last in the top-level bar (priority 8 — Get Started 1, Site
 * Identity 2, Scanning 3, Automation 4, Reports 5, Notifications 6,
 * Developer Tools 7). Originally placed right after "General" per the
 * direct instruction quoted above, but has since moved to the end;
 * "General" itself has since been removed entirely (every field it ever
 * had moved to other tabs), so this is now the last tab regardless.
 */
export default {
	id: 'modules',
	priority: 8,
	headerTitle: __('Modules', 'vulopilot'),
	headerDescription: __(
		'Enable or disable optional VuloPilot features.',
		'vulopilot'
	),
	hideSettingHeader: true,
	headerIcon: 'module',
	submitUrl: 'settings',
	modal: [],
};
