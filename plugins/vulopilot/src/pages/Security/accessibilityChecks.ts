import { __ } from '@wordpress/i18n';

export interface AccessibilityCheck {
	/** Anchor-id suffix (`protect-my-site-section-a11y-${key}`) and React key. */
	key: string;
	title: string;
	description: string;
	scannerIds: string[];
	/** adminfont-* icon name (no prefix). */
	icon: string;
	/** Real hex color, shared by the tile's count/icon and its "Review" button border. */
	color: string;
	emptyMessage: string;
}

/**
 * The reference mockup's 5-tile "Accessibility Checks" grid — one bucket
 * merges what AccessibilityTab.tsx previously split into two separate
 * FindingsTable sections ("Forms" + "Links & Buttons") into one "Links &
 * Forms" tile, matching the mockup's own 5-tile IA exactly; every other
 * bucket is a 1:1 rename of an existing section. Shared by
 * AccessibilityHeroCard.tsx (combined scanner id list for its own
 * counts), AccessibilityChecksGrid.tsx (the tiles themselves),
 * AccessibilityPriorityList.tsx ("What should I fix first" — looks up
 * which check a given finding's scanner_id belongs to, for that row's
 * icon/color), and AccessibilityTab.tsx (the detailed FindingsTable
 * sections at the bottom of the page) — one definition, not four
 * driftable copies.
 */
export const ACCESSIBILITY_CHECKS: AccessibilityCheck[] = [
	{
		key: 'page-structure',
		title: __('Page Structure', 'vulopilot'),
		description: __('Some pages may be harder to navigate.', 'vulopilot'),
		scannerIds: ['accessibility'],
		icon: 'editor-list',
		color: '#7c3aed',
		emptyMessage: __(
			'No page structure findings yet — run a scan to check heading hierarchy.',
			'vulopilot'
		),
	},
	{
		key: 'images-media',
		title: __('Images & Media', 'vulopilot'),
		description: __(
			'Some images may not be explained to everyone.',
			'vulopilot'
		),
		scannerIds: ['images'],
		icon: 'image',
		color: '#16a34a',
		emptyMessage: __(
			'No image findings yet — run a scan to check for missing alt text.',
			'vulopilot'
		),
	},
	{
		key: 'links-forms',
		title: __('Links & Forms', 'vulopilot'),
		description: __(
			'Some controls may be difficult to understand.',
			'vulopilot'
		),
		scannerIds: ['form-labels', 'aria-attributes', 'wcag-scanner'],
		icon: 'link',
		color: '#d97706',
		emptyMessage: __(
			'No link/form findings yet — run a scan to check for unlabeled fields and ambiguous link text.',
			'vulopilot'
		),
	},
	{
		key: 'keyboard-use',
		title: __('Keyboard Use', 'vulopilot'),
		description: __(
			'Some visitors may have trouble navigating without a mouse.',
			'vulopilot'
		),
		scannerIds: ['keyboard-accessibility'],
		icon: 'coding',
		color: '#2563eb',
		emptyMessage: __(
			'No keyboard accessibility findings yet — run a scan to check.',
			'vulopilot'
		),
	},
	{
		key: 'visual-readability',
		title: __('Visual Readability', 'vulopilot'),
		description: __('Some text may be difficult to see.', 'vulopilot'),
		scannerIds: ['readability'],
		icon: 'eye',
		color: '#0d9488',
		emptyMessage: __(
			'No readability findings yet — run a scan to check.',
			'vulopilot'
		),
	},
];

/** Every scanner id any tile covers — the hero card's own combined counts. */
export const ACCESSIBILITY_SCANNER_IDS = ACCESSIBILITY_CHECKS.flatMap(
	(check) => check.scannerIds
);

/** Which tile a given finding's scanner_id belongs to, for its icon/color. */
export const checkForScannerId = (
	scannerId: string
): AccessibilityCheck | undefined =>
	ACCESSIBILITY_CHECKS.find((check) => check.scannerIds.includes(scannerId));

/** DOM id each tile's own detailed FindingsTable section carries. */
export const sectionAnchorId = (key: string): string =>
	`protect-my-site-section-a11y-${key}`;
