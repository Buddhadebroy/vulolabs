/* global appLocalizer */
import { useState } from 'react';
import { __ } from '@wordpress/i18n';
import { applyFilters } from '@wordpress/hooks';
import type { ComponentType } from 'react';
import { ColumnComponent, ContainerComponent } from '@zyra/components';
import type { FindingsSection } from './SectionedFindingsTab';
import SectionedIssuesTable, {
	SectionedIssuesTab,
} from './SectionedIssuesTable';
import SecurityMockupHeader from './SecurityMockupHeader';
import PluginOverlapCard from './PluginOverlapCard';
import BackupProtectionNotice from './BackupProtectionNotice';
import { SECURITY_FINDINGS_SCANNER_IDS } from './securityScannerIds';

/**
 * SECURITY-MODULE.md's "Incident Reports" panel — was "Old Security"'s
 * own footer before that tab was removed and folded into this one; same
 * real slot, just rendered here now, after every section.
 */
const SecurityIncidentReportsPanel = applyFilters(
	'vulopilot_security_incident_reports_panel',
	null
) as ComponentType | null;

/**
 * The 4 detail sections formerly on "Old Security" (SecurityDetailTab.tsx)
 * — moved here, appended last on this tab, per direct instruction. Same
 * scanner_id groupings that tab always used. The 5th, catch-all "Security
 * Findings" section (every one of these scanner ids, combined, plus file
 * integrity and known plugin/theme vulnerabilities) no longer needs its
 * own entry here — SectionedIssuesTable.tsx's own "All" tab already covers
 * exactly the same scope (SECURITY_FINDINGS_SCANNER_IDS), so a separate,
 * identically-scoped section would just be a second "All" under a
 * different label.
 *
 * "Vulnerabilities"/"Suspicious File Changes" (2 more sections, appended
 * last) moved here from the now-removed "Files & Plugins" tab per direct
 * instruction — Security owns these findings now rather than splitting
 * them across tabs. Same scanner ids as that tab's former "Plugin
 * Vulnerabilities"/"File Integrity"/"Recent File Changes" sections,
 * already counted in `SECURITY_FINDINGS_SCANNER_IDS` before this move (so
 * "All" never undercounted them), just without a named section here until
 * now. "Vulnerabilities" also absorbed that tab's former "Theme
 * Vulnerabilities" section (`theme-vulnerabilities` added to this
 * section's own scannerIds) rather than getting a separate section of its
 * own — one real "Vulnerabilities" tile/section covering both plugin and
 * theme CVEs, matching the generic (not "Plugin"-qualified) name this
 * section and its matching tile in SecurityMetricsGrid.tsx already used.
 * "Outdated Software", that tab's 5th section, wasn't moved anywhere —
 * it shared its scanner id with Site Health's own "Updates" section
 * (SiteHealthTab.tsx), which already covers the exact same finding.
 */
