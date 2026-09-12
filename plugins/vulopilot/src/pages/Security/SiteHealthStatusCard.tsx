import { __ } from '@wordpress/i18n';
import { CardComponent, ListComponent, BadgeComponent } from '@zyra/components';
import { useSectionStatus } from '../../services/useSectionStatus';

/**
 * "Site Health Status" — same real per-section status-badge list shape
 * used elsewhere on this page. Every row here is genuinely real (this tab
 * has no scanner areas with zero backing), so there's no "Not tracked
 * yet" row to show.
 *
 * `server-health`/`php-warnings` are scoped with an *empty* category
 * (`useSectionStatus('', […])`) rather than `'server'` — the two scanners
 * that make up SiteHealthTab.tsx's own "Server" section have different
 * real `get_category()` values (`server`/`php-warnings`), so a single
 * fixed category here would silently exclude one of them from the count,
 * the same category/scanner_id mismatch bug already found and fixed
 * elsewhere this session. `useApiList`'s own `mergedParams` already drops
 * an empty-string param, so this falls back to scanner_id-only filtering
 * — a real, existing escape hatch, not a new mechanism.
 */
const SiteHealthStatusCard = () => {
	const wordpress = useSectionStatus('wordpress', ['wordpress-health']);
	const updates = useSectionStatus('updates', ['updates']);
	const backgroundTasks = useSectionStatus('cron', ['cron']);
	const database = useSectionStatus('database', ['database']);
	const server = useSectionStatus('', ['server-health', 'php-warnings']);

	/**
	 * Real `adminfont-*` icon + real `$color-palette` key + one-line
	 * `desc` per row. Icon uses the same `'<icon-name> <color>'` suffix
	 * convention every other `ListComponent` row in this plugin uses
	 * (`security green`, `search-discovery yellow`, etc.). Colors chosen
	 * to read as that subject's own identity without implying a status:
	 * WordPress blue, Updates green, Background Tasks purple, Database
	 * orange, Server indigo. `desc` describes what that real check
	 * actually inspects, matching the same scanner scope each row's own
	 * `useSectionStatus()` call already targets.
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
					// 2 real separate badges (total open + top-severity
					// breakdown), not 1 merged "N Open · N {Severity}
					// Severity" pill — `useSectionStatus()`'s own `badges`
					// array, added alongside its existing single `badge` for
					// exactly this real "show these split" case.
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