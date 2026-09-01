import { __ } from '@wordpress/i18n';
import { createElement } from 'react';
import AccessibilityRestoreDefaultsHeader from './AccessibilityRestoreDefaultsHeader';

/**
 * Settings → Scanning → Accessibility.
 *
 * New tab pulling together 3 fields that previously lived inside Scanning
 * → Security's own shared "Accessibility" section (`enable_wcag_scanner`,
 * `accessibility_audit_frequency`, `target_wcag_level` — moved, not
 * duplicated, same precedent Connections/GoogleServices.ts's own docblock
 * documents for its move out of Scanning), plus one real setting that had
 * no settings-UI exposure anywhere until now:
 *
 * - `enable_accessibility_scanning` — the real, already-wired whole-category
 *   kill switch (ScannerRegistry::get_disabled_categories() reads it) for
 *   all 5 accessibility scanners (AccessibilityScanner, KeyboardAccessibilityScanner,
 *   AriaAttributesScanner, FormLabelsScanner, WcagScanner) — this is the
 *   mockup's "Accessibility checks" master row.
 * - `accessibility_audit_frequency` — real, read by vulopilot-pro's
 *   AccessibilityAuditScheduler, options narrowed to what that scheduler
 *   actually accepts (`disabled`/`hourly`/`daily`/`weekly` — no
 *   `fortnightly`/`monthly`, which don't exist as real cron intervals
 *   anywhere in this codebase, unlike the mockup's own 4-option row).
 * - `target_wcag_level` — previously a fully orphaned UI-only field (no
 *   entry in Utill::VULOPILOT_SETTINGS_DEFAULTS, no PHP consumer at all).
 *   Now has a real, if modest, consumer: Scanners\Basic\AccessibilityScanner
 *   skips itself at the 'A' target (it's this codebase's one check mapping
 *   to a Level AA criterion; the other 4 scanners map to Level A criteria
 *   and stay unconditional). 'AAA' currently behaves identically to 'AA' —
 *   no check here maps to a genuine Level AAA criterion yet, so the option
 *   is offered honestly rather than hidden, with that limitation called
 *   out in its own settingDescription below.
 *
 * "Restore Defaults" is AccessibilityRestoreDefaultsHeader.tsx, wired via
 * this config's own `settingAction` (same migration ContentSearch.ts/
 * AiVisibility.ts/Security.ts already went through — rendered by
 * NavigatorComponent.tsx's renderSettingHeaderInfo(), not Settings.tsx's
 * own currentTab special-case anymore).
 */
export default {
	id: 'accessibility',
	priority: 3,
	headerTitle: __('Accessibility', 'vulopilot'),
	headerDescription: __(
		'These scans help you make your website more accessible for everyone.',
		'vulopilot'
	),
	headerIcon: 'person',
	settingAction: createElement(AccessibilityRestoreDefaultsHeader),
	submitUrl: 'settings',
	modal: [
		{
			key: 'enable_accessibility_scanning',
			type: 'checkbox',
			look: 'toggle',
			label: __('Accessibility checks', 'vulopilot'),
			settingDescription: __(
				'Scan your website for accessibility issues that impact users with disabilities. <br> <a href="?page=vulopilot#&tab=accessibility">View checklist of accessibility tests</a>',
				'vulopilot'
			),
			options: [
				{ key: 'enable_accessibility_scanning', label: '', value: 'enable_accessibility_scanning' },
			],
		},
		{
			key: 'accessibility_audit_frequency',
			label:__('Scan frequency', 'vulopilot'),
			settingDescription: __(
				'Choose how often VuloPilot should scan your website for accessibility issues.',
				'vulopilot'
			),
			type: 'choice-toggle',
			defaultValue: 'daily',
			options: [
				{ key: 'disabled', value: 'disabled', label: __('Off', 'vulopilot'), width: '100%' },
				{ key: 'hourly', value: 'hourly', label: __('Hourly', 'vulopilot'), width: '100%' },
				{ key: 'daily', value: 'daily', label: __('Daily', 'vulopilot'), width: '100%' },
				{ key: 'weekly', value: 'weekly', label: __('Weekly', 'vulopilot'), width: '100%' },
			],
			moduleEnabled: 'accessibility-audits',
		},
		{
			key: 'target_wcag_level',
			type: 'choice-toggle',
			label:__('WCAG level', 'vulopilot'),
			settingDescription: __(
				'Choose how often VuloPilot should scan your website for accessibility issues.',
				'vulopilot'
			),
			defaultValue: '2.1_aa',
			options: [
				{ key: '2.1_a', value: '2.1_a', label: __('A', 'vulopilot'), width: '100%' },
				{ key: '2.1_aa', value: '2.1_aa', label: __('AA', 'vulopilot'), width: '100%' },
				{ key: '2.1_aaa', value: '2.1_aaa', label: __('AAA', 'vulopilot'), width: '100%' },
			],
		},
		{
			key: 'enable_wcag_scanner',
			type: 'checkbox',
			look: 'toggle',
			label: __('Check for generic, out-of-context link text', 'vulopilot'),
			settingDescription: __(
				'Select the Web Content Accessibility Guidelines (WCAG) level for scanning.',
				'vulopilot'
			),
			options: [
				{ key: 'enable_wcag_scanner', label: '', value: 'enable_wcag_scanner' },
			],
		},
		{
			key: 'accessibility-why-notice',
			type: 'notice',
			noticeType: 'info',
			title: __('Why accessibility matters', 'vulopilot'),
			message: __(
				'An accessible website improves user experience, builds trust, and helps you reach a wider audience.',
				'vulopilot'
			),
		},
	],
};
