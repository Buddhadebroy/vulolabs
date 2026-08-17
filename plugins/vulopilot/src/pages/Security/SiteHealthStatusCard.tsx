import { __ } from '@wordpress/i18n';
import { CardComponent, ListComponent } from '@zyra/components';
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
		<CardComponent title={__('Site Health Status', 'vulopilot')} titleIcon="active">
			<ListComponent
				className="mini-card list"
				border
				items={rows.map((row) => ({
					id: row.id,
					title: row.label,
					tags: row.status.badge ? (
						<span className={`admin-badge ${row.status.badge.color}`}>
							{row.status.badge.text}
						</span>
					) : null,
				}))}
			/>
		</CardComponent>
	);
};

export default SiteHealthStatusCard;
