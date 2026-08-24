import { __ } from '@wordpress/i18n';

const STATUS_LABELS = { active: __('Active', 'vulopilot'), inactive: __('Inactive', 'vulopilot') };

/**
 * Settings → Scanning → Content & Search.
 *
 * Matches a mockup: a 5-row `type: 'expandable-panel'` field
 * (`content_search_scans`) — same real zyra component
 * Scanning/AiVisibility.ts's own `ai_visibility_scans` field already uses
 * for its 5 rows — each row a real scan-category toggle, followed by a
 * "Why these scans matter" notice.
 *
 * Real backend: migrated 8 previously-flat settings
 * (`flag_missing_meta_description`, `flag_duplicate_titles`,
 * `flag_missing_alt_text`, `flag_broken_links`,
 * `broken_link_check_frequency`, `flag_broken_images`,
 * `broken_image_check_frequency`, `flag_missing_schema`,
 * `content_readability_min_score`) out of Scanning/SeoContent.ts (moved,
 * not duplicated — see that file's own docblock) into this one nested
 * `content_search_scans` setting (Utill::VULOPILOT_SETTINGS_DEFAULTS's own
 * docblock has the full migration list). Each row's `enable` is a REAL,
 * genuinely new on/off switch its own PHP scanner(s) now check — a
 * scanner that already had its own granular flag (nested here as a
 * `formFields` checkbox) now only runs when BOTH its row's `enable` and
 * that flag are true; a scanner with no prior flag at all
 * (SeoScanner/HeadingStructureScanner, LargeImagesScanner,
 * RedirectAnalysisScanner/NotFoundScanner, StructuredDataValidationScanner,
 * ReadabilityScanner) gains `enable` as its first-ever on/off switch:
 *   - 'seo'         → Scanners\Basic\SeoScanner, HeadingStructureScanner
 *     (both genuinely new gates), MetaDescriptionScanner,
 *     DuplicateContentScanner
 *   - 'images'      → Scanners\Basic\ImagesScanner, BrokenImagesScanner,
 *     LargeImagesScanner (a genuinely new gate)
 *   - 'links'       → Scanners\Basic\BrokenLinksScanner,
 *     RedirectAnalysisScanner, NotFoundScanner (both genuinely new gates)
 *   - 'schema'      → Scanners\Basic\SchemaScanner,
 *     StructuredDataValidationScanner (shared, by design — one mockup
 *     toggle covers both, same as the old flat `flag_missing_schema` did)
 *   - 'readability' → Scanners\Basic\ReadabilityScanner (a genuinely new
 *     `enable` gate — previously only had a threshold, no on/off switch
 *     at all)
 *
 * "Restore Defaults" is ContentSearchScansHeader.tsx (Settings.tsx's own
 * GetForm(), rendered just before this tab's fields) — a real, scoped
 * reset (`POST /settings/reset-content-search-scans`), not a UI-only
 * component field, since it needs to persist server-side and refresh
 * SettingContext in place. Same shape AiVisibilityScansHeader.tsx already
 * established.
 */
export default {
	id: 'content-search',
	priority: 0,
	headerTitle: __('Content & Search', 'vulopilot'),
	headerDescription: __(
		'These scans help you improve your content quality, search visibility, and user experience.',
		'vulopilot'
	),
	headerIcon: 'search',
	submitUrl: 'settings',
	modal: [
		{
			key: 'content_search_scans',
			type: 'expandable-panel',
			label: '',
			modal: [
				{
					id: 'seo',
					icon: 'search',
					label: __('SEO checks', 'vulopilot'),
					desc: __(
						'Scan important SEO elements like titles, meta descriptions, headings, and more.',
						'vulopilot'
					),
					disableBtn: true,
					statusLabels: STATUS_LABELS,
					formFields: [
						{
							key: 'missing_meta_description',
							type: 'checkbox',
							look: 'toggle',
							label: __('Flag missing meta descriptions', 'vulopilot'),
							settingDescription: __('Pages and posts with no meta description set.', 'vulopilot'),
							options: [
								{ key: 'missing_meta_description', label: '', value: 'missing_meta_description' },
							],
						},
						{
							key: 'duplicate_titles',
							type: 'checkbox',
							look: 'toggle',
							label: __('Flag duplicate title tags', 'vulopilot'),
							settingDescription: __(
								'Two or more published pages sharing the exact same title.',
								'vulopilot'
							),
							options: [
								{ key: 'duplicate_titles', label: '', value: 'duplicate_titles' },
							],
						},
					],
				},
				{
					id: 'images',
					icon: 'image',
					label: __('Image checks', 'vulopilot'),
					desc: __(
						'Check images for missing alt text, large file sizes, and optimization issues.',
						'vulopilot'
					),
					disableBtn: true,
					statusLabels: STATUS_LABELS,
					formFields: [
						{
							key: 'missing_alt_text',
							type: 'checkbox',
							look: 'toggle',
							label: __('Flag missing alt text', 'vulopilot'),
							settingDescription: __('Content images with no alt attribute.', 'vulopilot'),
							options: [
								{ key: 'missing_alt_text', label: '', value: 'missing_alt_text' },
							],
						},
						{
							key: 'broken_images',
							type: 'checkbox',
							look: 'toggle',
							label: __('Flag broken images', 'vulopilot'),
							settingDescription: __(
								'Image tags pointing to a source URL that returns a broken (non-2xx/3xx) response.',
								'vulopilot'
							),
							options: [
								{ key: 'broken_images', label: '', value: 'broken_images' },
							],
						},
					],
				},
				{
					id: 'links',
					icon: 'link',
					label: __('Broken link checks', 'vulopilot'),
					desc: __(
						'Find broken links and redirects that can hurt user experience and SEO.',
						'vulopilot'
					),
					disableBtn: true,
					statusLabels: STATUS_LABELS,
					formFields: [
						{
							key: 'broken_links',
							type: 'checkbox',
							look: 'toggle',
							label: __('Flag broken internal links', 'vulopilot'),
							settingDescription: __(
								'Internal links pointing to a 404 or removed page.',
								'vulopilot'
							),
							options: [
								{ key: 'broken_links', label: '', value: 'broken_links' },
							],
						},
					],
				},
				{
					id: 'schema',
					icon: 'document',
					label: __('Structured data checks', 'vulopilot'),
					desc: __(
						'Validate structured data and ensure your pages are eligible for rich results.',
						'vulopilot'
					),
					disableBtn: true,
					statusLabels: STATUS_LABELS,
					formFields: [],
				},
				{
					id: 'readability',
					icon: 'text',
					label: __('Readability', 'vulopilot'),
					desc: __(
						"Analyze content readability to ensure it's easy for your visitors to read and understand.",
						'vulopilot'
					),
					disableBtn: true,
					statusLabels: STATUS_LABELS,
					formFields: [
						{
							key: 'min_score',
							type: 'number',
							size: 5,
							label: __('Minimum readability score', 'vulopilot'),
							settingDescription: __(
								'Posts scoring below this on the Flesch Reading Ease scale (0-100, higher is easier to read) are flagged. 50 is that scale\'s own "Fairly Difficult" boundary.',
								'vulopilot'
							),
						},
					],
				},
			],
		},
		{
			key: 'content-search-scans-notice',
			type: 'notice',
			noticeType: 'info',
			title: __('Why these scans matter', 'vulopilot'),
			message: __(
				'These scans help you create better content, rank higher in search engines, and provide a great experience for your visitors.',
				'vulopilot'
			),
		},
	],
};
