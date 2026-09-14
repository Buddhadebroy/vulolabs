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
 * page's own route (`tab=modules`) stayed registered for a while as a
 * reachable-but-unlinked fallback, but every real deep-link to it (Popup.tsx's
 * "Enable Now", AiCopilotGuard.tsx, GettingStartedCard.tsx, searchIndex.ts's
 * own module search results) already pointed here instead — the old route
 * itself was later removed from src/routes.ts too, per direct instruction,
 * once nothing real linked to it any more.
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
