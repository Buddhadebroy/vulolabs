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
 * Deliberately no `category` field on these scanners — the 15 ids don't all
 * share one `category` column value (ImagesScanner is "images",
 * InternalLinkingScanner is "links"; most of the rest are "seo" —
 * modules/Seo/Module.php's own docblock has the full breakdown).
 * SeoIssuesByPageTable.tsx's own `GET /findings`/`GET /findings/groups`
 * fetches (no category filter, client-side scanner-id allowlisting) handle
 * this the same way this file's sections always did.
 *
 * Kept in exact sync with Seo.php's own `CATEGORY_SCANNER_IDS` (same 3
 * `key`s) so SeoTab.tsx's real per-category scores always agree with what
 * these sections' union actually covers.
 *
 * `links-schema` used to bundle `broken-links`/`schema`/`structured-data`/
 * `sitewide-structured-data` in here too — real overlapping ownership
 * with "SEO & Visibility"'s own dedicated Broken Links and Schema &
 * Knowledge tabs, which already own those same scanner ids' findings
 * (direct instruction: "Schema should never be bundled into this category
 * when you already have a dedicated Schema screen"). Fixed by narrowing
 * this section to `internal-linking` alone and renaming it
 * `internal-linking` — those other scanners' findings are still fully
 * real, just only ever shown through their one real owning tab now, not
 * duplicated here too. `open-graph`/`twitter-card` have no dedicated tab
 * anywhere, so they moved into `titles-meta` instead of losing their SEO-
 * tab visibility entirely.
 *
 * `sitemap`/`robots` (2 more full sections) were dropped from here
 * entirely too, same overlap reasoning (direct instruction: "Robots.txt
 * and Sitemap should move away from SEO... these are fundamentally
 * crawler/discovery controls") — "SEO & Visibility"'s own Crawler Traffic
 * tab now owns real `robots-txt`/`sitemap`/`sitemap-validation`/
 * `ai-crawler-blocked-pages` findings tables itself
 * (CrawlerTrafficTab.tsx). SeoTab.tsx's own "Search engine access" status
 * line reads those same 4 scanner ids' open-finding count directly rather
 * than through a `SEO_SECTIONS` entry, since it's a link out to Crawler
 * Traffic, not a drill-down into a table on this tab.
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
			'open-graph',
			'twitter-card',
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
		key: 'internal-linking',
		title: __('Internal Linking', 'vulopilot'),
		description: __(
			'How well your pages link to each other — thin or missing internal links make it harder for both search engines and visitors to find your content.',
			'vulopilot'
		),
		emptyMessage: __(
			'No internal linking findings yet — run a scan to check how your pages link to each other.',
			'vulopilot'
		),
		scannerIds: ['internal-linking'],
	},
];
