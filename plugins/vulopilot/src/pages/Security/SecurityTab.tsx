import { useState } from 'react';
import { __ } from '@wordpress/i18n';
import { applyFilters } from '@wordpress/hooks';
import type { ComponentType } from 'react';
import { ColumnComponent } from '@zyra/components';
import type { FindingsSection } from './SectionedFindingsTab';
import SectionedIssuesTable, {
	SectionedIssuesTab,
} from './SectionedIssuesTable';
import SecurityMockupHeader from './SecurityMockupHeader';
import PluginOverlapCard from './PluginOverlapCard';
import { SECURITY_FINDINGS_SCANNER_IDS } from './securityScannerIds';

/**
 * "Incident Reports" panel - was "Old Security"'s own footer before that tab was removed and
 * folded into this one.
 */
const SecurityIncidentReportsPanel = applyFilters(
	'vulopilot_security_incident_reports_panel',
	null
) as ComponentType | null;

/**
 * The 4 detail sections formerly on "Old Security" (SecurityDetailTab.tsx) - moved here, appended
 * last on this tab.
 */
const SECTIONS: FindingsSection[] = [
	{
		key: 'login-accounts',
		title: __('Login & Accounts', 'vulopilot'),
		description: __(
			'Weak or easily-guessed admin credentials, plus real IPs blocked by Login Protection\'s brute-force lockout.',
			'vulopilot'
		),
		icon: 'user-circle',
		emptyMessage: __(
			'No login/account findings yet - run a scan to check for weak credentials.',
			'vulopilot'
		),
		scannerIds: ['weak-passwords', 'login-protection'],
	},
	{
		key: 'website-exposure',
		title: __('Website Exposure', 'vulopilot'),
		description: __(
			'Anonymous REST API user enumeration, xmlrpc.php, exposed backup/editor files, debug mode, the theme/plugin file editor, and publicly exposed version info.',
			'vulopilot'
		),
		emptyMessage: __(
			'No exposure findings yet - run a scan to check for publicly reachable attack surface.',
			'vulopilot'
		),
		scannerIds: [
			'rest-api',
			'xmlrpc-exposure',
			'exposed-files',
			'debug-mode',
			'file-editor',
		],
		icon: 'eye',
	},
	{
		key: 'browser-protection',
		title: __('Browser Protection', 'vulopilot'),
		description: __(
			'Security response headers - clickjacking, MIME-sniffing, and HTTPS enforcement.',
			'vulopilot'
		),
		emptyMessage: __(
			'No browser-protection findings yet - run a scan to check response headers.',
			'vulopilot'
		),
		scannerIds: ['security-headers'],
		icon: 'privacy',
	},
	{
		key: 'ssl-connection',
		title: __('SSL & Secure Connection', 'vulopilot'),
		description: __('Certificate validity and expiry.', 'vulopilot'),
		emptyMessage: __(
			'No SSL findings yet - run a scan to check certificate status.',
			'vulopilot'
		),
		scannerIds: ['ssl-monitoring'],
		icon: 'lock',
	},
	{
		key: 'malware-intrusion',
		title: __('Malware & Intrusion', 'vulopilot'),
		description: __(
			'Real malware/webshell file detections, plus real requests the Firewall logged or blocked.',
			'vulopilot'
		),
		emptyMessage: __(
			'No malware or firewall findings yet - run a scan to check for infected files and recent request activity.',
			'vulopilot'
		),
		scannerIds: ['malware', 'firewall'],
		icon: 'exclude',
	},
	{
		key: 'vulnerabilities',
		title: __('Vulnerabilities', 'vulopilot'),
		description: __(
			'Known CVEs matched against your installed plugins\' and themes\' exact versions.',
			'vulopilot'
		),
		emptyMessage: __(
			'No vulnerability findings yet - run a scan to check.',
			'vulopilot'
		),
		scannerIds: [
			'basic-vulnerabilities',
			'advanced-vulnerabilities',
			'theme-vulnerabilities',
		],
		icon: 'report',
	},
	{
		key: 'suspicious-file-changes',
		title: __('Suspicious File Changes', 'vulopilot'),
		description: __(
			'Unexpected changes files.',
			'vulopilot'
		),
		emptyMessage: __(
			'No file change findings yet - run a scan to check.',
			'vulopilot'
		),
		scannerIds: ['core-file-integrity', 'integrity-monitoring'],
		icon: 'document',
	},
];

/** DOM anchor id the merged table below carries - what "Review Issues" scrolls to. */
const ISSUES_TABLE_ID = 'protect-my-site-security-issues-table';

/**
 * - Hero/status/tile-grid: SecurityMockupHeader.
 */
const SecurityTab = () => {
	const [activeTab, setActiveTab] = useState<SectionedIssuesTab>('all');

	/** SecurityMetricsGrid's own scanner-backed tiles ("Security Scan"/"SSL"). */
	const goToIssuesTab = (tab: SectionedIssuesTab) => {
		setActiveTab(tab);
		setTimeout(() => {
			const table = document.getElementById(ISSUES_TABLE_ID);
			table?.scrollIntoView({ behavior: 'smooth', block: 'start' });
			// Restart the pulse even when the same tile is clicked twice.
			table?.classList.remove('vulopilot-issues-table-pulse');
			void table?.offsetWidth;
			table?.classList.add('vulopilot-issues-table-pulse');
			setTimeout(
				() => table?.classList.remove('vulopilot-issues-table-pulse'),
				3000
			);
		}, 50);
	};

	return (
		<>
			<ColumnComponent>
				<SecurityMockupHeader
					onViewSection={goToIssuesTab}
				/>
				<SectionedIssuesTable
					id={ISSUES_TABLE_ID}
					title={__('All Security Issues', 'vulopilot')}
					sections={SECTIONS}
					// The 4 named sections below don't cover every real scanner id in
					// SECURITY_FINDINGS_SCANNER_IDS (e.g. core-file-integrity has no dedicated
					// section).
					allScannerIds={SECURITY_FINDINGS_SCANNER_IDS}
					activeTab={activeTab}
					onTabChange={setActiveTab}
				/>
				<PluginOverlapCard category="security" />
				{SecurityIncidentReportsPanel && <SecurityIncidentReportsPanel />}
			</ColumnComponent>
		</>
	);
};

export default SecurityTab;
