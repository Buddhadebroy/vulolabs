import { __ } from '@wordpress/i18n';

/**
 * New Scanning → Content Intelligence tab
 * (CONTENT-INTELLIGENCE-MODULE.md). Only one new setting here —
 * `thin_content_word_threshold`/`flag_orphan_pages`/etc. already live
 * under Scanning → SEO and aren't duplicated here (this tab's own
 * ReadabilityScanner is the only genuinely new scanner Content
 * Intelligence adds; the other checks it reports on are reused from SEO,
 * see this module's own docblock).
 */
export default {
	id: 'content-intelligence',
	// Sorts after SEO (2) and its own Sitemap/Webmaster/IndexNow cluster
	// (2.1-2.3), before GEO (3).
	priority: 2.4,
	headerTitle: __('Content Intelligence', 'vulopilot'),
	headerIcon: 'media-text',
	submitUrl: 'settings',
	modal: [
		{
			key: 'content-section-readability',
			type: 'section',
			title: __('Readability', 'vulopilot'),
			desc: __(
				'Controls the Content page\'s readability findings — a standard Flesch Reading Ease score (0-100, higher is easier to read).',
				'vulopilot'
			),
		},
		{
			key: 'content_readability_min_score',
			type: 'number',
			label: __('Minimum readability score', 'vulopilot'),
			desc: __(
				'Posts scoring below this on the Flesch Reading Ease scale are flagged. 50 is that scale\'s own "Fairly Difficult" boundary.',
				'vulopilot'
			),
		},
	],
};
