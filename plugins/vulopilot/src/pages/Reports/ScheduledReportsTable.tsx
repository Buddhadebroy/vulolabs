/* global appLocalizer */
import { useEffect, useState } from 'react';
import { __ } from '@wordpress/i18n';
import { getApiLink, getApiResponse, scrollToId, sendApiResponse } from '@zyra/core';
import { BadgeComponent, CardComponent, ModuleGuardComponent, NoticeManager, PopupComponent } from '@zyra/components';
import { ButtonInput } from '@zyra/inputs';
import ShowProPopup from '../../components/Popup/Popup';
import ScheduleReportModal from './ScheduleReportModal';
import { formatWpDate } from '../../services/formatWpDate';
import { getReportTypeMeta, useReportTypeLabels } from './reportTypeMeta';

interface ScheduleConfig {
	report_type?: string;
	format?: string;
	recipients?: string[];
	included_types?: string[];
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
 * already surfaces as `null` rather than throwing, so that case gets its
 * own honest empty state instead of an error banner. Its own "Unlock"
 * action opens the real generic upgrade popup (`ShowProPopup`, no props —
 * same "Unlock the full VuloPilot toolkit" pitch every other Pro-locked
 * surface on this page uses) rather than the previous "Open Modules" link:
 * 'advanced-reports' has no toggle card on Settings → Modules at all (it's
 * one of `VuloPilotPro::CARDLESS_MODULE_IDS` — auto-activated once a
 * license is, never a manual switch a user could find there), so pointing
 * at that page was a real dead end, not a softer nudge.
 *
 * Create/Edit both go through ScheduleReportModal.tsx (Create via
 * ReportsOverviewHeader.tsx's own "Schedule Report" button; Edit as this
 * table's own row action, pre-filled from that row) — one real modal, not
 * two. Enable/Disable, Delete (with a real confirm step, same
 * `ShowProPopup confirmMode` pattern BackupsTab.tsx's own delete already
 * uses), and Send Now (AdvancedReports\ScheduledReportRunner::run_now(),
 * the same real generation path the hourly due-jobs tick itself uses) are
 * wired here directly — one real call each.
 */
interface ScheduledReportsTableProps {
	/** Bumped by OverviewTab.tsx once ScheduleReportModal.tsx (ReportsOverviewHeader.tsx, or this table's own Edit action) saves a schedule - refetches this table's own list. */
	refreshSignal?: number;
}

const ScheduledReportsTable = ({ refreshSignal }: ScheduledReportsTableProps) => {
	const [rows, setRows] = useState<ScheduleRow[] | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [isProPopupOpen, setIsProPopupOpen] = useState(false);
	const [editingRow, setEditingRow] = useState<ScheduleRow | null>(null);
	const [deleteTarget, setDeleteTarget] = useState<ScheduleRow | null>(null);
	const [runningId, setRunningId] = useState<number | null>(null);
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
	}, [refreshSignal]);

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

	const handleSendNow = (row: ScheduleRow) => {
		setRunningId(row.id);

		sendApiResponse(
			appLocalizer,
			getApiLink(appLocalizer, `report-schedules/${row.id}/run`),
			{}
		)
			.then((response) => {
				NoticeManager.add({
					uniqueKey: 'vulopilot-schedule-run-now',
					type: response ? 'success' : 'error',
					position: 'float',
					message: response
						? __('Report generated - see Recent Reports below.', 'vulopilot')
						: __('Could not run this schedule. Please try again.', 'vulopilot'),
				});
			})
			.finally(() => setRunningId(null));
	};

