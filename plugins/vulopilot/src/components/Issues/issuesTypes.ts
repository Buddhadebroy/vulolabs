/**
 * Shared `FindingGroup`/`Finding` types and helpers (`formatAffected()`,
 * `issueIconFor()`, `CATEGORY_LABELS`, `CATEGORY_TABS`, …) behind every
 * "Issues" table in this plugin — AI Copilot's own IssuesList.tsx
 * (`pages/AIAssistant/`), GEO's several finding-group cards, Security's
 * SectionedIssuesTable.tsx, and Commerce's CommerceIssuesTable.tsx all read
 * from here. Moved out of `pages/AIAssistant/` into this shared
 * `components/Issues/` folder alongside IssuesSummaryCards.tsx/
 * IssueDetailPanel.tsx (its own real UI, same real reuse across those same
 * pages) per direct instruction — this was never actually AI-Copilot-
 * specific, just historically created there.
 */
export interface FindingSample {
	id: number;
	title: string;
	description: string;
	object_type: string | null;
	object_ref: string | null;
	created_at: string;
	/** Same "last reconfirmed by a scan" field IssueDetailPanel.tsx's own FindingRow carries — see that interface's own docblock. */
	last_seen_at?: string;
	/** Resolved page path or 'Site-wide' — added server-side by Findings.php's add_page_field(). */
	page?: string;
	/** Raw `wp_json_encode()`-d `Finding::get_meta()` column, unparsed (AbstractRepository::find_all() is a plain `SELECT *`, no server-side decode) — e.g. Performance scanners' own `recommended_fix` step list. Parse with `JSON.parse()` before use. */
	meta?: string | null;
}

export interface FindingGroup {
	scanner_id: string;
	category: string;
	count: number;
	severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
	object_type: string | null;
	/** Scanner's real get_label(), e.g. "Weak Password Detection". */
	label: string;
	/**
	 * One real, most-recent open finding from this group — GET /findings/groups
	 * always includes this so the detail panel can show real title/
	 * description/page text instead of fabricating "why it matters"/
	 * "how to fix" copy no scanner actually writes (see ScannerInterface —
	 * no such fields exist server-side).
	 */
	sample: FindingSample | null;
}

/**
 * Real category strings (Scanners/*::get_category()) mapped to display
 * labels — 'seo'/'images'/'schema'/'links' fold into "SEO & Visibility"
 * (GEO.tsx's own SEO subtab groups them the same way already, see
 * getCategoryTabLink.ts), 'geo'/'brand' fold into "AI Visibility" (GeoTab.tsx
 * already calls this same feature area "AI Visibility Score"), and
 * 'plugins'/'themes'/'php-warnings' (real DB category values with no
 * dedicated page of their own) fold into "Site Health".
 */
export const CATEGORY_LABELS: Record<string, string> = {
	seo: 'SEO & Visibility',
	images: 'SEO & Visibility',
	schema: 'SEO & Visibility',
	links: 'SEO & Visibility',
	geo: 'AI Visibility',
	brand: 'AI Visibility',
	accessibility: 'Accessibility',
	security: 'Security',
	'rest-api': 'Security',
	ssl: 'Security',
	performance: 'Performance',
	woocommerce: 'WooCommerce',
	content: 'Content',
	plugins: 'Site Health',
	themes: 'Site Health',
	'php-warnings': 'Site Health',
};

/**
 * The Issues table's category tab bar — each tab folds one or more real
 * `category` DB values into one mockup-matching tab (e.g. "SEO &
 * Visibility" covers 'seo'/'images'/'schema'/'links', the same grouping
 * getCategoryTabLink.ts's own CATEGORY_TAB_LINKS already uses for
 * navigation). `categories` is sent to `GET /findings/groups` as a
 * comma-separated `category` param (Findings.php's own
 * `parse_comma_separated_list()`, same IN-matching already used for
 * `scanner_id`).
 */
export const CATEGORY_TABS: { id: string; label: string; categories: string[] }[] = [
	{ id: 'seo', label: 'SEO & Visibility', categories: ['seo', 'images', 'schema', 'links'] },
	{ id: 'ai-visibility', label: 'AI Visibility', categories: ['geo', 'brand'] },
	{ id: 'security', label: 'Security', categories: ['security', 'rest-api', 'ssl'] },
	{ id: 'performance', label: 'Performance', categories: ['performance'] },
	{ id: 'woocommerce', label: 'WooCommerce', categories: ['woocommerce'] },
	{ id: 'content', label: 'Content', categories: ['content'] },
	{ id: 'accessibility', label: 'Accessibility', categories: ['accessibility'] },
	{ id: 'site-health', label: 'Site Health', categories: ['plugins', 'themes', 'php-warnings'] },
];

