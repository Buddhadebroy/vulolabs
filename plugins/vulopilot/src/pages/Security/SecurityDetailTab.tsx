import { __ } from '@wordpress/i18n';
import { applyFilters } from '@wordpress/hooks';
import type { ComponentType } from 'react';
import SectionedFindingsTab, { FindingsSection } from './SectionedFindingsTab';

/**
 * "Security" tab of "Protect My Site" (PROTECT-MY-SITE.md's IA) — 5
 * sections, each its own scanner_id-scoped FindingsTable via
 * SectionedFindingsTab. "Security Findings" deliberately lists every
 * scanner id from the 4 sections above it combined (rather than
 * `category="security"` alone) so it doesn't silently drop RestApiScanner's
 * findings — its own category is `rest-api`, not `security` (see that
 * scanner's own docblock) — same "filter by scanner_id, not category"
 * reasoning GEO/SeoTab.tsx already established for the identical
 * mixed-category problem.
 */
const SECTIONS: FindingsSection[] = [
	{
		key: 'login-accounts',
		title: __('Login & Accounts', 'vulopilot'),
		description: __(
			'Weak or easily-guessed admin credentials.',
			'vulopilot'
		),
		emptyMessage: __(
			'No login/account findings yet — run a scan to check for weak credentials.',
			'vulopilot'
		),
		scannerIds: ['weak-passwords'],
	},
	{
		key: 'website-exposure',
		title: __('Website Exposure', 'vulopilot'),
		description: __(
			'Anonymous REST API user enumeration, xmlrpc.php, exposed backup/editor files, debug mode, and the theme/plugin file editor.',
			'vulopilot'
		),
		emptyMessage: __(
			'No exposure findings yet — run a scan to check for publicly reachable attack surface.',
			'vulopilot'
		),
		scannerIds: [
			'rest-api',
			'xmlrpc-exposure',
			'exposed-files',
			'debug-mode',
			'file-editor',
		],
	},
	{
		key: 'browser-protection',
		title: __('Browser Protection', 'vulopilot'),
		description: __(
			'Security response headers — clickjacking, MIME-sniffing, and HTTPS enforcement.',
			'vulopilot'
		),
		emptyMessage: __(
			'No browser-protection findings yet — run a scan to check response headers.',
			'vulopilot'
		),
		scannerIds: ['security-headers'],
	},
	{
		key: 'ssl-connection',
		title: __('SSL & Secure Connection', 'vulopilot'),
		description: __('Certificate validity and expiry.', 'vulopilot'),
		emptyMessage: __(
			'No SSL findings yet — run a scan to check certificate status.',
			'vulopilot'
		),
		scannerIds: ['ssl-monitoring'],
	},
	{
		key: 'security-findings',
		title: __('Security Findings', 'vulopilot'),
		description: __(
			'Every check above, combined, plus file integrity and known plugin/theme vulnerabilities.',
			'vulopilot'
		),
		emptyMessage: __(
			'No security findings yet — run a scan to check for hardening and exposure issues.',
			'vulopilot'
		),
		scannerIds: [
			'weak-passwords',
			'rest-api',
			'xmlrpc-exposure',
			'exposed-files',
			'debug-mode',
			'file-editor',
			'security-headers',
			'security',
			'ssl-monitoring',
			'core-file-integrity',
			'integrity-monitoring',
			'basic-vulnerabilities',
			'advanced-vulnerabilities',
			'theme-vulnerabilities',
		],
	},
];

/**
 * SECURITY-MODULE.md's "Incident Reports" panel — same slot the former
 * flat Security tab used, still real and still worth surfacing here.
 */
const SecurityIncidentReportsPanel = applyFilters(
	'vulopilot_security_incident_reports_panel',
	null
) as ComponentType | null;

const SecurityDetailTab = () => (
	<SectionedFindingsTab
		sections={SECTIONS}
		footer={
			SecurityIncidentReportsPanel && <SecurityIncidentReportsPanel />
		}
	/>
);

export default SecurityDetailTab;
