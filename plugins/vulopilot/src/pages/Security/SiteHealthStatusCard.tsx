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

	const rows = [
		{ id: 'wordpress', label: __('WordPress', 'vulopilot'), status: wordpress },
		{ id: 'updates', label: __('Updates', 'vulopilot'), status: updates },
		{
			id: 'background-tasks',
			label: __('Background Tasks', 'vulopilot'),
			status: backgroundTasks,
		},
		{ id: 'database', label: __('Database', 'vulopilot'), status: database },
		{ id: 'server', label: __('Server', 'vulopilot'), status: server },
	];

	return (
		<CardComponent
			title={__('Site Health Status', 'vulopilot')}
			titleIcon="active"
			desc={__('Open findings across WordPress, updates, background tasks, database, and server.', 'vulopilot')}
		>
			<ListComponent
				className="mini-card report list"
				items={rows.map((row) => ({
					id: row.id,
					title: row.label,
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
		</CardComponent>
	);
};

export default SiteHealthStatusCard;
