/* global appLocalizer */
import { __, sprintf } from '@wordpress/i18n';
import { PopupComponent, SectionComponent, TooltipComponent } from '@zyra/components';
import { ButtonInput, SelectInput } from '@zyra/inputs';
import { getApiLink, getApiResponse, scrollToId, sendApiResponse } from '@zyra/core';
import { useEffect, useState } from 'react';
import { formatWpDate } from '../../services/formatWpDate';
import { DAY_OPTIONS } from './reportsOverview';
import CreateReportModal from './CreateReportModal';
import ScheduleReportModal from './ScheduleReportModal';

interface ReportsOverviewHeaderProps {
	days: number;
	onDaysChange: (days: number) => void;
	/** Bumps OverviewTab.tsx's own refresh signal so Recent Reports/Report History/Scheduled Reports pick up a report or schedule this header's own modals just created. */
	onDataChanged: () => void;
}

/**
 * The reference mockup's page-header row: "Reports" title + description on
 * the left, a "Last N days" range dropdown plus Schedule Report/Download
 * PDF actions on the right — a `SectionComponent` (its own
 * `title`/`desc`/`rightContent` props, same plain page-header shape
 * SectionedIssuesTable.tsx's own "Issues" heading already uses), not a
 * `CardComponent` — no card border/background here, just a real section
 * divider. `SectionComponent` has no children slot for the real
 * "Showing the last N days …" range note below the action row, so that
 * stays a plain sibling `<p>` after it rather than nested inside.
 *
 * `days` is one of DAY_OPTIONS (7/30/90 — same 3-preset shape
 * WebsiteProgressChart.tsx already uses on this page) rather than an
 * arbitrary calendar range picker; shown as a real dropdown here instead of
 * the badge-toggle row this header used before, to match the mockup. It
 * only scopes the Recent Reports preview below it — Report History stays a
 * real, unfiltered, paginated list of every report, same as it always was.
 *
 * "+ Create Report" (per direct instruction, inserted into this same
 * action row rather than a separate "Build a New Report" section) opens
 * CreateReportModal.tsx — a real one-off generation through the exact same
 * `POST /reports` engine every other entry point on this page already
 * uses. "Schedule Report" opens ScheduleReportModal.tsx's own real
 * create-schedule flow once vulopilot-pro's AdvancedReports module is
 * active; otherwise it keeps its previous behavior of scrolling to this
 * same tab's own Scheduled Reports table (ScheduledReportsTable.tsx), which
 * already renders that module's real Pro-locked state — same "keep the
 * existing Pro upgrade/module state" instruction CreateReportModal.tsx's
 * own docblock documents for its "Sections to Include" gate. "Download" is
 * honestly gated: PDF export is a Pro-only exporter
 * (`vulopilot_report_exporter_sources`) — disabled with a tooltip when
 * that module isn't active. Its own label and
 * behavior follow the real Settings → Reports → "Default report format"
 * setting (`default_report_format`, Reports.ts): 'pdf' → "Download PDF",
 * downloads a PDF directly (unchanged); 'both' → plain "Download", opens a
 * small real choice (PDF/CSV) instead of guessing — that setting value
 * only ever means "ask me each time" client-side, never a raw format
 * string sent to the server (see Reports.ts's own docblock). Any other
 * value (currently only 'csv') keeps the PDF-download button as its own
 * fallback, same as before this setting existed, since this header's own
 * "Download" action has always specifically meant "get me a PDF of this
 * site's report". The mockup's own "..." overflow control is dropped —
 * nothing real maps to it.
 */
