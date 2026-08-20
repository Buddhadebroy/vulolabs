import { __, sprintf } from '@wordpress/i18n';
import { ButtonInput } from '@zyra/inputs';
import { useSectionStatus } from '../../services/useSectionStatus';
import { useLastScanTime } from '../../services/useLastScanTime';
import { formatWpDate } from '../../services/formatWpDate';
import { SECURITY_FINDINGS_SCANNER_IDS } from './securityScannerIds';
import type { SectionedIssuesTab } from './SectionedIssuesTable';
import MetricTile, { MetricTileGrid } from '../../components/MetricTile/MetricTile';
import './ProtectMySite.scss';

/**
 * Where each of the 7 real (scanner-backed) tiles' "View" button goes —
 * every one of them now has a real matching section on THIS SAME tab's own
 * merged issues table (SectionedIssuesTable.tsx, via `onViewSection`,
 * passed down from SecurityTab.tsx). Used to also carry Accessibility/Site
 * Health/Backups/Recovery, each linking out to a different "Protect My
 * Site" sub-tab — removed per direct instruction: those already have their
 * own dedicated tabs, so showing them a second time here was pure IA
 * duplication, not a genuine security finding this grid should surface.
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

/** Real scanner ids each of the 7 backed tiles' own "last scan" lookup is scoped to — same groupings `badgeFor()` below already uses for their open-findings counts. */
const SCANNER_IDS_BY_TILE_ID: Record<string, string[]> = {
	'security-scan': SECURITY_FINDINGS_SCANNER_IDS,
	malware: ['malware'],
	firewall: ['firewall'],
	'login-protection': ['login-protection'],
	'plugin-vulnerabilities': [
		'basic-vulnerabilities',
		'advanced-vulnerabilities',
		'theme-vulnerabilities',
	],
	'file-changes': ['core-file-integrity', 'integrity-monitoring'],
	ssl: ['ssl-monitoring'],
};

/** Real "last scan: {date} at {time}" line — WP's own configured date format for the date, a plain locale clock time (same technique historyTypes.ts's own rowTime() uses) for the time. */
const formatLastScan = (isoDate: string): string =>
	sprintf(
		/* translators: 1: formatted date, 2: formatted time. */
		__('Last scan: %1$s at %2$s', 'vulopilot'),
		formatWpDate(isoDate),
		new Date(isoDate).toLocaleTimeString(undefined, {
			hour: 'numeric',
			minute: '2-digit',
		})
	);

interface MetricTileData {
	id: string;
	icon: string;
	title: string;
	desc: string;
}

const METRIC_TILES: MetricTileData[] = [
	{
		id: 'security-scan',
		icon: 'security',
		title: __('Security Scan', 'vulopilot'),
		desc: __('Every security-category check, combined.', 'vulopilot'),
	},
	{
		id: 'malware',
		icon: 'error',
		title: __('Malware', 'vulopilot'),
		desc: __('Malware and infection detection.', 'vulopilot'),
	},
	{
		id: 'firewall',
		icon: 'blocks',
		title: __('Firewall', 'vulopilot'),
		desc: __('Web application firewall protection.', 'vulopilot'),
	},
	{
		id: 'login-protection',
		icon: 'vpn-key',
		title: __('Login Protection', 'vulopilot'),
		desc: __('Brute-force and login-attempt protection.', 'vulopilot'),
	},
	{
		id: 'plugin-vulnerabilities',
		icon: 'setting',
		title: __('Vulnerabilities', 'vulopilot'),
		desc: __('Known vulnerabilities in installed plugins and themes.', 'vulopilot'),
	},
	{
		id: 'file-changes',
		icon: 'document',
		title: __('Suspicious File Changes', 'vulopilot'),
		desc: __('Unexpected changes to core/theme/plugin files.', 'vulopilot'),
	},
	{
		id: 'ssl',
		icon: 'lock',
		title: __('SSL', 'vulopilot'),
		desc: __('Certificate validity and expiry.', 'vulopilot'),
	},
];

const NOT_TRACKED_BADGE = {
	text: __('Not tracked yet', 'vulopilot'),
	color: 'indigo',
};

/**
 * The mockup's tile grid — down to 7 tiles (from 11) per direct
 * instruction: Accessibility/Site Health/Backups/Recovery removed
 * (dedicated tabs already cover them, so showing them here too was pure
 * duplication, not a security finding this grid should surface). Every
 * remaining tile is real and scanner-backed. Security Scan (whole
 * 'security' category), Vulnerabilities
 * (`basic-vulnerabilities`/`advanced-vulnerabilities`/`theme-vulnerabilities`
 * — the latter absorbed from the now-removed "Files & Plugins" tab's own
 * "Theme Vulnerabilities" section per direct instruction, one combined
 * tile/section rather than a separate one), Suspicious File
 * Changes (`core-file-integrity`/`integrity-monitoring`), SSL — note
 * category **'ssl'**, not 'security' (`SslMonitoringScanner` registers
 * under its own category; `useSectionStatus` ANDs category+scanner_id
 * server-side, same as FindingsTable, so passing 'security' here would
 * silently return zero results).
 *
 * Malware/Firewall/Login Protection are real, always-on core features
 * (Services\MalwareScanner et al., `classes/Services/`), each with its own
 * companion Scanner (`malware`/`firewall`/`login-protection`) so they slot
 * into this exact same real `useSectionStatus()` badge machinery.
 *
 * Every one of these 7 tiles still carries a real "Last scan" line
 * (`useLastScanTime()`, `GET /scans` scoped to that tile's own scanner
 * group — `SCANNER_IDS_BY_TILE_ID` above) and a real "View" button
 * (`VIEW_TARGET_BY_TILE_ID` above) — same "per-tile View button" pattern
 * Improve Speed's own MetricsGrid.tsx already established.
 */
