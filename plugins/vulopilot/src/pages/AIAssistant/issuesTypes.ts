export interface FindingSample {
	id: number;
	title: string;
	description: string;
	object_type: string | null;
	object_ref: string | null;
	created_at: string;
	/** Resolved page path or 'Site-wide' — added server-side by Findings.php's add_page_field(). */
	page?: string;
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

export const formatAffected = (count: number, objectType: string | null): string => {
	const [singular, plural] = OBJECT_TYPE_NOUNS[objectType ?? ''] ?? ['issue', 'issues'];

	return `${count} ${1 === count ? singular : plural}`;
};
