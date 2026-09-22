import { __ } from '@wordpress/i18n';
import { ListComponent, BadgeComponent , CardComponent} from '@zyra/components';
import { useSectionStatus } from '../../services/useSectionStatus';
import { SECURITY_FINDINGS_SCANNER_IDS } from './securityScannerIds';
import type { SectionedIssuesTab } from './SectionedIssuesTable';
import './ProtectMySite.scss';

/**
 * Where each of the 7 real (scanner-backed) tiles' row click goes — every
 * one of them now has a real matching section on THIS SAME tab's own
 * merged issues table (SectionedIssuesTable.tsx, via `onViewSection`,
 * passed down from SecurityTab.tsx). Used to also carry Accessibility/Site
 * Health/Backups/Recovery, each linking out to a different "Protect My
 * Site" sub-tab — removed per direct instruction: those already have their
 * own dedicated tabs, so showing them a second time here was pure IA
 * duplication, not a genuine security finding this list should surface.
 * "Plugin Vulnerabilities"/"File Changes" used to link out to Files &
 * Plugins the same way — now real in-tab sections instead
 * ('vulnerabilities'/'suspicious-file-changes'), since those findings moved
 * onto this tab's own issues table (SecurityTab.tsx's own docblock).
 */
const VIEW_TARGET_BY_TILE_ID: Record<
	string,
	{ type: 'section'; sectionKey: SectionedIssuesTab }
> = {
	'security-scan': { type: 'section', sectionKey: 'all' },
	ssl: { type: 'section', sectionKey: 'ssl-connection' },
	malware: { type: 'section', sectionKey: 'malware-intrusion' },
	firewall: { type: 'section', sectionKey: 'malware-intrusion' },
	'login-protection': { type: 'section', sectionKey: 'login-accounts' },
	'plugin-vulnerabilities': { type: 'section', sectionKey: 'vulnerabilities' },
	'file-changes': { type: 'section', sectionKey: 'suspicious-file-changes' },
};

interface MetricTileData {
	id: string;
	icon: string;
	title: string;
	desc: string;
}

const METRIC_TILES: MetricTileData[] = [
	{
		id: 'security-scan',
		icon: 'security violet',
		title: __('Security Scan', 'vulopilot'),
		desc: __('Every security-category check, combined.', 'vulopilot'),
	},
	{
		id: 'malware',
		icon: 'error red',
		title: __('Malware', 'vulopilot'),
		desc: __('Malware and infection detection.', 'vulopilot'),
	},
	{
		id: 'firewall',
		icon: 'blocks orange',
		title: __('Firewall', 'vulopilot'),
		desc: __('Web application firewall protection.', 'vulopilot'),
	},
	{
		id: 'login-protection',
		icon: 'vpn-key indigo',
		title: __('Login Protection', 'vulopilot'),
		desc: __('Brute-force and login-attempt protection.', 'vulopilot'),
	},
	{
		id: 'plugin-vulnerabilities',
		icon: 'setting yellow',
		title: __('Vulnerabilities', 'vulopilot'),
		desc: __('Known vulnerabilities in installed plugins and themes.', 'vulopilot'),
	},
	{
		id: 'file-changes',
		icon: 'document blue',
		title: __('Suspicious File Changes', 'vulopilot'),
		desc: __('Unexpected changes files.', 'vulopilot'),
	},
	{
		id: 'ssl',
		icon: 'lock green',
		title: __('SSL', 'vulopilot'),
		desc: __('Certificate validity and expiry.', 'vulopilot'),
	},
];

const NOT_TRACKED_BADGES = [
	{ text: __('Not tracked yet', 'vulopilot'), color: 'indigo' },
];

