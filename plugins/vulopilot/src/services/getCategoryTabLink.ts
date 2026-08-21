/**
 * A finding's `category` (scanner get_category(), e.g. 'seo', 'images',
 * 'schema', 'links', 'accessibility') isn't always the same string as the
 * tab it actually lives on — some categories are grouped under a shared
 * tab's subtab rather than getting a same-named top-level route of their
 * own (routes.ts has no 'seo' route; those findings live under
 * SEO & Visibility → SEO). The three places that used to build this link
 * (AISuggestionsWidget, NeedsAttentionWidget, IssuesList) each hand-rolled
 * their own `category: 'seo'` copy of this mapping, so all three sent
 * users to `?tab=seo` — a route that doesn't exist.
 */
const CATEGORY_TAB_LINKS: Record<string, string> = {
	// SEO & Visibility tab, "SEO" subtab — SeoTab.tsx's own SEO_SECTIONS
	// groups the 'seo'/'images'/'schema'/'links' categories into one tab
	// already.
	seo: 'seo-visibility&subtab=seo',
	images: 'seo-visibility&subtab=seo',
	schema: 'seo-visibility&subtab=seo',
	// SEO & Visibility tab, "Broken Links" subtab (BrokenLinksTab.tsx) —
	// Scanners\Basic\BrokenLinksScanner is the ONLY real scanner with
	// category 'links' (confirmed: no other scanner returns this
	// category), so this can point straight at its own dedicated tab
	// rather than the general SEO tab's "Links & schema" section, which
	// still separately shows the same findings too (SeoIssuesSection.tsx
	// wasn't changed).
	links: 'seo-visibility&subtab=broken-links',
	// SEO & Visibility tab, "GEO" subtab.
	geo: 'seo-visibility&subtab=geo',
	// Reports Overview's "AI Visibility" category tile (ReportsCategoryStatusGrid.tsx)
	// is `ai_visibility_now`/`ai_visibility_then`, an average of the same
	// 'geo' category score and BRAND_SCANNER_IDS this tab's own "GEO"
	// subtab covers (Controllers\ReportsOverview::build_categories()) — not
	// a real top-level 'ai_visibility' category any finding actually has.
	ai_visibility: 'seo-visibility&subtab=geo',
	brand: 'seo-visibility&subtab=brand-visibility',
	// Its own top-level route (Accessibility.tsx, pages/Accessibility/) —
	// used to be "Protect My Site" → "Accessibility" subtab, moved out per
	// direct instruction.
	accessibility: 'accessibility',
	security: 'security',
	// Site Health's own 5 real sections (SiteHealthTab.tsx, merged with
	// Backups into one page, no inner subtabs) — same categories
	// WordPressHealthScanner/ServerHealthScanner/CronScanner/
	// DatabaseScanner/UpdatesScanner each return.
	wordpress: 'site-health',
	server: 'site-health',
	cron: 'site-health',
	database: 'site-health',
	updates: 'site-health',
	performance: 'performance',
	woocommerce: 'commerce',
	content: 'content',
};

/**
 * @param category A finding's `category` field. Unrecognized/empty
 * categories fall back to the Health page — the one real page that lists
 * every category's open findings unfiltered, so the link always lands
 * somewhere the finding genuinely appears.
 */
export const getCategoryTabLink = (category?: string): string => {
	const target = CATEGORY_TAB_LINKS[category ?? ''] ?? 'health';

	return `?page=vulopilot#&tab=${target}`;
};
