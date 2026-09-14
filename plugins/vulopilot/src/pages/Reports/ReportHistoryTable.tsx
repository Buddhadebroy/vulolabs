/* global appLocalizer */
import { __ } from '@wordpress/i18n';
import { getApiLink } from '@zyra/core';
import { BadgeComponent, CardComponent, ModuleGuardComponent } from '@zyra/components';
import { TableCard, TableRow } from '@zyra/table';
import { useApiList } from '../../services/useApiList';
import { formatWpDate } from '../../services/formatWpDate';
import { getReportTypeMeta, useReportTypeLabels } from './reportTypeMeta';

interface ReportRow extends TableRow {
	id: number;
	report_type: string;
	format: string;
	status: 'generating' | 'ready' | 'failed';
	period_start: string | null;
	period_end: string | null;
	created_at: string;
	has_file: boolean;
}

const statusOptions = [
	{ label: __('Generating', 'vulopilot'), value: 'generating' },
	{ label: __('Ready', 'vulopilot'), value: 'ready' },
	{ label: __('Failed', 'vulopilot'), value: 'failed' },
];

/**
 * The mockup's "Report History" table — the same real, complete, paginated
 * `GET /reports` list ReportTab.tsx's own table already renders (unfiltered
 * by this page's own `days` range, unlike RecentReportsCard.tsx's preview
 * above it), just under this tab's own heading/id so
 * RecentReportsCard/ReportsOverviewHeader's "View All Reports" actions have
 * somewhere real to scroll to. Deliberately its own `useApiList` call
 * rather than sharing ReportTab.tsx's — that tab stays fully intact per
 * direct instruction, so its own table keeps its own independent fetch/
 * pagination state.
 */
const ReportHistoryTable = () => {
	const { data, total, categoryCounts, isLoading, error, refetch, onQueryUpdate } =
		useApiList<ReportRow>('reports', {}, { key: 'status', options: statusOptions });
	const typeLabels = useReportTypeLabels();

	const handleDownload = (row?: Record<string, unknown>) => {
		if (!row || row.status !== 'ready' || !row.has_file) {
			return;
		}

		if (
			row.format === 'pdf' &&
			!appLocalizer.active_modules.includes('advanced-reports')
		) {
			return;
		}

		const baseUrl = getApiLink(appLocalizer, `reports/${row.id}/download`);
		const separator = baseUrl.includes('?') ? '&' : '?';
		window.open(
			`${baseUrl}${separator}_wpnonce=${appLocalizer.nonce}`,
			'_blank'
		);
	};

	return (
		<div id="reports-history">
			<CardComponent
				title={__('Report History', 'vulopilot')}
				titleIcon="history"
				desc={__('A complete log of all generated reports.', 'vulopilot')}
			>
				{error ? (
					<ModuleGuardComponent
						icon="error"
						title={__('Could not load reports', 'vulopilot')}
						desc={error}
						buttonText={__('Retry', 'vulopilot')}
						onButtonClick={refetch}
					/>
				) : (
					<TableCard
						format={appLocalizer.date_format_js}
						headers={{
							report_type: {
								label: __('Report Name', 'vulopilot'),
								render: (row: ReportRow) =>
									typeLabels[row.report_type] ||
									getReportTypeMeta(row.report_type).shortLabel,
							},
							type: {
								label: __('Type', 'vulopilot'),
								render: (row: ReportRow) => {
									const meta = getReportTypeMeta(row.report_type);
									return (
										<BadgeComponent
											color={meta.badgeColor}
											text={meta.shortLabel}
										/>
									);
								},
							},
							period: {
								label: __('Period', 'vulopilot'),
								render: (row: ReportRow) =>
									row.period_start && row.period_end
										? `${formatWpDate(row.period_start)} – ${formatWpDate(row.period_end)}`
										: '—',
							},
							status: {
								label: __('Status', 'vulopilot'),
								type: 'badge',
								statusClass: (row: ReportRow) => `status-${row.status}`,
							},
							created_at: {
								label: __('Date', 'vulopilot'),
								type: 'date',
								isSortable: true,
								defaultSort: true,
								defaultOrder: 'desc',
							},
							actions: {
								label: __('Actions', 'vulopilot'),
								type: 'action',
								actions: [
									{
										label: (row?: Record<string, unknown>) =>
											row?.status === 'ready'
												? __('View', 'vulopilot')
												: __('Not ready yet', 'vulopilot'),
										icon: 'eye',
										onClick: handleDownload,
									},
								],
							},
						}}
						rows={data}
						ids={data.map((row) => row.id)}
						totalRows={total}
						categoryCounts={categoryCounts}
						isLoading={isLoading}
						onQueryUpdate={onQueryUpdate}
						emptyMessage={__(
							'No reports yet — generate your first report from the Report Builder tab.',
							'vulopilot'
						)}
					/>
				)}
			</CardComponent>
		</div>
	);
};

export default ReportHistoryTable;