const SECTIONS: FindingsSection[] = [
	{
		key: 'login-accounts',
		title: __('Login & Accounts', 'vulopilot'),
		description: __(
			'Weak or easily-guessed admin credentials, plus real IPs blocked by Login Protection\'s brute-force lockout.',
			'vulopilot'
		),
		emptyMessage: __(
			'No login/account findings yet — run a scan to check for weak credentials.',
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
			'No exposure findings yet — run a scan to check for publicly reachable attack surface.',
			'vulopilot'
		),
		scannerIds: [
			'rest-api',
			'xmlrpc-exposure',
			'exposed-files',
			'debug-mode',
			'file-editor',
			'basic-vulnerabilities',
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
		key: 'malware-intrusion',
		title: __('Malware & Intrusion', 'vulopilot'),
		description: __(
			'Real malware/webshell file detections, plus real requests the Firewall logged or blocked.',
			'vulopilot'
		),
		emptyMessage: __(
			'No malware or firewall findings yet — run a scan to check for infected files and recent request activity.',
			'vulopilot'
		),
		scannerIds: ['malware', 'firewall'],
	},
	{
		key: 'vulnerabilities',
		title: __('Vulnerabilities', 'vulopilot'),
		description: __(
			'Known CVEs matched against your installed plugins\' and themes\' exact versions.',
			'vulopilot'
		),
		emptyMessage: __(
			'No vulnerability findings yet — run a scan to check.',
			'vulopilot'
		),
		scannerIds: ['advanced-vulnerabilities', 'theme-vulnerabilities'],
	},
	{
		key: 'suspicious-file-changes',
		title: __('Suspicious File Changes', 'vulopilot'),
		description: __(
			'Unexpected changes to core/theme/plugin files.',
			'vulopilot'
		),
		emptyMessage: __(
			'No file change findings yet — run a scan to check.',
			'vulopilot'
		),
		scannerIds: ['core-file-integrity', 'integrity-monitoring'],
	},
];

/** DOM anchor id the merged table below carries — what "Review Issues" scrolls to. */
const ISSUES_TABLE_ID = 'protect-my-site-security-issues-table';

/**
 * "Security" tab of "Protect My Site" — the mockup's own single-page
 * design (hero + status, then one real, unified findings table). This
 * page briefly also had a second, "Old Security" tab (a sectioned-IA
 * redesign of the same underlying findings) — it's been removed and its
 * sections + the Pro incident-reports panel folded back into this one tab
 * per direct instruction, so this is once again the sole "Security" tab.
 * Every piece here is a real, already-built component reused as-is —
 * nothing new is fabricated to chase the reference image's specific
 * numbers:
 *
 * - Hero/status/tile-grid: SecurityMockupHeader. RecentActivityCard
 *   ("Recent Security Activity") and SecurityTrendCard ("Security
 *   Trend", honestly untracked) live inside that same component,
 *   stacked one after another directly below "Security Status" in its
 *   own narrow sidebar column — per direct instruction, not a separate
 *   full-width 3-column row on this tab. Its own "Review Issues First"
 *   button now scrolls straight to the issues table below (`ISSUES_TABLE_ID`)
 *   — previously scrolled to "Issues that need your attention"
 *   (IssuesNeedAttentionCard), removed per direct instruction.
 * - Issues table: one real SectionedIssuesTable (All/Important/Login &
 *   Accounts/Website Exposure/Browser Protection/SSL & Secure Connection),
 *   replacing what used to be 5 separate `layout="compact"` FindingsTable
 *   cards stacked here — same merge pattern WooCommerce's own "All
 *   WooCommerce Issues" already established, per direct instruction to
 *   apply it here too.
 * - Closes with BackupProtectionNotice (a single real
 *   "Backup protection: Enabled/Not enabled" status line + a link to the
 *   real Backups tab, `GET /settings`'s own `enable_automatic_backups`)
 *   then PluginOverlapCard filtered to `category="security"` —
 *   real cross-sell (Wordfence/Sucuri/Solid Security/AIOS active →
 *   VuloPilot's own Security Watchtower) surfaced in the tab a user
 *   reading about security is already on. BackupProtectionNotice
 *   deliberately isn't another full feature card — backup management
 *   already has a real home (the Backups tab) and configuration already
 *   has a real home (Settings → Scanning → Backups); this tab only needs
 *   to say whether protection is on, per direct instruction.
 */
const SecurityTab = () => {
	const [activeTab, setActiveTab] = useState<SectionedIssuesTab>('all');

	/** SecurityMetricsGrid's own scanner-backed tiles ("Security Scan"/"SSL") — switches the merged issues table below to that tile's own section and scrolls to it, same "controlled activeTab passed down" shape MetricsGrid.tsx's own View buttons use on Improve Speed. */
	const goToIssuesTab = (tab: SectionedIssuesTab) => {
		setActiveTab(tab);
		setTimeout(
			() =>
				document
					.getElementById(ISSUES_TABLE_ID)
					?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
			50
		);
	};

	return (
		<ContainerComponent>
			<ColumnComponent>
				<SecurityMockupHeader
					scrollTargetId={ISSUES_TABLE_ID}
					onViewSection={goToIssuesTab}
				/>
				<SectionedIssuesTable
					id={ISSUES_TABLE_ID}
					title={__('All Security Issues', 'vulopilot')}
					sections={SECTIONS}
					// The 4 named sections below don't cover every real
					// scanner id in SECURITY_FINDINGS_SCANNER_IDS (e.g.
					// core-file-integrity has no dedicated section) —
					// without this, "All" would silently undercount, same
					// catch-all scope the removed "Security Findings"
					// section used to guarantee.
					allScannerIds={SECURITY_FINDINGS_SCANNER_IDS}
					activeTab={activeTab}
					onTabChange={setActiveTab}
				/>
				<BackupProtectionNotice />
				<PluginOverlapCard category="security" />
				{SecurityIncidentReportsPanel && <SecurityIncidentReportsPanel />}
			</ColumnComponent>
		</ContainerComponent>
	);
};

export default SecurityTab;
