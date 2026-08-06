/* global appLocalizer */
import { useEffect, useState } from 'react';
import { __ } from '@wordpress/i18n';
import { getApiLink, getApiResponse } from '@zyra/core';
import { CardComponent } from '@zyra/components';
import { useSectionStatus } from '../../services/useSectionStatus';
import './ProtectMySite.scss';

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
 * The mockup's 11-tile grid. Real scanner-backed tiles: Security Scan
 * (whole 'security' category), Plugin Vulnerabilities
 * (`basic-vulnerabilities`/`advanced-vulnerabilities`), File Changes
 * (`core-file-integrity`/`integrity-monitoring`), SSL — note category
 * **'ssl'**, not 'security' (`SslMonitoringScanner` registers under its
 * own category; `useSectionStatus` ANDs category+scanner_id server-side,
 * same as FindingsTable, so passing 'security' here would silently return
 * zero results), Accessibility (whole 'accessibility' category), and Site
 * Health (`overall_score` from `GET /dashboard` — the all-categories
 * combined score `Health.tsx` shows, deliberately different from the
 * `category_scores.security` number the donut below already shows).
 * Malware/Firewall/Login Protection/Backups/Recovery have zero backing
 * anywhere in either plugin (confirmed via full-codebase search — no
 * scanner, module, or stored status of any kind) — honest "Not tracked
 * yet" badge, same as every other honestly-untracked metric this session.
 * Static display, no per-tile click — same as Improve Speed's own
 * MetricsGrid.
 */
const SecurityMetricsGrid = () => {
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
			default:
				return NOT_TRACKED_BADGE;
		}
	};

	return (
		<div className="security-metrics-grid">
			{METRIC_TILES.map((tile) => {
				const badge = badgeFor(tile.id);
				return (
					<CardComponent key={tile.id} className="security-metric-tile">
						<i className={`security-metric-icon adminfont-${tile.icon}`} />
						<div className="security-metric-title">{tile.title}</div>
						<span className={`admin-badge ${badge.color}`}>
							{badge.text}
						</span>
						<div className="desc">{tile.desc}</div>
					</CardComponent>
				);
			})}
		</div>
	);
};

export default SecurityMetricsGrid;
