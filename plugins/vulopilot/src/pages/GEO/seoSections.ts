import { __ } from '@wordpress/i18n';
import type { FindingsSection } from '../Security/SectionedFindingsTab';

/**
 * Section → scanner_id grouping, mirroring the 6 cards Settings → Scanning →
 * SEO already presents these same checks under (src/components/Settings/
 * Scanning/Seo.ts) so the findings page and its settings page agree on what
 * "Titles & meta"/"Images"/etc. actually cover. Own leaf file (not declared
 * inline in SeoTab.tsx, where it originally lived) so SeoIssuesByPageTable.tsx
 * can import it as this page's single source of truth for "every real SEO
 * scanner id" without creating a SeoTab.tsx → SeoIssuesByPageTable.tsx →
 * SeoTab.tsx import cycle (webpack silently leaves a still-initializing
 * circular import's named export `undefined` at the importing module's own
 * top-level eval time, blanking the whole tab — the exact bug this file's
 * extraction avoids, same class of issue securityScannerIds.ts's own
 * docblock documents for Security's tab).
 *
 * Deliberately no `category` field on these scanners — the 23 ids don't all
 * share one `category` column value (ImagesScanner is "images",
 * SchemaScanner is "schema", BrokenLinksScanner is "links"; most of the
 * rest are "seo" — modules/Seo/Module.php's own docblock has the full
 * breakdown). SeoIssuesByPageTable.tsx's own `GET /findings`/`GET
 * /findings/groups` fetches (no category filter, client-side scanner-id
 * allowlisting) handle this the same way this file's sections always did.
 *
 * Kept in exact sync with Seo.php's own `CATEGORY_SCANNER_IDS` (same 5
 * `key`s) so SeoTab.tsx's real per-category scores always agree with what
 * these sections' union actually covers.
 *
 * A new SEO scanner's findings won't show up on the SEO tab at all until
 * it's added both to modules/Seo/Module.php's registration list AND to the
 * right section below (see SEO-MODULE.md's own note on this).
 */
export const SEO_SECTIONS: FindingsSection[] = [
	{
		key: 'titles-meta',
		title: __('Titles & meta', 'vulopilot'),
		description: __(
			'Title length, meta descriptions, canonicals, duplicate titles, orphan pages, thin content, heading structure, and (Pro) duplicate meta descriptions, multiple H1s, and focus keyword drift.',
			'vulopilot'
		),
		emptyMessage: __(
			'No titles/meta findings yet — run a scan to check titles, descriptions, and content structure.',
			'vulopilot'
		),
		scannerIds: [
			'seo',
			'meta-description',
			'canonical-url',
			'duplicate-content',
			'orphan-pages',
			'thin-content',
			'heading-structure',
			'meta-description-duplication',
			'multiple-h1',
			'focus-keyword-audit',
		],
	},
	{
		key: 'images',
		title: __('Images', 'vulopilot'),
		description: __(
			'Missing featured images and content images with no alt text.',
			'vulopilot'
		),
		emptyMessage: __(
			'No image findings yet — run a scan to check featured images and alt text.',
			'vulopilot'
		),
		scannerIds: ['seo-images', 'images'],
	},
	{
		key: 'links-schema',
		title: __('Links & schema', 'vulopilot'),
		description: __(
			'Internal links, broken links, structured data, and social preview tags.',
			'vulopilot'
		),
		emptyMessage: __(
			'No link/schema findings yet — run a scan to check internal links and structured data.',
			'vulopilot'
		),
		scannerIds: [
			'internal-linking',
			'broken-links',
			'schema',
			'structured-data',
			'sitewide-structured-data',
			'open-graph',
			'twitter-card',
		],
	},
	{
		key: 'sitemap',
		title: __('XML Sitemap', 'vulopilot'),
		description: __(
			'Whether /wp-sitemap.xml is reachable and valid.',
			'vulopilot'
		),
		emptyMessage: __(
			'No sitemap findings yet — run a scan to check your XML sitemap.',
			'vulopilot'
		),
		scannerIds: ['sitemap', 'sitemap-validation'],
	},
	{
		key: 'robots',
		title: __('Robots.txt', 'vulopilot'),
		description: __(
			'Whether robots.txt is reachable, not accidentally blocking every crawler, and not blocking specific AI crawlers from specific pages.',
			'vulopilot'
		),
		emptyMessage: __(
			'No robots.txt findings yet — run a scan to check crawler access.',
			'vulopilot'
		),
		scannerIds: ['robots-txt', 'ai-crawler-blocked-pages'],
	},
];