const ReportsOverviewHeader = ({
	days,
	onDaysChange,
	onDataChanged,
}: ReportsOverviewHeaderProps) => {
	const [isGenerating, setIsGenerating] = useState(false);
	const [isFormatMenuOpen, setIsFormatMenuOpen] = useState(false);
	const [isCreateReportOpen, setIsCreateReportOpen] = useState(false);
	const [isScheduleReportOpen, setIsScheduleReportOpen] = useState(false);
	const [defaultFormat, setDefaultFormat] = useState<string>('pdf');
	// Same module gates both PDF export and real schedule creation below.
	const advancedReportsActive =
		appLocalizer.active_modules?.includes('advanced-reports');
	const pdfAvailable = advancedReportsActive;

	const handleScheduleReportClick = () => {
		if (advancedReportsActive) {
			setIsScheduleReportOpen(true);
			return;
		}

		scrollToId('reports-schedules');
	};

	useEffect(() => {
		getApiResponse<{ default_report_format?: string }>(
			getApiLink(appLocalizer, 'settings'),
			{ headers: { 'X-WP-Nonce': appLocalizer.nonce } }
		).then((response) => {
			if (response?.default_report_format) {
				setDefaultFormat(response.default_report_format);
			}
		});
	}, []);

	// Plain client-side date math (today, and `days` ago) rather than a
	// second `/reports-overview` fetch just to echo back the same two
	// dates this dropdown already implies — real, just not server-round-tripped.
	const rangeEnd = new Date();
	const rangeStart = new Date();
	rangeStart.setDate(rangeStart.getDate() - (days - 1));

	const handleDownloadReport = (format: 'pdf' | 'csv') => {
		setIsFormatMenuOpen(false);
		setIsGenerating(true);

		sendApiResponse(appLocalizer, getApiLink(appLocalizer, 'reports'), {
			report_type: 'scan_summary',
			format,
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
			.finally(() => setIsGenerating(false));
	};

	const handleDownloadClick = () => {
		if ('both' === defaultFormat) {
			setIsFormatMenuOpen(true);
			return;
		}

		handleDownloadReport('pdf');
	};

	return (
		<>
			<SectionComponent
				icon="bar-chart"
				title={__('Reports', 'vulopilot')}
				desc={__(
					"Create, view, and manage detailed reports about your website's performance.",
					'vulopilot'
				)}
				wrapperClass="without-settings"
				rightContent={
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
								icon: 'plus',
								color: 'border-purple',
								onClick: () => setIsCreateReportOpen(true),
							}}
						/>
						<ButtonInput
							buttons={{
								text: __('Schedule Report', 'vulopilot'),
								icon: 'calendar',
								color: 'border-purple',
								onClick: handleScheduleReportClick,
							}}
						/>
						{pdfAvailable ? (
							<ButtonInput
								buttons={{
									text: isGenerating
										? __('Generating…', 'vulopilot')
										: 'both' === defaultFormat
											? __('Download', 'vulopilot')
											: __('Download PDF', 'vulopilot'),
									icon: 'download',
									color: 'border-purple',
									disabled: isGenerating,
									onClick: handleDownloadClick,
								}}
							/>
						) : (
							<TooltipComponent
								text={__(
									'PDF export is a Pro feature.',
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
			/>
			{/* "Default report format" → "Both": a real choice instead of
			guessing which one the user actually wants. */}
			<PopupComponent
				open={isFormatMenuOpen}
				onClose={() => setIsFormatMenuOpen(false)}
				width={18}
				height="auto"
				position="lightbox"
				header={{
					title: __('Download report', 'vulopilot'),
					icon: 'download',
					description: __(
						'Choose a format for this report.',
						'vulopilot'
					),
				}}
			>
				<div className="reports-download-format-choice">
					<ButtonInput
						buttons={{
							text: __('PDF', 'vulopilot'),
							icon: 'pdf',
							color: 'purple-bg',
							onClick: () => handleDownloadReport('pdf'),
						}}
					/>
					<ButtonInput
						buttons={{
							text: __('CSV', 'vulopilot'),
							icon: 'csv',
							color: 'border-purple',
							onClick: () => handleDownloadReport('csv'),
						}}
					/>
				</div>
			</PopupComponent>
			<CreateReportModal
				open={isCreateReportOpen}
				onClose={() => setIsCreateReportOpen(false)}
				onReportCreated={onDataChanged}
			/>
			{advancedReportsActive && (
				<ScheduleReportModal
					open={isScheduleReportOpen}
					onClose={() => setIsScheduleReportOpen(false)}
					onScheduleCreated={onDataChanged}
				/>
			)}
		</>
	);
};

export default ReportsOverviewHeader;