	const handleConfirmDelete = () => {
		if (!deleteTarget) {
			return;
		}

		const row = deleteTarget;
		setDeleteTarget(null);

		fetch(`${getApiLink(appLocalizer, 'report-schedules')}/${row.id}`, {
			method: 'DELETE',
			headers: { 'X-WP-Nonce': appLocalizer.nonce },
		}).then((response) => {
			NoticeManager.add({
				uniqueKey: 'vulopilot-schedule-delete',
				type: response.ok ? 'success' : 'error',
				position: 'float',
				message: response.ok
					? __('Schedule deleted.', 'vulopilot')
					: __('Could not delete this schedule. Please try again.', 'vulopilot'),
			});

			if (response.ok) {
				refetch();
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
		>
			{!advancedReportsActive ? (
				<ModuleGuardComponent
					icon="calendar"
					title={__('Scheduled reports is a Pro feature', 'vulopilot')}
					desc={__(
						'Upgrade to Pro to automatically generate and email reports on a recurring basis.',
						'vulopilot'
					)}
					buttonText={__('Unlock with Pro', 'vulopilot')}
					onButtonClick={() => setIsProPopupOpen(true)}
				/>
			) : !rows || rows.length === 0 ? (
				<ModuleGuardComponent
					icon="calendar"
					title={__('No scheduled reports yet', 'vulopilot')}
					desc={__(
						'Click "Schedule Report" above to create your first recurring report.',
						'vulopilot'
					)}
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
								<div className="reports-schedules-row-actions">
									<ButtonInput
										buttons={{
											text: runningId === row.id
												? __('Running…', 'vulopilot')
												: __('Send Now', 'vulopilot'),
											icon: 'ai',
											color: 'text-purple',
											disabled: runningId === row.id,
											onClick: () => handleSendNow(row),
										}}
									/>
									<ButtonInput
										buttons={{
											text: __('Edit', 'vulopilot'),
											icon: 'edit',
											color: 'text-blue',
											onClick: () => setEditingRow(row),
										}}
									/>
									<ButtonInput
										buttons={{
											text: row.is_enabled
												? __('Pause', 'vulopilot')
												: __('Resume', 'vulopilot'),
											icon: 'refresh',
											color: 'border-purple',
											onClick: () => handleToggle(row),
										}}
									/>
									<ButtonInput
										buttons={{
											text: __('View Reports', 'vulopilot'),
											icon: 'eye',
											color: 'text-yellow',
											onClick: () => scrollToId('reports-history'),
										}}
									/>
									<ButtonInput
										buttons={{
											text: __('Delete', 'vulopilot'),
											icon: 'delete',
											color: 'text-red',
											onClick: () => setDeleteTarget(row),
										}}
									/>
								</div>
							</div>
						);
					})}
				</div>
			)}

			<PopupComponent
				position="lightbox"
				open={isProPopupOpen}
				onClose={() => setIsProPopupOpen(false)}
				width={31.25}
				height="auto"
			>
				<ShowProPopup />
			</PopupComponent>

			<PopupComponent
				position="lightbox"
				open={null !== deleteTarget}
				onClose={() => setDeleteTarget(null)}
				width={31.25}
				height="auto"
			>
				<ShowProPopup
					confirmMode
					title={__('Delete Schedule', 'vulopilot')}
					confirmMessage={__(
						'Delete this report schedule? This cannot be undone.',
						'vulopilot'
					)}
					confirmYesText={__('Delete', 'vulopilot')}
					confirmNoText={__('Cancel', 'vulopilot')}
					onConfirm={handleConfirmDelete}
					onCancel={() => setDeleteTarget(null)}
				/>
			</PopupComponent>

			<ScheduleReportModal
				open={null !== editingRow}
				onClose={() => setEditingRow(null)}
				onScheduleCreated={refetch}
				editSchedule={
					editingRow
						? {
								id: editingRow.id,
								reportType: parseConfig(editingRow.config).report_type || 'custom',
								schedule: editingRow.schedule,
								recipients: parseConfig(editingRow.config).recipients || [],
								includedTypes: parseConfig(editingRow.config).included_types || [],
							}
						: null
				}
			/>
		</CardComponent>
	);
};

export default ScheduledReportsTable;
