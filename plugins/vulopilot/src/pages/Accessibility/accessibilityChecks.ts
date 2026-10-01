import { __ } from '@wordpress/i18n';

export interface AccessibilityCheck {
	/** React key, and the tab key SectionedIssuesTable.tsx uses for this check's own tab. */
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
 * The reference mockup's 5-tile "Accessibility Checks" grid.
 */
const REAL_ACCESSIBILITY_CHECKS: AccessibilityCheck[] = [
	{
		key: 'page-structure',
		title: __('Page Structure', 'vulopilot'),
		description: __('Some pages harder to use.', 'vulopilot'),
		scannerIds: ['accessibility'],
		icon: 'editor-list purple',
		color: '#7c3aed',
		emptyMessage: __(
			'No page structure findings yet - run a scan to check heading hierarchy.',
			'vulopilot'
		),
	},
	{
		key: 'images-media',
		title: __('Images & Media', 'vulopilot'),
		description: __(
			'Not all images explained.',
			'vulopilot'
		),
		scannerIds: ['images'],
		icon: 'image green',
		color: '#16a34a',
		emptyMessage: __(
			'No image findings yet - run a scan to check for missing alt text.',
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
		icon: 'link yellow',
		color: '#d97706',
		emptyMessage: __(
			'No link/form findings yet - run a scan to check for unlabeled fields and ambiguous link text.',
			'vulopilot'
		),
	},
	{
		key: 'keyboard-use',
		title: __('Keyboard Use', 'vulopilot'),
		description: __(
			'Some visitors may have trouble.',
			'vulopilot'
		),
		scannerIds: ['keyboard-accessibility'],
		icon: 'coding blue',
		color: '#2563eb',
		emptyMessage: __(
			'No keyboard accessibility findings yet - run a scan to check.',
			'vulopilot'
		),
	},
	{
		key: 'visual-readability',
		title: __('Visual Readability', 'vulopilot'),
		description: __('Some text may be difficult to see.', 'vulopilot'),
		scannerIds: ['readability'],
		icon: 'eye pink',
		color: '#e11d48 ',
		emptyMessage: __(
			'No readability findings yet - run a scan to check.',
			'vulopilot'
		),
	},
];

/** Every real scanner id any of the 5 buckets above covers - the hero card's own combined counts. */
export const ACCESSIBILITY_SCANNER_IDS = REAL_ACCESSIBILITY_CHECKS.flatMap(
	(check) => check.scannerIds
);

/**
 * The 5 real buckets above, plus a 6th synthetic `'all'` tile.
 */
export const ACCESSIBILITY_CHECKS: AccessibilityCheck[] = [
	...REAL_ACCESSIBILITY_CHECKS,
	{
		key: 'all',
		title: __('All Checks', 'vulopilot'),
		description: __(
			'Every accessibility check, combined.',
			'vulopilot'
		),
		scannerIds: ACCESSIBILITY_SCANNER_IDS,
		icon: 'security lime',
		color: '#65a30d',
		emptyMessage: __(
			'No accessibility findings yet - run a scan to check everything at once.',
			'vulopilot'
		),
	},
];
