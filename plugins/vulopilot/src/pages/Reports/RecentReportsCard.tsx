/* global appLocalizer */
import { useEffect, useState } from 'react';
import { __ } from '@wordpress/i18n';
import { getApiLink, getApiResponse, scrollToId } from '@zyra/core';
import { CardComponent, ModuleGuardComponent } from '@zyra/components';
import { ButtonInput } from '@zyra/inputs';
import { TableCard, TableRow } from '@zyra/table';
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

const nonceHeaders = { headers: { 'X-WP-Nonce': appLocalizer.nonce } };

const STATUS_LABEL: Record<ReportRow['status'], string> = {
	ready: __('Completed', 'vulopilot'),
	generating: __('Generating', 'vulopilot'),
	failed: __('Failed', 'vulopilot'),
};

/**
 * The mockup's "Recent Reports" card — same real `GET /reports` data
 * ReportHistoryTable.tsx's own full table lists, scoped to this header's
 * `days` range (client-side, by `created_at` — no server-side date filter
 * exists on this endpoint) and capped to the 6 most recent, matching the
 * mockup's own row count. Same `TableCard` shape (real header row, not
 * hand-rolled flex rows) and column order the mockup itself shows — Name/
 * Type/Generated On/Period/Status/Actions — mirroring
 * ReportHistoryTable.tsx's own column set, just reordered and without
 * pagination/sorting/filtering (a 6-row preview has no need for any of
 * those). "View All Reports" scrolls down to that full table rather than
 * duplicating a second navigation flow.
 *
 * The mockup's own per-row "Score" circle is dropped — no report row has a
 * real score anywhere in this data model (ReportRepository/Reports
 * controller only ever persist type/format/status/dates), so showing one
 * would mean fabricating a number. Its own hand-drawn "..." action is
 * dropped too — "View"/"Download PDF" below already cover the one real
 * per-row action (opening the generated file; both buttons trigger the
 * identical real download call — there's no second, distinct "view
 * without downloading" capability behind this data to give the mockup's
 * two buttons different real behavior).
 */
interface RecentReportsCardProps {
	days: number;
}

const RecentReportsCard = ({ days }: RecentReportsCardProps) => {
	const [reports, setReports] = useState<ReportRow[] | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const typeLabels = useReportTypeLabels();

	useEffect(() => {
		setIsLoading(true);
		const baseUrl = getApiLink(appLocalizer, 'reports');
		const url = `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}per_page=50&orderby=created_at&order=desc`;

		getApiResponse<{ data: ReportRow[] } | ReportRow[]>(url, nonceHeaders)
			.then((response) => {
				const list = Array.isArray(response)
					? response
					: (response?.data ?? []);
				setReports(list);
			})
			.finally(() => setIsLoading(false));
	}, []);

	const cutoff = new Date();
	cutoff.setDate(cutoff.getDate() - (days - 1));
	cutoff.setHours(0, 0, 0, 0);

	const rows = (reports ?? [])
		.filter((row) => new Date(row.created_at) >= cutoff)
		.slice(0, 6);

	const handleView = (row?: Record<string, unknown>) => {
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
			title={__('Recent Reports', 'vulopilot')}
			titleIcon="document"
			desc={__('Your latest generated reports.', 'vulopilot')}
			isLoading={isLoading}
			action={
				<ButtonInput
					buttons={{
						text: __('View All Reports', 'vulopilot'),
						rightIcon: 'arrow-right',
						color: 'text-purple',
						onClick: () => scrollToId('reports-history'),
					}}
				/>
			}
		>
			{rows.length === 0 ? (
				<ModuleGuardComponent
					icon="document"
					title={__('No reports yet', 'vulopilot')}
					desc={__(
						'Use the Download PDF/CSV button above to generate your first report.',
						'vulopilot'
					)}
				/>
			) : (
				<TableCard
					showMenu={false}
					hideHeader={true}
					format={appLocalizer.date_format_js}
					headers={{
						name: {
							label: __('Name', 'vulopilot'),
							type: 'info',
							key: 'reportName',
							iconKey: 'reportIcon',
							descriptionKey: 'reportDesc',
							badgesKey: 'reportBadges',
							width: '60%'
						},
						period: {
							label: __('Period', 'vulopilot'),
							render: (row: ReportRow) => (
								<div className="recent-reports-row-period">
									<p className="recent-reports-row-period-label">
										{__('Period', 'vulopilot')}
									</p>
									<p className="recent-reports-row-period-value">
										{row.period_start && row.period_end
											? `${formatWpDate(row.period_start)} – ${formatWpDate(row.period_end)}`
											: '—'}
									</p>
								</div>
							),
						},
						actions: {
							label: __('Actions', 'vulopilot'),
							type: 'action',
							actions: [
								{
									type: 'button',
									label: (row?: Record<string, unknown>) =>
										row?.status === 'ready'
											? __('View', 'vulopilot')
											: __('Not ready yet', 'vulopilot'),
									icon: 'eye',
									onClick: handleView,
									color: 'text-yellow'
								},
								{
									type: 'button',
									label: __('Download PDF', 'vulopilot'),
									icon: 'download',
									onClick: handleView,
									color: 'text-blue'
								},
							],
						},
					}}
					rows={rows.map((row: ReportRow) => {
						const meta = getReportTypeMeta(row.report_type);

						return {
							...row,
							reportName: typeLabels[row.report_type] || meta.shortLabel,
							reportIcon: meta.icon,
							reportDesc: meta.desc,
							// Real type + status + "Generated On" date, all
							// folded into this row's own info-column badges
							// instead of 3 separate columns — per direct
							// instruction.
							reportBadges: [
								{ text: meta.shortLabel, color: meta.badgeColor },
								{
									text: STATUS_LABEL[row.status],
									color:
										'ready' === row.status
											? 'green'
											: 'generating' === row.status
												? 'orange'
												: 'red',
								},
								{
									text: formatWpDate(row.created_at),
									color: 'indigo',
								},
							],
						};
					})}
					ids={rows.map((row) => row.id)}
					totalRows={rows.length}
					isLoading={isLoading}
				/>
			)}
		</CardComponent>
	);
};

export default RecentReportsCard;
