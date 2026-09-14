/* global appLocalizer */
import { useEffect, useState } from 'react';
import { __ } from '@wordpress/i18n';
import { getApiLink, getApiResponse, scrollToId } from '@zyra/core';
import { BadgeComponent, CardComponent, IconComponent, ModuleGuardComponent } from '@zyra/components';
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
						icon: 'arrow-right',
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
						'Generate your first report from the Report Builder tab.',
						'vulopilot'
					)}
				/>
			) : (
				<TableCard
					showMenu={false}
					format={appLocalizer.date_format_js}
					headers={{
						name: {
							label: __('Name', 'vulopilot'),
							render: (row: ReportRow) => {
								const meta = getReportTypeMeta(row.report_type);
								const name =
									typeLabels[row.report_type] || meta.shortLabel;

								return (
									<div className="recent-reports-row-name">
										<IconComponent name={meta.icon} />
										<div>
											<p className="recent-reports-row-title">
												{name}
											</p>
											<p className="recent-reports-row-desc">
												{meta.desc}
											</p>
										</div>
									</div>
								);
							},
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
						created_at: {
							label: __('Generated On', 'vulopilot'),
							type: 'date',
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
							render: (row: ReportRow) => (
								<BadgeComponent
									color={
										row.status === 'ready'
											? 'green'
											: row.status === 'generating'
												? 'orange'
												: 'red'
									}
									text={STATUS_LABEL[row.status]}
								/>
							),
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
									onClick: handleView,
								},
								{
									label: __('Download PDF', 'vulopilot'),
									icon: 'download',
									onClick: handleView,
								},
							],
						},
					}}
					rows={rows}
					ids={rows.map((row) => row.id)}
					totalRows={rows.length}
					isLoading={isLoading}
				/>
			)}
		</CardComponent>
	);
};

export default RecentReportsCard;
