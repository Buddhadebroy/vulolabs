import { __ } from '@wordpress/i18n';
import { applyFilters } from '@wordpress/hooks';
import type { ComponentType } from 'react';
import { ColumnComponent, ContainerComponent } from '@zyra/components';
import SectionedFindingsTab, { FindingsSection } from './SectionedFindingsTab';
import VulnerabilityHeroCard from './VulnerabilityHeroCard';
import SecurityStatusCard from './SecurityStatusCard';
import SecurityMetricsGrid from './SecurityMetricsGrid';

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

/**
 * Scrolls straight to the "Security Findings" section below (the combined
 * list every other section here rolls up into) rather than a no-op — this
 * tab's own hero card can't switch to "the Security tab" since it's already
 * on it, unlike the identical hero card Overview shows, whose
 * `onNavigateToSecurityTab` switches tabs instead. Same anchor id
 * SectionedFindingsTab.tsx gives every section.
 */
const scrollToSecurityFindings = () => {
	document
		.getElementById('protect-my-site-section-security-findings')
		?.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

/**
 * The mockup's hero summary — "I found N security issues" (Pro's real
 * severity breakdown when licensed, Free's honest open-count fallback
 * otherwise; see VulnerabilityHeroCard's own docblock) alongside the
 * "Security Status" score gauge, then the "What VuloPilot is checking"
 * tile grid — the exact same 3 components Overview's own tab already
 * shows, just without OverviewTab's other Overview-only cards
 * (VulnerabilitiesFoundCard/SecurityOverviewCard/SecurityTrendCard/
 * LiveThreatMonitorCard/RecentActivityCard) since this tab's own sections
 * below already are the full findings list those summarize.
 */
const SecurityTabHeader = () => (
	<>
		<ContainerComponent>
			<ColumnComponent grid={8}>
				<VulnerabilityHeroCard
					onNavigateToSecurityTab={scrollToSecurityFindings}
				/>
			</ColumnComponent>
			<ColumnComponent grid={4}>
				<SecurityStatusCard />
			</ColumnComponent>
		</ContainerComponent>
		<SecurityMetricsGrid />
	</>
);

const SecurityDetailTab = () => (
	<SectionedFindingsTab
		sections={SECTIONS}
		header={<SecurityTabHeader />}
		footer={
			SecurityIncidentReportsPanel && <SecurityIncidentReportsPanel />
		}
	/>
);

export default SecurityDetailTab;