/** Which CATEGORY_TABS entry a real `category` value belongs to — used to preset the active tab when arriving with a specific group already known (NeedsAttentionCard.tsx's own group rows). */
export const findTabIdForCategory = (category: string): string =>
	CATEGORY_TABS.find((tab) => tab.categories.includes(category))?.id ?? 'all';

export const CATEGORY_ICONS: Record<string, string> = {
	seo: 'search-discovery yellow',
	images: 'search-discovery blue',
	schema: 'search-discovery blue',
	links: 'search-discovery blue',
	geo: 'geo-location pink',
	brand: 'star teal',
	accessibility: 'security lime',
	security: 'security lime',
	'rest-api': 'security lime',
	ssl: 'security lime',
	performance: 'bar-chart rose',
	woocommerce: 'woocommerce rose',
	content: 'document orange',
	plugins: 'coding lime',
	themes: 'coding lime',
	'php-warnings': 'coding lime',
};

/**
 * Real per-`scanner_id` icon, for the handful of categories (Performance in
 * particular — CDN/JavaScript/CSS Optimization/Cache Issues/… all share the
 * single real `category: 'performance'`) where `CATEGORY_ICONS` above
 * collapses several genuinely different real checks onto one identical
 * icon (confirmed live: every row in Performance's own "Top Issues" table
 * rendered the same bar-chart glyph regardless of which real scanner it
 * came from). Checked first in `issueIconFor()` below — `CATEGORY_ICONS`
 * remains the fallback for every scanner_id not listed here, so this only
 * ever narrows, never replaces, that map.
 *
 * Reuses the exact same icon+color each id's own tile already shows on
 * MetricsGrid.tsx's Performance overview grid, so a row here and its tile
 * above read as the same real check rather than two different glyphs for
 * one thing.
 */
export const SCANNER_ICONS: Record<string, string> = {
	'cache-detection': 'refresh-bold blue',
	cdn: 'global-community indigo',
	'css-optimization': 'coding sky',
	'javascript-optimization': 'shortcode yellow',
	'large-images': 'image green',
	fonts: 'text-fields red',
	'lazy-loading': 'eye teal',
	'database-cleanup': 'database orange',
	'heavy-plugins': 'module orange',
	'slow-pages': 'analytics violet',
};

/**
 * `SCANNER_ICONS[scanner_id]` first (several real scanners inside one real
 * category otherwise all render the same glyph — see that map's own
 * docblock), `CATEGORY_ICONS[category]` as the fallback every scanner_id
 * not explicitly listed already had. Named `issueIconFor` rather than
 * `rowIcon` to stay clearly distinct from `historyTypes.ts`'s own
 * `rowIcon(row: HistoryRow)` — same concept, different real row shape.
 */
export const issueIconFor = (
	category: string,
	scannerId: string
): string => SCANNER_ICONS[scannerId] ?? CATEGORY_ICONS[category] ?? 'issue';

/** count + a real object_type field → a display noun for the "Affected" column, e.g. "8 images"/"1 endpoint". */
const OBJECT_TYPE_NOUNS: Record<string, [string, string]> = {
	post: ['page', 'pages'],
	attachment: ['image', 'images'],
	product: ['product', 'products'],
	user: ['account', 'accounts'],
	url: ['endpoint', 'endpoints'],
	plugin: ['plugin', 'plugins'],
	theme: ['theme', 'themes'],
	table: ['table', 'tables'],
	file: ['file', 'files'],
	site: ['site-wide check', 'site-wide checks'],
};

/** Just the noun half of `formatAffected` (no count prefix) — for a caller that renders the count and noun as two separate pieces. */
export const getObjectTypeNoun = (count: number, objectType: string | null): string => {
	const [singular, plural] = OBJECT_TYPE_NOUNS[objectType ?? ''] ?? ['issue', 'issues'];

	return 1 === count ? singular : plural;
};

export const formatAffected = (count: number, objectType: string | null): string =>
	`${count} ${getObjectTypeNoun(count, objectType)}`;
