import { __ } from '@wordpress/i18n';
import type { FindingsSection } from '../Security/SectionedFindingsTab';

/** Section → scanner_id grouping, mirrors Settings → Scanning → SEO's own cards. */
export const SEO_SECTIONS: FindingsSection[] = [
	{
		key: 'titles-meta',
		title: __('Titles & Meta', 'vulopilot'),
		description: __(
			'Title tags, meta descriptions, and duplicate meta descriptions and focus keyword drift.',
			'vulopilot'
		),
		emptyMessage: __(
			'No titles/meta findings yet - run a scan to check titles and descriptions.',
			'vulopilot'
		),
		scannerIds: [
			'seo',
			'meta-description',
			'meta-description-duplication',
			'focus-keyword-audit',
		],
	},
	{
		key: 'content-structure',
		title: __('Content Structure', 'vulopilot'),
		description: __(
			'Heading hierarchy, duplicate/missing H1s, and thin content.',
			'vulopilot'
		),
		emptyMessage: __(
			'No content structure findings yet - run a scan to check headings and content length.',
			'vulopilot'
		),
		scannerIds: ['heading-structure', 'multiple-h1', 'thin-content'],
	},
	{
		key: 'images',
		title: __('Images', 'vulopilot'),
		description: __(
			'Missing featured images and content images with no alt text.',
			'vulopilot'
		),
		emptyMessage: __(
			'No image findings yet - run a scan to check featured images and alt text.',
			'vulopilot'
		),
		scannerIds: ['seo-images', 'images'],
	},
	{
		key: 'internal-linking',
		title: __('Internal Linking', 'vulopilot'),
		description: __(
			'How well your pages link to each other - thin or missing internal links make it harder for both search engines and visitors to find your content.',
			'vulopilot'
		),
		emptyMessage: __(
			'No internal linking findings yet - run a scan to check how your pages link to each other.',
			'vulopilot'
		),
		scannerIds: ['internal-linking'],
	},
	{
		key: 'indexability-canonicals',
		title: __('Indexability & Canonicals', 'vulopilot'),
		description: __(
			'Canonical URLs, duplicate content, and orphan pages with no internal links pointing to them.',
			'vulopilot'
		),
		emptyMessage: __(
			'No indexability findings yet - run a scan to check canonicals, duplicate content, and orphan pages.',
			'vulopilot'
		),
		scannerIds: ['canonical-url', 'duplicate-content', 'orphan-pages'],
	},
	{
		// Key stays 'structured-data' to match Seo.php's category_scores map - only the title changed.
		key: 'structured-data',
		title: __('Social Metadata', 'vulopilot'),
		description: __(
			'Open Graph and Twitter Card tags - the structured metadata social platforms and some AI crawlers read.',
			'vulopilot'
		),
		emptyMessage: __(
			'No social metadata findings yet - run a scan to check Open Graph and Twitter Card tags.',
			'vulopilot'
		),
		scannerIds: ['open-graph', 'twitter-card'],
	},
];
