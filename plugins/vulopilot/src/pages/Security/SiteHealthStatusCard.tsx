import { __ } from '@wordpress/i18n';
import { ListComponent, BadgeComponent } from '@zyra/components';
import { useSectionStatus } from '../../services/useSectionStatus';

/**
 * "Site Health Status" - same real per-section status-badge list shape used elsewhere on this
 * page.
 */
interface SiteHealthStatusCardProps {
	// eslint-disable-next-line no-unused-vars
	onSectionClick?: (key: string) => void;
}

const SiteHealthStatusCard = ({ onSectionClick }: SiteHealthStatusCardProps) => {
	const wordpress = useSectionStatus('wordpress', ['wordpress-health']);
	const updates = useSectionStatus('updates', ['updates']);
	const backgroundTasks = useSectionStatus('cron', ['cron']);
	const database = useSectionStatus('database', ['database']);
	const server = useSectionStatus('', ['server-health', 'php-warnings']);

	/**
	 * Real `adminfont-*` icon + real `$color-palette` key + one-line `desc` per row.
	 */
	const rows = [
		{
			id: 'wordpress',
			label: __('WordPress', 'vulopilot'),
			icon: 'wordpress blue',
			desc: __('Core WordPress health checks.', 'vulopilot'),
			status: wordpress,
		},
		{
			id: 'updates',
			label: __('Updates', 'vulopilot'),
			icon: 'refresh green',
			desc: __('Available core, plugin, and theme updates.', 'vulopilot'),
			status: updates,
		},
		{
			id: 'background-tasks',
			label: __('Background Tasks', 'vulopilot'),
			icon: 'automation purple',
			desc: __('Scheduled events and WP-Cron activity.', 'vulopilot'),
			status: backgroundTasks,
		},
		{
			id: 'database',
			label: __('Database', 'vulopilot'),
			icon: 'database orange',
			desc: __('Table integrity, size, and cleanup opportunities.', 'vulopilot'),
			status: database,
		},
		{
			id: 'server',
			label: __('Server', 'vulopilot'),
			icon: 'module indigo',
			desc: __('PHP version, extensions, and server-side warnings.', 'vulopilot'),
			status: server,
		},
	];

	return (
		<>
			<ListComponent
				className="mini-card report list"
				items={rows.map((row) => ({
					id: row.id,
					icon: row.icon,
					title: row.label,
					desc: row.desc,
					action: onSectionClick ? () => onSectionClick(row.id) : undefined,
					// 2 real separate badges (total open + top-severity breakdown), not 1 merged
					// "N Open · N {Severity} Severity" pill.
					tags: row.status.badges ? (
						<>
							{row.status.badges.map((badge, index) => (
								<BadgeComponent
									key={index}
									color={badge.color}
									text={badge.text}
								/>
							))}
						</>
					) : null,
				}))}
			/>
		</>
	);
};

export default SiteHealthStatusCard;