const SecurityMetricsGrid = ({
	onViewSection,
}: {
	// eslint-disable-next-line no-unused-vars -- named param on a type-only call signature; base no-unused-vars doesn't recognize TS call-signature parameters.
	onViewSection: (tab: SectionedIssuesTab) => void;
}) => {
	const securityScan = useSectionStatus('security', []);
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
	const loginProtection = useSectionStatus('security', ['login-protection']);

	const securityScanLastScan = useLastScanTime(
		SCANNER_IDS_BY_TILE_ID['security-scan']
	);
	const pluginVulnerabilitiesLastScan = useLastScanTime(
		SCANNER_IDS_BY_TILE_ID['plugin-vulnerabilities']
	);
	const fileChangesLastScan = useLastScanTime(
		SCANNER_IDS_BY_TILE_ID['file-changes']
	);
	const sslLastScan = useLastScanTime(SCANNER_IDS_BY_TILE_ID.ssl);
	const malwareLastScan = useLastScanTime(SCANNER_IDS_BY_TILE_ID.malware);
	const firewallLastScan = useLastScanTime(SCANNER_IDS_BY_TILE_ID.firewall);
	const loginProtectionLastScan = useLastScanTime(
		SCANNER_IDS_BY_TILE_ID['login-protection']
	);

	const lastScanByTileId: Record<string, string | null> = {
		'security-scan': securityScanLastScan.lastScanAt,
		'plugin-vulnerabilities': pluginVulnerabilitiesLastScan.lastScanAt,
		'file-changes': fileChangesLastScan.lastScanAt,
		ssl: sslLastScan.lastScanAt,
		malware: malwareLastScan.lastScanAt,
		firewall: firewallLastScan.lastScanAt,
		'login-protection': loginProtectionLastScan.lastScanAt,
	};

	const badgeFor = (id: string) => {
		switch (id) {
			case 'security-scan':
				return (
					securityScan.badge ?? {
						text: __('No open findings', 'vulopilot'),
						color: 'green',
					}
				);
			case 'plugin-vulnerabilities':
				return (
					pluginVulnerabilities.badge ?? {
						text: __('No open findings', 'vulopilot'),
						color: 'green',
					}
				);
			case 'file-changes':
				return (
					fileChanges.badge ?? {
						text: __('No open findings', 'vulopilot'),
						color: 'green',
					}
				);
			case 'ssl':
				return (
					ssl.badge ?? {
						text: __('No open findings', 'vulopilot'),
						color: 'green',
					}
				);
			case 'malware':
				return (
					malware.badge ?? {
						text: __('No open findings', 'vulopilot'),
						color: 'green',
					}
				);
			case 'firewall':
				return (
					firewall.badge ?? {
						text: __('No open findings', 'vulopilot'),
						color: 'green',
					}
				);
			case 'login-protection':
				return (
					loginProtection.badge ?? {
						text: __('No open findings', 'vulopilot'),
						color: 'green',
					}
				);
			default:
				return NOT_TRACKED_BADGE;
		}
	};

	const handleView = (tileId: string) => {
		const target = VIEW_TARGET_BY_TILE_ID[tileId];

		if (target) {
			onViewSection(target.sectionKey);
		}
	};

	return (
		<MetricTileGrid variant="security">
			{METRIC_TILES.map((tile) => {
				const badge = badgeFor(tile.id);
				const lastScanAt = lastScanByTileId[tile.id] ?? null;
				const isTracked = Boolean(VIEW_TARGET_BY_TILE_ID[tile.id]);

				return (
					<MetricTile
						key={tile.id}
						variant="security"
						icon={tile.icon}
						title={tile.title}
						badge={badge}
						footer={
							isTracked && (
								<ButtonInput
									buttons={{
										text: __('View', 'vulopilot'),
										rightIcon: 'pagination-right-arrow',
										color: 'border-purple',
										onClick: () => handleView(tile.id),
									}}
								/>
							)
						}
					>
						<div className="desc">{tile.desc}</div>
						{isTracked && (
							<div className="security-metric-last-scan">
								{lastScanAt
									? formatLastScan(lastScanAt)
									: __('Never scanned yet', 'vulopilot')}
							</div>
						)}
					</MetricTile>
				);
			})}
		</MetricTileGrid>
	);
};

export default SecurityMetricsGrid;
