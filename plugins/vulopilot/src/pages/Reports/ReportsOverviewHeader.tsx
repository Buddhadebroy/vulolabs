/* global appLocalizer */
import { __, sprintf } from '@wordpress/i18n';
import { CardComponent, TooltipComponent } from '@zyra/components';
import { ButtonInput, SelectInput } from '@zyra/inputs';
import { getApiLink, scrollToId, sendApiResponse } from '@zyra/core';
import { useState } from 'react';
import { formatWpDate } from '../../services/formatWpDate';
import { DAY_OPTIONS } from './reportsOverview';

interface ReportsOverviewHeaderProps {
	days: number;
	onDaysChange: (days: number) => void;
}

const REPORT_BUILDER_URL = '?page=vulopilot#&tab=reports&subtab=report';

/**
 * The reference mockup's page-header row: "Reports" title + description on
 * the left, a "Last N days" range dropdown plus Create Report/Schedule
 * Report/Download PDF actions on the right — same title/desc/action shape
 * every other card header in this codebase uses (`CardComponent`'s own
 * `title`/`desc`/`action` props), rather than hand-rolled markup.
 *
 * `days` is one of DAY_OPTIONS (7/30/90 — same 3-preset shape
 * WebsiteProgressChart.tsx already uses on this page) rather than an
 * arbitrary calendar range picker; shown as a real dropdown here instead of
 * the badge-toggle row this header used before, to match the mockup. It
 * only scopes the Recent Reports preview below it — Report History stays a
 * real, unfiltered, paginated list of every report, same as it always was.
 *
 * "Create Report" is a real cross-tab link to the Report Builder tab's own
 * real generate-report control (ReportTab.tsx) rather than duplicating that
 * flow here — this page deliberately drops the mockup's own inline "Build a
 * New Report"/"Report Templates" sections per direct instruction. "Schedule
 * Report" scrolls to this same tab's own real Scheduled Reports table
 * below (ScheduledReportsTable.tsx) rather than opening a second flow.
 * "Download PDF" is honestly gated: PDF export is a Pro-only exporter
 * (`vulopilot_report_exporter_sources`, ReportTab.tsx's own docblock) —
 * disabled with a tooltip when that module isn't active, otherwise triggers
 * a real `scan_summary` PDF generation + download. The mockup's "..."
 * overflow menu is dropped — nothing real maps to it.
 */
const ReportsOverviewHeader = ({
	days,
	onDaysChange,
}: ReportsOverviewHeaderProps) => {
	const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
	const pdfAvailable =
		appLocalizer.active_modules?.includes('advanced-reports');

	// Plain client-side date math (today, and `days` ago) rather than a
	// second `/reports-overview` fetch just to echo back the same two
	// dates this dropdown already implies — real, just not server-round-tripped.
	const rangeEnd = new Date();
	const rangeStart = new Date();
	rangeStart.setDate(rangeStart.getDate() - (days - 1));

	const handleDownloadPdf = () => {
		setIsGeneratingPdf(true);

		sendApiResponse(appLocalizer, getApiLink(appLocalizer, 'reports'), {
			report_type: 'scan_summary',
			format: 'pdf',
		})
			.then((response: { id?: number } | undefined) => {
				if (!response?.id) {
					return;
				}

				const baseUrl = getApiLink(
					appLocalizer,
					`reports/${response.id}/download`
				);
				const separator = baseUrl.includes('?') ? '&' : '?';
				window.open(
					`${baseUrl}${separator}_wpnonce=${appLocalizer.nonce}`,
					'_blank'
				);
			})
			.finally(() => setIsGeneratingPdf(false));
	};

	return (
		<CardComponent
			titleIcon="bar-chart"
			title={__('Reports', 'vulopilot')}
			desc={__(
				"Create, view, and manage detailed reports about your website's performance.",
				'vulopilot'
			)}
			action={
				<div className="reports-overview-actions">
					<SelectInput
						name="reports_days_range"
						value={String(days)}
						options={DAY_OPTIONS.map((option) => ({
							label: sprintf(
								/* translators: %d is the number of days. */
								__('Last %d days', 'vulopilot'),
								option
							),
							value: String(option),
						}))}
						onChange={(newValue) =>
							onDaysChange(Number(newValue))
						}
						size="10rem"
					/>
					<ButtonInput
						buttons={{
							text: __('Create Report', 'vulopilot'),
							icon: 'document',
							color: 'purple-bg',
							onClick: () => {
								window.location.href = REPORT_BUILDER_URL;
							},
						}}
					/>
					<ButtonInput
						buttons={{
							text: __('Schedule Report', 'vulopilot'),
							icon: 'calendar',
							color: 'border-purple',
							onClick: () => scrollToId('reports-schedules'),
						}}
					/>
					{pdfAvailable ? (
						<ButtonInput
							buttons={{
								text: isGeneratingPdf
									? __('Generating…', 'vulopilot')
									: __('Download PDF', 'vulopilot'),
								icon: 'download',
								color: 'border-purple',
								onClick: handleDownloadPdf,
							}}
						/>
					) : (
						<TooltipComponent
							text={__(
								'PDF export is a Pro feature (Advanced Reports module).',
								'vulopilot'
							)}
						>
							<ButtonInput
								buttons={{
									text: __('Download PDF', 'vulopilot'),
									icon: 'download',
									disabled: true,
									onClick: () => {},
								}}
							/>
						</TooltipComponent>
					)}
				</div>
			}
		>
			<p className="reports-overview-range-note">
				{sprintf(
					/* translators: 1: start date, 2: end date. */
					__('Showing the last %1$d days (%2$s – %3$s)', 'vulopilot'),
					days,
					formatWpDate(rangeStart.toISOString()),
					formatWpDate(rangeEnd.toISOString())
				)}
			</p>
		</CardComponent>
	);
};

export default ReportsOverviewHeader;