/**
 * The mockup's tile grid — converted from a `MetricTileComponent` grid to
 * the same real per-section `ListComponent` row shape
 * SiteHealthStatusCard.tsx's own list already uses (icon + title + desc on
 * the left, 2 real separate badges — total open + top-severity breakdown,
 * `useSectionStatus()`'s own `badges` array — on the right), per direct
 * instruction to match that same structure. Down to 7 rows (from 11) per
 * earlier direct instruction: Accessibility/Site Health/Backups/Recovery
 * removed (dedicated tabs already cover them, so showing them here too was
 * pure duplication, not a security finding this list should surface).
 * Every remaining row is real and scanner-backed. Security Scan (whole
 * 'security' category), Vulnerabilities
 * (`basic-vulnerabilities`/`advanced-vulnerabilities`/`theme-vulnerabilities`
 * — the latter absorbed from the now-removed "Files & Plugins" tab's own
 * "Theme Vulnerabilities" section per direct instruction, one combined
 * row rather than a separate one), Suspicious File Changes
 * (`core-file-integrity`/`integrity-monitoring`), SSL — note category
 * **'ssl'**, not 'security' (`SslMonitoringScanner` registers under its own
 * category; `useSectionStatus` ANDs category+scanner_id server-side, same
 * as FindingsTable, so passing 'security' here would silently return zero
 * results).
 *
 * Malware/Firewall/Login Protection are real, always-on core features
 * (Services\MalwareScanner et al., `classes/Services/`), each with its own
 * companion Scanner (`malware`/`firewall`/`login-protection`) so they slot
 * into this exact same real `useSectionStatus()` badge machinery.
 *
 * Clicking a row (`ListComponent`'s own `action`) jumps to that row's own
 * section on this same tab's merged issues table (`VIEW_TARGET_BY_TILE_ID`
 * above), same destination the old tile grid's badge-click used — rows
 * with no matching section (none currently) render without an `action`, so
 * they're not clickable.
 */
const SecurityMetricsGrid = ({
	onViewSection,
}: {
	// eslint-disable-next-line no-unused-vars -- named param on a type-only call signature; base no-unused-vars doesn't recognize TS call-signature parameters.
	onViewSection: (tab: SectionedIssuesTab) => void;
}) => {
	// No category filter: "All" in the issues table also includes SSL (category 'ssl'), so this row must too or the two counts disagree.
	const securityScan = useSectionStatus('', SECURITY_FINDINGS_SCANNER_IDS);
	const pluginVulnerabilities = useSectionStatus('security', [
		'basic-vulnerabilities',
		'advanced-vulnerabilities',
		'theme-vulnerabilities',
	]);
	const fileChanges = useSectionStatus('security', [
		'core-file-integrity',
		'integrity-monitoring',
	]);
	const ssl = useSectionStatus('ssl', ['ssl-monitoring']);
	const malware = useSectionStatus('security', ['malware']);
	const firewall = useSectionStatus('security', ['firewall']);
	// Same 2 scanners the issues table's "Login & Accounts" section counts.
	const loginProtection = useSectionStatus('security', [
		'weak-passwords',
		'login-protection',
	]);

	const badgesFor = (id: string) => {
		switch (id) {
			case 'security-scan':
				return securityScan.badges;
			case 'plugin-vulnerabilities':
				return pluginVulnerabilities.badges;
			case 'file-changes':
				return fileChanges.badges;
			case 'ssl':
				return ssl.badges;
			case 'malware':
				return malware.badges;
			case 'firewall':
				return firewall.badges;
			case 'login-protection':
				return loginProtection.badges;
			default:
				return NOT_TRACKED_BADGES;
		}
	};

	const handleView = (tileId: string) => {
		const target = VIEW_TARGET_BY_TILE_ID[tileId];

		if (target) {
			onViewSection(target.sectionKey);
		}
	};

	return (
		<>
		<ListComponent
			className="mini-card report list"
			items={METRIC_TILES.map((tile) => {
				const isTracked = Boolean(VIEW_TARGET_BY_TILE_ID[tile.id]);
				const badges = badgesFor(tile.id);

				// 2 real badges (total open + top-severity breakdown) split
				// one after the title, one on the row's far right — same
				// `titleTag`/`tags` split HistoryDetailPanel.tsx's own
				// `ListComponent` rows already use for this. A single-badge
				// row ("No open findings"/plain "N Open" — nothing to
				// split) keeps its one badge on the right only.
				const [rightBadge, titleBadge] = badges ?? [];

				return {
					id: tile.id,
					icon: tile.icon,
					title: tile.title,
					titleTag: titleBadge ? (
						<BadgeComponent
							color={titleBadge.color}
							text={titleBadge.text}
						/>
					) : null,
					desc: tile.desc,
					action: isTracked ? () => handleView(tile.id) : undefined,
					tags: rightBadge ? (
						<BadgeComponent
							color={rightBadge.color}
							text={rightBadge.text}
						/>
					) : null,
				};
			})}
		/>
		</>
	);
};

export default SecurityMetricsGrid;
