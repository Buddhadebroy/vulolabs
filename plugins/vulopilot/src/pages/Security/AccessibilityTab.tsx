import { __ } from '@wordpress/i18n';
import { applyFilters } from '@wordpress/hooks';
import type { ComponentType } from 'react';
import SectionedFindingsTab, { FindingsSection } from './SectionedFindingsTab';

/**
 * "Accessibility" tab of "Protect My Site" (PROTECT-MY-SITE.md's IA) — 6
 * sections, each its own scanner_id-scoped FindingsTable, replacing the
 * former single flat `category="accessibility"` table. "Images" and
 * "Readability" deliberately pull in ImagesScanner (category 'images')
 * and ReadabilityScanner (category 'content') — both are genuinely
 * accessibility-relevant checks that happen to be categorized elsewhere
 * for SEO/content-quality reasons, same "filter by scanner_id, not
 * category" reasoning GEO/SeoTab.tsx already established. "Keyboard &
 * Assistive Technology" is the one new scanner this pass adds
 * (KeyboardAccessibilityScanner — positive tabindex, the one keyboard/
 * focus-order issue a static content scan can actually detect; see its
 * own docblock for why a fuller keyboard-trap/focus-visible audit isn't
 * attempted).
 */
const SECTIONS: FindingsSection[] = [
	{
		key: 'images',
		title: __('Images', 'vulopilot'),
		description: __('Images missing alt text.', 'vulopilot'),
		emptyMessage: __(
			'No image findings yet — run a scan to check for missing alt text.',
			'vulopilot'
		),
		scannerIds: ['images'],
	},
	{
		key: 'page-structure',
		title: __('Page Structure', 'vulopilot'),
		description: __(
			'Duplicate/competing top-level headings that confuse screen-reader navigation.',
			'vulopilot'
		),
		emptyMessage: __(
			'No page structure findings yet — run a scan to check heading hierarchy.',
			'vulopilot'
		),
		scannerIds: ['accessibility'],
	},
	{
		key: 'forms',
		title: __('Forms', 'vulopilot'),
		description: __(
			'Form fields with no associated label.',
			'vulopilot'
		),
		emptyMessage: __(
			'No form findings yet — run a scan to check for unlabeled fields.',
			'vulopilot'
		),
		scannerIds: ['form-labels'],
	},
	{
		key: 'links-buttons',
		title: __('Links & Buttons', 'vulopilot'),
		description: __(
			'Interactive elements with no accessible role, and ambiguous link text ("click here").',
			'vulopilot'
		),
		emptyMessage: __(
			'No link/button findings yet — run a scan to check.',
			'vulopilot'
		),
		scannerIds: ['aria-attributes', 'wcag-scanner'],
	},
	{
		key: 'readability',
		title: __('Readability', 'vulopilot'),
		description: __(
			'Content readability score (Flesch Reading Ease).',
			'vulopilot'
		),
		emptyMessage: __(
			'No readability findings yet — run a scan to check.',
			'vulopilot'
		),
		scannerIds: ['readability'],
	},
	{
		key: 'keyboard-assistive-tech',
		title: __('Keyboard & Assistive Technology', 'vulopilot'),
		description: __(
			'Elements with a positive tabindex, which breaks natural keyboard tab order.',
			'vulopilot'
		),
		emptyMessage: __(
			'No keyboard accessibility findings yet — run a scan to check.',
			'vulopilot'
		),
		scannerIds: ['keyboard-accessibility'],
	},
];

const AccessibilityDashboardCard = applyFilters(
	'vulopilot_accessibility_dashboard_card',
	null
) as ComponentType | null;

const AccessibilityHistoryPanel = applyFilters(
	'vulopilot_accessibility_history_panel',
	null
) as ComponentType | null;

const AccessibilityTab = () => (
	<SectionedFindingsTab
		sections={SECTIONS}
		header={AccessibilityDashboardCard && <AccessibilityDashboardCard />}
		footer={AccessibilityHistoryPanel && <AccessibilityHistoryPanel />}
	/>
);

export default AccessibilityTab;
