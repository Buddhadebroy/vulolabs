/* global appLocalizer */
import { useEffect, useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { getApiLink, getApiResponse } from '@zyra/core';
import { ButtonInput } from '@zyra/inputs';
import { useSectionStatus } from '../../services/useSectionStatus';
import { useLastScanTime } from '../../services/useLastScanTime';
import { formatWpDate } from '../../services/formatWpDate';
import { ACCESSIBILITY_SCANNER_IDS } from './accessibilityChecks';
import { SECURITY_FINDINGS_SCANNER_IDS } from './securityScannerIds';
import type { SectionedIssuesTab } from './SectionedIssuesTable';
import MetricTile, { MetricTileGrid } from '../../components/MetricTile/MetricTile';
import './ProtectMySite.scss';

/**
 * Where each of the 11 real (scanner-backed) tiles' "View" button goes.
 * "Security Scan"/"SSL"/"Malware"/"Firewall"/"Login Protection" have a real
 * matching section on THIS SAME tab's own merged issues table
 * (SectionedIssuesTable.tsx, via `onViewSection`, passed down from
 * SecurityTab.tsx) — the rest live on a different "Protect My Site" sub-tab
 * entirely (Files & Plugins/Accessibility/Site Health/Backups), so those
 * jump there via a real full-page navigation, same
 * `?page=vulopilot#&tab=security&subtab=<tab>` convention
 * getCategoryTabLink.ts/Security.tsx's own docblock already establish —
 * not a local map there since these aren't finding categories, they're this
 * grid's own tile ids. "Recovery" reuses the same Backups tab link as
 * "Backups" — Recovery's own restore points are just that same tab's real
 * `vulopilot_backups` rows, not a separate page.
 */
const VIEW_TARGET_BY_TILE_ID: Record<
	string,
	{ type: 'section'; sectionKey: SectionedIssuesTab } | { type: 'link'; href: string }
> = {
	'security-scan': { type: 'section', sectionKey: 'all' },
	ssl: { type: 'section', sectionKey: 'ssl-connection' },
	malware: { type: 'section', sectionKey: 'malware-intrusion' },
	firewall: { type: 'section', sectionKey: 'malware-intrusion' },
	'login-protection': { type: 'section', sectionKey: 'login-accounts' },
	'plugin-vulnerabilities': {
		type: 'link',
		href: '?page=vulopilot#&tab=security&subtab=files-plugins',
	},
	'file-changes': {
		type: 'link',
		href: '?page=vulopilot#&tab=security&subtab=files-plugins',
	},
	accessibility: {
		type: 'link',
		href: '?page=vulopilot#&tab=security&subtab=accessibility',
	},
	'site-health': {
		type: 'link',
		href: '?page=vulopilot#&tab=security&subtab=site-health',
	},
	backups: {
		type: 'link',
		href: '?page=vulopilot#&tab=security&subtab=backups',
	},
	recovery: {
		type: 'link',
		href: '?page=vulopilot#&tab=security&subtab=backups',
	},
};

/** Real scanner ids each of the 11 backed tiles' own "last scan" lookup is scoped to — same groupings `badgeFor()` below already uses for their open-findings counts, `site-health` omitted (site-wide, no filter). `recovery` reuses `backups`' own `backup-health` scan group — they're the same underlying data, just two different tiles/entry points into it. */
const SCANNER_IDS_BY_TILE_ID: Record<string, string[]> = {
	'security-scan': SECURITY_FINDINGS_SCANNER_IDS,
	malware: ['malware'],
	firewall: ['firewall'],
	'login-protection': ['login-protection'],
	'plugin-vulnerabilities': ['basic-vulnerabilities', 'advanced-vulnerabilities'],
	'file-changes': ['core-file-integrity', 'integrity-monitoring'],
	ssl: ['ssl-monitoring'],
	accessibility: ACCESSIBILITY_SCANNER_IDS,
	backups: ['backup-health'],
	recovery: ['backup-health'],
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

interface MetricTile {
	id: string;
	icon: string;
	title: string;
	desc: string;
}

const METRIC_TILES: MetricTile[] = [
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
		title: __('Plugin Vulnerabilities', 'vulopilot'),
		desc: __('Known vulnerabilities in installed plugins.', 'vulopilot'),
	},
	{
		id: 'file-changes',
		icon: 'document',
		title: __('File Changes', 'vulopilot'),
		desc: __('Unexpected changes to core/theme/plugin files.', 'vulopilot'),
	},
	{
		id: 'ssl',
		icon: 'lock',
		title: __('SSL', 'vulopilot'),
		desc: __('Certificate validity and expiry.', 'vulopilot'),
	},
	{
		id: 'backups',
		icon: 'cloud-upload',
		title: __('Backups', 'vulopilot'),
		desc: __('Automatic site backups.', 'vulopilot'),
	},
	{
		id: 'recovery',
		icon: 'recycle',
		title: __('Recovery', 'vulopilot'),
		desc: __('Restore points to recover your site.', 'vulopilot'),
	},
	{
		id: 'accessibility',
		icon: 'support',
		title: __('Accessibility', 'vulopilot'),
		desc: __('Heading structure, ARIA, and form labels.', 'vulopilot'),
	},
	{
		id: 'site-health',
		icon: 'analytics',
		title: __('Site Health', 'vulopilot'),
		desc: __('Overall site health, across every category.', 'vulopilot'),
	},
];

const NOT_TRACKED_BADGE = {
	text: __('Not tracked yet', 'vulopilot'),
	color: 'indigo',
};

const getHealthRating = (score: number): { text: string; color: string } => {
	if (score >= 90) {
		return { text: __('Excellent', 'vulopilot'), color: 'green' };
	}
	if (score >= 70) {
		return { text: __('Good', 'vulopilot'), color: 'green' };
	}
	if (score >= 50) {
		return { text: __('Fair', 'vulopilot'), color: 'orange' };
	}
	return { text: __('Needs work', 'vulopilot'), color: 'red' };
};

/**
 * The mockup's 11-tile grid — every tile is now real and scanner-backed.
 * Security Scan (whole 'security' category), Plugin Vulnerabilities
 * (`basic-vulnerabilities`/`advanced-vulnerabilities`), File Changes
 * (`core-file-integrity`/`integrity-monitoring`), SSL — note category
 * **'ssl'**, not 'security' (`SslMonitoringScanner` registers under its
 * own category; `useSectionStatus` ANDs category+scanner_id server-side,
 * same as FindingsTable, so passing 'security' here would silently return
 * zero results), Accessibility (whole 'accessibility' category), and Site
 * Health (`overall_score` from `GET /dashboard` — the all-categories
 * combined score `Health.tsx` shows, deliberately different from the
 * `category_scores.security` number the donut below already shows).
 *
 * Malware/Firewall/Login Protection/Backups/Recovery — previously "Not
 * tracked yet" — are now real, always-on core features
 * (Services\MalwareScanner et al., `classes/Services/`), each with its own
 * companion Scanner (`malware`/`firewall`/`login-protection`/
 * `backup-health`) so they slot into this exact same real
 * `useSectionStatus()` badge machinery.
 *
 * Every one of these 11 tiles now also carries a real "Last scan" line
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
	]);
	const fileChanges = useSectionStatus('security', [
		'core-file-integrity',
		'integrity-monitoring',
	]);
	const ssl = useSectionStatus('ssl', ['ssl-monitoring']);
	const accessibility = useSectionStatus('accessibility', []);
	const malware = useSectionStatus('security', ['malware']);
	const firewall = useSectionStatus('security', ['firewall']);
	const loginProtection = useSectionStatus('security', ['login-protection']);
	const backups = useSectionStatus('security', ['backup-health']);

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
	const accessibilityLastScan = useLastScanTime(
		SCANNER_IDS_BY_TILE_ID.accessibility
	);
	const siteHealthLastScan = useLastScanTime();
	const malwareLastScan = useLastScanTime(SCANNER_IDS_BY_TILE_ID.malware);
	const firewallLastScan = useLastScanTime(SCANNER_IDS_BY_TILE_ID.firewall);
	const loginProtectionLastScan = useLastScanTime(
		SCANNER_IDS_BY_TILE_ID['login-protection']
	);
	const backupsLastScan = useLastScanTime(SCANNER_IDS_BY_TILE_ID.backups);

	const lastScanByTileId: Record<string, string | null> = {
		'security-scan': securityScanLastScan.lastScanAt,
		'plugin-vulnerabilities': pluginVulnerabilitiesLastScan.lastScanAt,
		'file-changes': fileChangesLastScan.lastScanAt,
		ssl: sslLastScan.lastScanAt,
		accessibility: accessibilityLastScan.lastScanAt,
		'site-health': siteHealthLastScan.lastScanAt,
		malware: malwareLastScan.lastScanAt,
		firewall: firewallLastScan.lastScanAt,
		'login-protection': loginProtectionLastScan.lastScanAt,
		backups: backupsLastScan.lastScanAt,
		// Recovery is the same underlying backup-health data as "Backups" —
		// one real fetch, two tiles reading it.
		recovery: backupsLastScan.lastScanAt,
	};

	const [healthBadge, setHealthBadge] = useState<{
		text: string;
		color: string;
	} | null>(null);

	useEffect(() => {
		getApiResponse<{ overall_score: number }>(
			getApiLink(appLocalizer, 'dashboard'),
			{ headers: { 'X-WP-Nonce': appLocalizer.nonce } }
		).then((response) => {
			if (response) {
				setHealthBadge(getHealthRating(response.overall_score));
			}
		});
	}, []);

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
			case 'accessibility':
				return (
					accessibility.badge ?? {
						text: __('No open findings', 'vulopilot'),
						color: 'green',
					}
				);
			case 'site-health':
				return healthBadge ?? NOT_TRACKED_BADGE;
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
			case 'backups':
			case 'recovery':
				return (
					backups.badge ?? {
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

		if (!target) {
			return;
		}

		if ('section' === target.type) {
			onViewSection(target.sectionKey);
			return;
		}

		// A hash-only URL change (same `?page=vulopilot`, different
		// `#&tab=...&subtab=...`) never triggers a real page load on its
		// own — browsers treat that as a same-document fragment update by
		// design, so Security.tsx's own `useState(initialTab)` (read once
		// from the hash at mount) would never re-run and this tab would
		// silently stay put. A real `reload()` right after forces a fresh
		// mount that reads the new hash.
		window.location.href = target.href;
		window.location.reload();
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
