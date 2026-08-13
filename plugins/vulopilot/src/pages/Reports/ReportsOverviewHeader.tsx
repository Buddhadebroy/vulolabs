/* global appLocalizer */
import { __, sprintf } from '@wordpress/i18n';
import { CardComponent, TooltipComponent } from '@zyra/components';
import { ButtonInput } from '@zyra/inputs';
import { getApiLink, sendApiResponse } from '@zyra/core';
import { useState } from 'react';
import { formatWpDate } from '../../services/formatWpDate';
import { DAY_OPTIONS, type ReportsPeriod } from './reportsOverview';

interface ReportsOverviewHeaderProps {
	days: number;
	onDaysChange: (days: number) => void;
	period: ReportsPeriod | null;
}

const REPORT_BUILDER_URL = '?page=vulopilot#&tab=reports&subtab=report';

/**
 * The mockup's date-range + action row. No arbitrary calendar range
 * picker — `days` is one of DAY_OPTIONS (same 3-preset shape
 * WebsiteProgressChart.tsx already uses on this same page), shown as real
 * `period.start`–`period.end` dates once the fetch resolves. "Create
 * Report" is a real cross-tab link to the Report Builder tab's own real
 * generate-report control (ReportTab.tsx) rather than duplicating that
 * flow here. "Download PDF" is honestly gated: PDF export is a Pro-only
 * exporter (`vulopilot_report_exporter_sources`, ReportTab.tsx's own
 * docblock) — disabled with a tooltip when that module isn't active,
 * otherwise triggers a real `scan_summary` PDF generation + download.
 * The mockup's "..." overflow menu is dropped — nothing real maps to it.
 */
const ReportsOverviewHeader = ({
	days,
	onDaysChange,
	period,
}: ReportsOverviewHeaderProps) => {
	const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
	const pdfAvailable =
		appLocalizer.active_modules?.includes('advanced-reports');

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
		<CardComponent className="reports-overview-header">
			<div className="reports-overview-range">
				<i className="adminfont-calendar" />
				{period
					? sprintf(
							/* translators: 1: start date, 2: end date. */
							__('Last %1$d days (%2$s – %3$s)', 'vulopilot'),
							days,
							formatWpDate(period.start),
							formatWpDate(period.end)
						)
					: __('Loading…', 'vulopilot')}
				<div className="reports-overview-day-toggle">
					{DAY_OPTIONS.map((option) => (
						<button
							key={option}
							type="button"
							className={
								option === days
									? 'admin-badge purple'
									: 'admin-badge'
							}
							onClick={() => onDaysChange(option)}
						>
							{sprintf(
								/* translators: %d is the number of days. */
								__('%d Days', 'vulopilot'),
								option
							)}
						</button>
					))}
				</div>
			</div>
			<div className="reports-overview-actions">
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
						<span
							role="button"
							aria-disabled="true"
							className="reports-download-pdf-disabled"
						>
							<i className="adminfont-download" />
							{__('Download PDF', 'vulopilot')}
						</span>
					</TooltipComponent>
				)}
			</div>
		</CardComponent>
	);
};

export default ReportsOverviewHeader;
