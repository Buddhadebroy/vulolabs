/* global appLocalizer */
import { __ } from '@wordpress/i18n';
import { getApiLink } from '@zyra/core';
import { CardComponent, ModuleGuardComponent } from '@zyra/components';
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
		<CardComponent
			id="reports-history"
			title={__('Report History', 'vulopilot')}
			titleIcon="clock"
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
					hideHeader={true}
					format={appLocalizer.date_format_js}
					headers={{
						report_type: {
							label: __('Report Name', 'vulopilot'),
							type: 'info',
							key: 'reportName',
							descriptionKey: 'reportDesc',
							badgesKey: 'reportBadges',
						},
						actions: {
							label: __('Actions', 'vulopilot'),
							type: 'action',
							actions: [
								{
									type: 'button',
									color: 'text-blue',
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
					rows={data.map((row: ReportRow) => {
						const meta = getReportTypeMeta(row.report_type);

						return {
							...row,
							reportName:
								typeLabels[row.report_type] || meta.shortLabel,
							// Real "Period" range, folded into this row's own
							// description with a real label prefix
							// (InformationItemComponent's own `desc.label`)
							// instead of a separate column — per direct
							// instruction.
							reportDesc: [
								{
									label: __('Period', 'vulopilot'),
									value:
										row.period_start && row.period_end
											? `${formatWpDate(row.period_start)} – ${formatWpDate(row.period_end)}`
											: '—',
								},
							],
							// Real status + type + "Date" badges, folded into
							// this same info column instead of 3 separate
							// columns — per direct instruction.
							reportBadges: [
								{
									text: statusOptions.find(
										(option) => option.value === row.status
									)?.label ?? row.status,
									color:
										'ready' === row.status
											? 'green'
											: 'generating' === row.status
												? 'orange'
												: 'red',
								},
								{ text: meta.shortLabel, color: meta.badgeColor },
								{ text: formatWpDate(row.created_at), color: 'indigo' },
							],
						};
					})}
					ids={data.map((row) => row.id)}
					totalRows={total}
					categoryCounts={categoryCounts}
					isLoading={isLoading}
					onQueryUpdate={onQueryUpdate}
					emptyMessage={__(
						'No reports yet — use the Download PDF/CSV button above to generate your first report.',
						'vulopilot'
					)}
				/>
			)}
		</CardComponent>
	);
};

export default ReportHistoryTable;
