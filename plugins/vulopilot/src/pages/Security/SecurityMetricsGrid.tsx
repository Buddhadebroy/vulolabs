import { __ } from '@wordpress/i18n';
import { ListComponent, BadgeComponent } from '@zyra/components';
import { useSectionStatus } from '../../services/useSectionStatus';
import { SECURITY_FINDINGS_SCANNER_IDS } from './securityScannerIds';
import type { SectionedIssuesTab } from './SectionedIssuesTable';
import './ProtectMySite.scss';

/**
 * Where each of the 7 real (scanner-backed) tiles' row click goes.
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
 * Security tile grid, rendered as a `ListComponent` of per-section rows.
 */
const SecurityMetricsGrid = ({
	onViewSection,
}: {
	 
	// eslint-disable-next-line no-unused-vars
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
			className="mini-card report list hover"
			items={METRIC_TILES.map((tile) => {
				const isTracked = Boolean(VIEW_TARGET_BY_TILE_ID[tile.id]);
				const badges = badgesFor(tile.id);

				// 2 real badges (total open + top-severity breakdown) split one after the title,
				// one on the row's far right.
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
