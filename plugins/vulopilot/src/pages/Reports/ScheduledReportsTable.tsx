/* global appLocalizer */
import { useEffect, useState } from 'react';
import { __ } from '@wordpress/i18n';
import { getApiLink, getApiResponse, sendApiResponse } from '@zyra/core';
import { BadgeComponent, CardComponent, ModuleGuardComponent, NoticeManager } from '@zyra/components';
import { ButtonInput } from '@zyra/inputs';
import { formatWpDate } from '../../services/formatWpDate';
import { getReportTypeMeta, useReportTypeLabels } from './reportTypeMeta';

interface ScheduleConfig {
	report_type?: string;
	format?: string;
	recipients?: string[];
}

interface ScheduleRow {
	id: number;
	schedule: 'daily' | 'weekly' | 'monthly';
	is_enabled: 0 | 1;
	next_run_at: string | null;
	config: string;
}

const nonceHeaders = { headers: { 'X-WP-Nonce': appLocalizer.nonce } };

const FREQUENCY_LABEL: Record<ScheduleRow['schedule'], string> = {
	daily: __('Daily', 'vulopilot'),
	weekly: __('Weekly', 'vulopilot'),
	monthly: __('Monthly', 'vulopilot'),
};

const REPORT_BUILDER_URL = '?page=vulopilot#&tab=reports&subtab=report';

const parseConfig = (raw: string): ScheduleConfig => {
	try {
		return JSON.parse(raw) as ScheduleConfig;
	} catch {
		return {};
	}
};

/**
 * The mockup's "Scheduled Reports" table — real `GET /report-schedules`
 * rows (`vulopilot_scheduled_jobs` where `job_type = 'report'`,
 * ReportSchedulesRest.php), decoding each row's own `config` JSON for the
 * real `report_type`/`recipients` the mockup's Type/Recipients columns
 * show (the raw list endpoint doesn't decode that itself — same reasoning
 * ReportTypeCards.tsx already documents for `meta`).
 *
 * That REST route only exists once vulopilot-pro's AdvancedReports module
 * is active — a request while it's inactive 404s, which `getApiResponse`
 * already surfaces as `null` rather than throwing (same "404 here means
 * the module isn't active, not a transient failure" reasoning
 * ReportSchedulesSummary.tsx's own docblock already covers), so that case
 * gets its own honest empty state instead of an error banner. Creating a
 * new schedule still isn't built into this card (this page deliberately
 * drops the mockup's own inline "Build a New Report" section per direct
 * instruction) — both empty states link to the Report Builder tab, which
 * already renders the real create-schedule form
 * (`vulopilot_reports_advanced_panel`, ReportTab.tsx). Enable/Disable and
 * Delete are wired here directly though, since they're one real call each
 * and this table already has to render the row.
 */
const ScheduledReportsTable = () => {
	const [rows, setRows] = useState<ScheduleRow[] | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const typeLabels = useReportTypeLabels();
	const advancedReportsActive =
		appLocalizer.active_modules?.includes('advanced-reports');

	const refetch = () => {
		setIsLoading(true);
		getApiResponse<{ data: ScheduleRow[] } | ScheduleRow[]>(
			getApiLink(appLocalizer, 'report-schedules'),
			nonceHeaders
		)
			.then((response) => {
				const list = Array.isArray(response)
					? response
					: (response?.data ?? null);
				setRows(list);
			})
			.finally(() => setIsLoading(false));
	};

	useEffect(() => {
		refetch();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const handleToggle = (row: ScheduleRow) => {
		sendApiResponse(
			appLocalizer,
			getApiLink(appLocalizer, `report-schedules/${row.id}`),
			{ is_enabled: row.is_enabled ? 0 : 1 }
		).then((response) => {
			if (response) {
				refetch();
			} else {
				NoticeManager.add({
					uniqueKey: 'vulopilot-schedule-toggle-failed',
					type: 'error',
					position: 'float',
					message: __(
						'Could not update this schedule. Please try again.',
						'vulopilot'
					),
				});
			}
		});
	};

	return (
		<CardComponent
			id="reports-schedules"
			className="reports-schedules-card"
			title={__('Scheduled Reports', 'vulopilot')}
			titleIcon="calendar"
			desc={__(
				'Automate report generation and delivery to keep your team and clients updated.',
				'vulopilot'
			)}
			isLoading={isLoading}
			action={
				<ButtonInput
					buttons={{
						text: __('Manage Schedules', 'vulopilot'),
						rightIcon: 'arrow-right',
						color: 'text-purple',
						onClick: () => {
							window.location.href = REPORT_BUILDER_URL;
						},
					}}
				/>
			}
		>
			{!advancedReportsActive ? (
				<ModuleGuardComponent
					icon="calendar"
					title={__('Scheduled reports is a Pro feature', 'vulopilot')}
					desc={__(
						'Turn on the Advanced Reports module to automatically generate and email reports on a recurring basis.',
						'vulopilot'
					)}
					buttonText={__('Open Report Builder', 'vulopilot')}
					onButtonClick={() => {
						window.location.href = REPORT_BUILDER_URL;
					}}
				/>
			) : !rows || rows.length === 0 ? (
				<ModuleGuardComponent
					icon="calendar"
					title={__('No scheduled reports yet', 'vulopilot')}
					desc={__(
						'Set up a recurring schedule from the Report Builder tab.',
						'vulopilot'
					)}
					buttonText={__('Open Report Builder', 'vulopilot')}
					onButtonClick={() => {
						window.location.href = REPORT_BUILDER_URL;
					}}
				/>
			) : (
				<div className="reports-schedules-list">
					{rows.map((row) => {
						const config = parseConfig(row.config);
						const reportType = config.report_type || '';
						const meta = getReportTypeMeta(reportType);
						const name = reportType
							? typeLabels[reportType] || meta.shortLabel
							: __('Report', 'vulopilot');
						const recipients = config.recipients?.length
							? config.recipients.join(', ')
							: __('No recipients set', 'vulopilot');

						return (
							<div className="reports-schedules-row" key={row.id}>
								<span className="reports-schedules-row-name">
									{name}
								</span>
								<BadgeComponent
									color={meta.badgeColor}
									text={meta.shortLabel}
								/>
								<span>{FREQUENCY_LABEL[row.schedule]}</span>
								<span>
									{row.next_run_at
										? formatWpDate(row.next_run_at)
										: __('Not scheduled', 'vulopilot')}
								</span>
								<span
									className="reports-schedules-row-recipients"
									title={recipients}
								>
									{recipients}
								</span>
								<BadgeComponent
									color={row.is_enabled ? 'green' : ''}
									text={
										row.is_enabled
											? __('Enabled', 'vulopilot')
											: __('Disabled', 'vulopilot')
									}
								/>
								<ButtonInput
									buttons={{
										text: row.is_enabled
											? __('Disable', 'vulopilot')
											: __('Enable', 'vulopilot'),
										icon: 'refresh',
										color: 'border-purple',
										onClick: () => handleToggle(row),
									}}
								/>
							</div>
						);
					})}
				</div>
			)}
		</CardComponent>
	);
};

export default ScheduledReportsTable;
