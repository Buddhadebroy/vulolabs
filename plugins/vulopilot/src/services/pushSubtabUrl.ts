/**
 * Updates the browser's address bar to reflect a tab click, without a full
 * navigation/reload — the same `?page=vulopilot#&tab=<page>&subtab=<id>`
 * shape `getCategoryTabLink.ts` already builds for cross-page links, and
 * the same mechanism zyra's own `NavigatorComponent` uses internally
 * (`window.history.pushState(null, '', url)` inside its `navigate()`) for
 * `src/pages/AIAssistant/AIAssistant.tsx`'s tab bar.
 *
 * GEO.tsx/Performance.tsx/Security.tsx use zyra's plain `TabsComponent`
 * instead of `NavigatorComponent` (a controlled `activeIndex`/`onTabChange`
 * pair, not `<Link>`-based) — that component has no URL awareness of its
 * own (it's a shared, externally-published package; see this repo's own
 * CLAUDE.md on `zyra` not being a local/patchable package here), so each
 * of those pages' own `onTabChange` calls this directly instead, to get
 * the same "the URL always matches whichever tab is showing" behavior AI
 * Copilot's tab bar already has. Deliberately only wired into the actual
 * tab-bar click handler, not every programmatic `setActiveTab` call (e.g.
 * a card's own "jump to this other tab" button) — AI Copilot's own
 * `goToTab()` helper doesn't push a URL either; only a real click on the
 * tab bar itself does, via NavigatorComponent's `Link`/`navigate()`.
 *
 * @param tabSlug The page's own WP menu slug (e.g. 'geo', 'performance', 'security').
 * @param subtab  The tab id just switched to.
 */
export const pushSubtabUrl = (tabSlug: string, subtab: string): void => {
	window.history.pushState(
		null,
		'',
		`?page=vulopilot#&tab=${tabSlug}&subtab=${subtab}`
	);
};
