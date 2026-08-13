/* global appLocalizer */
import { __ } from '@wordpress/i18n';
import { applyFilters } from '@wordpress/hooks';
import type { ComponentType } from 'react';
import { CardComponent, ColumnComponent, ContainerComponent } from '@zyra/components';
import FindingsTable from '../../components/FindingsTable';
import type { FindingsSection } from './SectionedFindingsTab';
import SecurityMockupHeader from './SecurityMockupHeader';
import IssuesNeedAttentionCard from './IssuesNeedAttentionCard';
import VulnerabilitiesFoundCard from './VulnerabilitiesFoundCard';
import LiveThreatMonitorCard from './LiveThreatMonitorCard';
import RecentActivityCard from './RecentActivityCard';
import SecurityTrendCard from './SecurityTrendCard';

/**
 * SECURITY-MODULE.md's "Incident Reports" panel — was "Old Security"'s
 * own footer before that tab was removed and folded into this one; same
 * real slot, just rendered here now, after every section.
 */
const SecurityIncidentReportsPanel = applyFilters(
	'vulopilot_security_incident_reports_panel',
	null
) as ComponentType | null;

/** Anchor id the hero card's "Review Issues First" button scrolls to. */
const ISSUES_SECTION_ID = 'classic-security-issues';

/**
 * Every scanner id "Security Findings" below rolls up (rather than
 * `category="security"` alone, so it doesn't silently drop
 * RestApiScanner's findings — its own category is `rest-api`, not
 * `security`, see that scanner's own docblock). Also what
 * IssuesNeedAttentionCard's own condensed top-5 list scopes to, above.
 */
const SECURITY_FINDINGS_SCANNER_IDS = [
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
];

/**
 * The 5 detail sections formerly on "Old Security" (SecurityDetailTab.tsx)
 * — moved here, appended last on this tab, per direct instruction. Same
 * scanner_id groupings that tab always used.
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
		scannerIds: SECURITY_FINDINGS_SCANNER_IDS,
	},
];

/** DOM id prefix every section below already carries (`protect-my-site-section-{key}`). */
const SECTION_ANCHOR_PREFIX = 'protect-my-site-section-';

/**
 * scanner id → the specific section (above) it belongs to, for
 * VulnerabilitiesFoundCard's own row-click scroll-and-highlight — built
 * from the same 4 specific SECTIONS entries (excluding the last,
 * catch-all "Security Findings" section, so a scanner id resolves to its
 * own specific section rather than always the combined one).
 */
const SECURITY_SECTION_MAP: Record<string, string> = SECTIONS.filter(
	(section) => section.key !== 'security-findings'
).reduce(
	(map, section) => {
		section.scannerIds.forEach((scannerId) => {
			map[scannerId] = section.key;
		});
		return map;
	},
	{} as Record<string, string>
);

/**
 * "Security" tab of "Protect My Site" — the mockup's own single-page
 * design (hero + status, "What VuloPilot is checking", one combined
 * issues list, a 3-panel footer row, then the 5 detail sections appended
 * last). This page briefly also had a second, "Old Security" tab (a
 * sectioned-IA redesign of the same underlying findings) — it's been
 * removed and its 5 sections + the Pro incident-reports panel folded
 * back into this one tab per direct instruction, so this is once again
 * the sole "Security" tab. Every piece here is a real, already-built
 * component reused as-is — nothing new is fabricated to chase the
 * reference image's specific numbers:
 *
 * - Hero/status/tile-grid: SecurityMockupHeader.
 * - "Issues that need your attention": IssuesNeedAttentionCard, built to
 *   match the reference image's own row anatomy exactly.
 * - "Vulnerabilities Found": VulnerabilitiesFoundCard — was the (now
 *   removed) Overview tab's own card, moved here rather than deleted, per
 *   direct instruction. Scoped to SECURITY_FINDINGS_SCANNER_IDS and wired
 *   to SECURITY_SECTION_MAP so a row click scrolls straight to that
 *   finding's own section below, same page.
 * - Footer row: LiveThreatMonitorCard ("Protection Status" in the
 *   reference image), RecentActivityCard ("Recent Security Activity"),
 *   SecurityTrendCard ("Security Trend", honestly untracked).
 * - Detail sections: same `layout="compact"` FindingsTable rows every
 *   other section on this page already uses, each its own scanner_id-
 *   scoped table — not wrapped in SectionedFindingsTab.tsx itself since
 *   that component owns its own top-level `ContainerComponent general`,
 *   which would double the page's own top margin nested inside this
 *   tab's already-existing one.
 */
const ClassicSecurityTab = () => (
	<ContainerComponent general>
		<ColumnComponent>
			<SecurityMockupHeader scrollTargetId={ISSUES_SECTION_ID} />
			<IssuesNeedAttentionCard
				id={ISSUES_SECTION_ID}
				scannerIds={SECURITY_FINDINGS_SCANNER_IDS}
				// The "Security Findings" section appended below already
				// lists every one of these same scanner ids' findings in
				// full, with search/filters/pagination — the real "view
				// everything" destination for this card's condensed top-5.
				onViewAll={() =>
					document
						.getElementById(
							'protect-my-site-section-security-findings'
						)
						?.scrollIntoView({ behavior: 'smooth', block: 'start' })
				}
			/>
			<ContainerComponent>
				<VulnerabilitiesFoundCard
					scannerIds={SECURITY_FINDINGS_SCANNER_IDS}
					sectionMap={SECURITY_SECTION_MAP}
					anchorPrefix={SECTION_ANCHOR_PREFIX}
					fallbackSection="security-findings"
				/>
			</ContainerComponent>
			<ContainerComponent>
				<ColumnComponent grid={4}>
					<LiveThreatMonitorCard />
				</ColumnComponent>
				<ColumnComponent grid={4}>
					<RecentActivityCard />
				</ColumnComponent>
				<ColumnComponent grid={4}>
					<SecurityTrendCard />
				</ColumnComponent>
			</ContainerComponent>
			{SECTIONS.map((section) => (
				<CardComponent
					key={section.key}
					id={`protect-my-site-section-${section.key}`}
					title={section.title}
					desc={section.description}
				>
					<FindingsTable
						title={section.title}
						description={section.emptyMessage}
						scannerIds={section.scannerIds}
						layout="compact"
					/>
				</CardComponent>
			))}
			{SecurityIncidentReportsPanel && <SecurityIncidentReportsPanel />}
		</ColumnComponent>
	</ContainerComponent>
);

export default ClassicSecurityTab;
