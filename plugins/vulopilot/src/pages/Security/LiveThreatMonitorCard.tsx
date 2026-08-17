/* global appLocalizer */
import { __ } from '@wordpress/i18n';
import { CardComponent, ListComponent, BadgeComponent } from '@zyra/components';
import { ButtonInput } from '@zyra/inputs';
import { useSectionStatus } from '../../services/useSectionStatus';

const NOT_TRACKED_BADGE = {
	text: __('Not tracked yet', 'vulopilot'),
	color: 'indigo',
};

/**
 * "Live Threat Monitor" — of the mockup's 5 rows, only File Integrity has
 * a real scanner behind it (`core-file-integrity`/`integrity-monitoring`,
 * category 'security', same `useSectionStatus` badge the metrics grid
 * uses). Malware Scanning/Firewall/Login Protection/Spam Protection have
 * zero backing anywhere in either plugin — honest "Not tracked yet" for
 * each, a mixed real+honest list rather than nuking the whole section
 * (one of five rows is genuinely real, same approach the metrics grid
 * takes with its own 6-of-11 honestly-untracked tiles). "View full logs"
 * links to the real Activity page — the closest existing destination
 * (Activity logs generic 'system'/'automation' events, including this
 * plugin's own `security.alert` event type — see RecentActivityCard.tsx).
 */
const LiveThreatMonitorCard = () => {
	const fileIntegrity = useSectionStatus('security', [
		'core-file-integrity',
		'integrity-monitoring',
	]);

	const rows = [
		{
			id: 'malware-scanning',
			label: __('Malware Scanning', 'vulopilot'),
			badge: NOT_TRACKED_BADGE,
		},
		{
			id: 'firewall',
			label: __('Firewall', 'vulopilot'),
			badge: NOT_TRACKED_BADGE,
		},
		{
			id: 'login-protection',
			label: __('Login Protection', 'vulopilot'),
			badge: NOT_TRACKED_BADGE,
		},
		{
			id: 'file-integrity',
			label: __('File Integrity', 'vulopilot'),
			badge:
				fileIntegrity.badge ??
				{ text: __('No open findings', 'vulopilot'), color: 'green' },
		},
		{
			id: 'spam-protection',
			label: __('Spam Protection', 'vulopilot'),
			badge: NOT_TRACKED_BADGE,
		},
	];

	return (
		<CardComponent
			title={__('Live Threat Monitor', 'vulopilot')}
			titleIcon="security"
			action={
				<ButtonInput
					buttons={{
						text: __('View full logs', 'vulopilot'),
						onClick: () => {
							window.open(
								`${appLocalizer.admin_url}#&tab=activity`,
								'_self'
							);
						},
					}}
				/>
			}
		>
			<ListComponent
				className="mini-card list"
				items={rows.map((row) => ({
					id: row.id,
					title: row.label,
					tags: (
						<BadgeComponent color={row.badge.color} text={row.badge.text} />
					),
				}))}
			/>
		</CardComponent>
	);
};

export default LiveThreatMonitorCard;
