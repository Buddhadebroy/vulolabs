/* global appLocalizer */
import { useEffect, useRef, useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import {
	FormGroupComponent,
	FormGroupWrapperComponent,
	NoticeComponent,
	NoticeManager,
	PopupComponent,
} from '@zyra/components';
import {
	ButtonInput,
	CalendarInput,
	EmailInput,
	MultiCheckboxInput,
	SelectInput,
	ToggleInput,
} from '@zyra/inputs';
import type { CalendarRange } from '@zyra/inputs';
import { getApiLink, getApiResponse, sendApiResponse } from '@zyra/core';
import { formatWpDate } from '../../services/formatWpDate';
import { resolvePendingRecipients } from '../../services/resolvePendingRecipients';
import { getReportTypeMeta, useReportTypeLabels } from './reportTypeMeta';

/**
 * "+ Create Report" (ReportsOverviewHeader.tsx's own header action area) —
 * one-off, on-demand generation through the exact same real engine every
 * other Reports entry point already uses (`POST /reports`,
 * Controllers\Reports::create_item() → Reports\ReportGenerator::generate()),
 * not a second report-building pipeline. Per direct instruction, this is
 * deliberately NOT the "Build a New Report"/"Report Templates" sections a
 * reference mockup showed — just this one modal, reusing what's already
 * real.
 *
 * Report Type's 6 choices map onto 6 of Free's own always-registered
 * Reports\ReportTypeRegistry ids (reportTypeMeta.ts's own `REPORT_TYPE_META`
 * keys) — every one of them free, so basic manual generation is never
 * Pro-gated (per direct instruction). "Full Website Report" defaults to
 * `scan_summary` (Free's own real "every scanner run + finding across every
 * category" type, ScanSummaryReport's own docblock) — the "Sections to
 * Include" checkboxes only ever become a real, functional multi-select once
 * vulopilot-pro's AdvancedReports module is active, since a genuine
 * per-section mix is `Types\CustomReport` (`report_type: 'custom'`), Pro
 * business logic Free has no fallback for at all (ReportGenerator::resolve_report_type()'s
 * own docblock: "Free has nothing to fall back to"). Without that module,
 * the checkboxes are shown read-only/informational (real all-5-included
 * behavior `scan_summary` already has, not a fabricated interactive
 * control) — same honest gating shape ReportsOverviewHeader.tsx's own PDF
 * button/ScheduledReportsTable.tsx already apply elsewhere on this page.
 * Choosing any one of the other 5 specific types never touches
 * `included_types` at all — a single type only ever has its own one
 * section, same as ReportGenerator::resolve_report_type() already treats
 * every non-'custom' id.
 *
 * Date Range's "Custom Range" uses zyra's own `CalendarInput` (its first
 * real consumer in this plugin — previously storybook-only) rather than
 * plain native date inputs, since a real range-picker component already
 * exists here (per direct instruction: "use our zyra components do not
 * create custom components").
 *
 * "Email this report after generation" posts straight to `POST /reports`'s
 * own new optional `email`/`recipients` params (Controllers\Reports's own
 * docblock) — no separate request, no separate delivery mechanism.
 *
 * The loading state below is a real request with a client-side *paced*
 * reveal of what's actually happening server-side in one synchronous call
 * (ReportGenerator::generate() has no per-step progress events to subscribe
 * to) — never fabricated success ahead of the real response, and never
 * blocking: `stage` state alone drives what's on screen while the actual
 * `fetch` awaits in the background, so the rest of the admin stays
 * interactive throughout (per direct instruction: "Do not freeze the UI").
 */
interface CreateReportModalProps {
	open: boolean;
	onClose: () => void;
	/** Bumps OverviewTab.tsx's own refresh signal once a report is actually created — same "lift shared state up" shape that page already uses for `days`/`onDaysChange`. */
	onReportCreated: () => void;
}

type ReportTypeChoice =
	| 'full'
	| 'seo'
	| 'performance'
	| 'security'
	| 'accessibility'
	| 'content';

const REPORT_TYPE_OPTIONS: { label: string; value: ReportTypeChoice }[] = [
	{ label: __('Full Website Report', 'vulopilot'), value: 'full' },
	{ label: __('SEO Report', 'vulopilot'), value: 'seo' },
	{ label: __('Performance Report', 'vulopilot'), value: 'performance' },
	{ label: __('Security Report', 'vulopilot'), value: 'security' },
	{ label: __('Accessibility Report', 'vulopilot'), value: 'accessibility' },
	{ label: __('Content Report', 'vulopilot'), value: 'content' },
];

/** A choice's real `report_type` id — 'full' resolves to 'custom' instead at submit time when Pro's per-section mix is actually in play (see `handleCreate()`'s own `usingCustomSections` check). */
const REPORT_TYPE_TO_ID: Record<ReportTypeChoice, string> = {
	full: 'scan_summary',
	seo: 'seo',
	performance: 'performance',
	security: 'security',
	accessibility: 'accessibility',
	content: 'content_intelligence',
};

type DateRangeChoice = '7' | '30' | '90' | 'custom';

const DATE_RANGE_OPTIONS: { label: string; value: DateRangeChoice }[] = [
	{ label: __('Last 7 days', 'vulopilot'), value: '7' },
	{ label: __('Last 30 days', 'vulopilot'), value: '30' },
	{ label: __('Last 90 days', 'vulopilot'), value: '90' },
	{ label: __('Custom Range', 'vulopilot'), value: 'custom' },
];

/** Real Free report type ids "Sections to Include" can mix into a Pro `custom` report — same ids reportTypeMeta.ts already has hand-authored copy for. */
const SECTION_OPTIONS = [
	{ key: 'seo', value: 'seo', label: __('SEO & Visibility', 'vulopilot') },
	{ key: 'performance', value: 'performance', label: __('Performance', 'vulopilot') },
	{ key: 'security', value: 'security', label: __('Security', 'vulopilot') },
	{ key: 'accessibility', value: 'accessibility', label: __('Accessibility', 'vulopilot') },
	{ key: 'content_intelligence', value: 'content_intelligence', label: __('Content', 'vulopilot') },
];
const ALL_SECTION_IDS = SECTION_OPTIONS.map((option) => option.value);

const toIsoDate = (date: Date): string => {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, '0');
	const day = String(date.getDate()).padStart(2, '0');
	return `${year}-${month}-${day}`;
};

interface CreatedReport {
	id: number;
	report_type: string;
	format: string;
	status: 'ready' | 'failed' | 'generating';
	period_start: string | null;
	period_end: string | null;
	created_at: string;
	has_file: boolean;
	email_requested: boolean;
	email_sent: boolean | null;
	email_recipients: string[];
}

type Stage = 'form' | 'progress' | 'success';

const nonceHeaders = { headers: { 'X-WP-Nonce': appLocalizer.nonce } };

const CreateReportModal = ({ open, onClose, onReportCreated }: CreateReportModalProps) => {
	const [stage, setStage] = useState<Stage>('form');
	const [reportType, setReportType] = useState<ReportTypeChoice>('full');
	const [dateRange, setDateRange] = useState<DateRangeChoice>('30');
	const [customRange, setCustomRange] = useState<CalendarRange>({});
	const [sectionIds, setSectionIds] = useState<string[]>(ALL_SECTION_IDS);
	const [emailEnabled, setEmailEnabled] = useState(false);
	const [recipients, setRecipients] = useState<string[]>([]);
	const [defaultFormat, setDefaultFormat] = useState('pdf');
	const [stepIndex, setStepIndex] = useState(0);
	const [result, setResult] = useState<CreatedReport | null>(null);
	const typeLabels = useReportTypeLabels();
	const stepTimer = useRef<ReturnType<typeof setInterval> | null>(null);
	const recipientsInputRef = useRef<HTMLInputElement>(null);

	const advancedReportsActive =
		appLocalizer.active_modules?.includes('advanced-reports');

	// Same real `default_report_format` setting ReportsOverviewHeader.tsx's
	// own Download button already reads — this modal has no separate
	// format field of its own (not one of the spec's real fields), so it
	// follows the site's already-configured preference instead of asking a
	// second time.
	useEffect(() => {
		if (!open) {
			return;
		}

		getApiResponse<{ default_report_format?: string }>(
			getApiLink(appLocalizer, 'settings'),
			nonceHeaders
		).then((response) => {
			if (response?.default_report_format) {
				setDefaultFormat(response.default_report_format);
			}
		});
	}, [open]);

	// Reset to a clean form every time the modal is (re)opened rather than
	// carrying over the previous run's stage/result.
	useEffect(() => {
		if (open) {
			setStage('form');
			setReportType('full');
			setDateRange('30');
			setCustomRange({});
			setSectionIds(ALL_SECTION_IDS);
			setEmailEnabled(false);
			setRecipients([]);
			setResult(null);
			setStepIndex(0);
		}
	}, [open]);

	useEffect(() => {
		return () => {
			if (stepTimer.current) {
				clearInterval(stepTimer.current);
			}
		};
	}, []);

	const isFullWebsite = 'full' === reportType;
	const usingCustomSections =
		isFullWebsite && advancedReportsActive && sectionIds.length !== ALL_SECTION_IDS.length;

	// 'default_report_format' is 'pdf' by default (Utill::VULOPILOT_SETTINGS_DEFAULTS)
	// even on a site that has never activated the AdvancedReports module — the
	// PDF exporter it names only actually exists once that module registers
	// it via `vulopilot_report_exporter_sources`. Forwarding 'pdf' verbatim
	// on a site without it isn't the same "unregistered *default*" case
	// Controllers\Reports::create_item() already silently falls back from —
	// that fallback only fires when the request sends no `format` param at
	// all, and this modal always sends one explicitly (so its own progress
	// steps/success screen can know which format was actually used ahead of
	// the response). So this modal resolves 'pdf'/'both' the same way that
	// silent fallback would, client-side, rather than ever asking the server
	// to validate an id this site can't actually export. 'csv' (the one
	// exporter that's always registered) passes through unchanged either way.
	const resolvedFormat =
		'csv' === defaultFormat ? 'csv' : advancedReportsActive ? 'pdf' : 'csv';

	const steps = [
		{ id: 'collect', label: __('Collecting website data', 'vulopilot') },
		{ id: 'analyze', label: __('Analyzing selected sections', 'vulopilot') },
		{ id: 'generate', label: __('Generating report', 'vulopilot') },
		...('pdf' === resolvedFormat
			? [{ id: 'pdf', label: __('Preparing PDF', 'vulopilot') }]
			: []),
		...(emailEnabled
			? [{ id: 'email', label: __('Sending email', 'vulopilot') }]
			: []),
	];

	const resolvePeriod = (): [string, string] => {
		if ('custom' === dateRange) {
			const end = customRange.endDate ?? new Date();
			const start = customRange.startDate ?? new Date();
			return [toIsoDate(start), toIsoDate(end)];
		}

		const days = Number(dateRange);
		const end = new Date();
		const start = new Date();
		start.setDate(start.getDate() - (days - 1));

		return [toIsoDate(start), toIsoDate(end)];
	};

	const handleSectionsChange = (values: string[]) => {
		// A "Full Website Report" with every section unchecked would
		// silently generate an empty custom report — never a real, useful
		// state, so at least one section always stays selected.
		setSectionIds(values.length > 0 ? values : sectionIds);
	};

	const handleCreate = () => {
		// A typed-but-not-yet-Enter'd address (EmailInput's own commit
		// gesture) still counts — see resolvePendingRecipients()'s own
		// docblock for why this modal can't just trust `recipients` alone.
		const finalRecipients = resolvePendingRecipients(
			recipients,
			recipientsInputRef.current
		);

		if (emailEnabled && 0 === finalRecipients.length) {
			NoticeManager.add({
				uniqueKey: 'vulopilot-create-report-missing-recipients',
				type: 'error',
				position: 'float',
				message: __(
					'Add at least one recipient, or turn off "Email this report".',
					'vulopilot'
				),
			});
			return;
		}

		const [periodStart, periodEnd] = resolvePeriod();
		const reportTypeId = usingCustomSections ? 'custom' : REPORT_TYPE_TO_ID[reportType];

		setStage('progress');
		setStepIndex(0);

		// Paces this modal's own step list forward roughly every 900ms —
		// purely a client-side reveal of what a single real synchronous
		// `POST /reports` call is doing server-side (no per-step events
		// exist to subscribe to instead, see this file's own docblock).
		// Stops one step short of the end until the real response actually
		// arrives below, so it never claims "done" ahead of reality.
		stepTimer.current = setInterval(() => {
			setStepIndex((current) =>
				current < steps.length - 1 ? current + 1 : current
			);
		}, 900);

		sendApiResponse(appLocalizer, getApiLink(appLocalizer, 'reports'), {
			report_type: reportTypeId,
			format: resolvedFormat,
			period_start: periodStart,
			period_end: periodEnd,
			included_types: usingCustomSections ? sectionIds : [],
			email: emailEnabled,
			recipients: emailEnabled ? finalRecipients.join(',') : '',
		})
			.then((response: CreatedReport | undefined) => {
				if (stepTimer.current) {
					clearInterval(stepTimer.current);
				}

				if (!response || 'failed' === response.status) {
					NoticeManager.add({
						uniqueKey: 'vulopilot-create-report-failed',
						type: 'error',
						position: 'float',
						message: __(
							'Could not generate this report. Please try again.',
							'vulopilot'
						),
					});
					setStage('form');
					return;
				}

				setStepIndex(steps.length - 1);
				setResult(response);
				setStage('success');
				onReportCreated();
			})
			.catch(() => {
				if (stepTimer.current) {
					clearInterval(stepTimer.current);
				}

				NoticeManager.add({
					uniqueKey: 'vulopilot-create-report-failed',
					type: 'error',
					position: 'float',
					message: __(
						'Could not generate this report. Please try again.',
						'vulopilot'
					),
				});
				setStage('form');
			});
	};

	const handleOpenReport = () => {
		if (!result || !result.has_file) {
			return;
		}

		if (
			'pdf' === result.format &&
			!appLocalizer.active_modules.includes('advanced-reports')
		) {
			return;
		}

		const baseUrl = getApiLink(appLocalizer, `reports/${result.id}/download`);
		const separator = baseUrl.includes('?') ? '&' : '?';
		window.open(`${baseUrl}${separator}_wpnonce=${appLocalizer.nonce}`, '_blank');
	};

	const meta = result ? getReportTypeMeta(result.report_type) : null;
	const resultLabel = result
		? typeLabels[result.report_type] || meta?.shortLabel || result.report_type
		: '';

	return (
		<PopupComponent
			open={open}
			onClose={onClose}
			width={31.25}
			height="auto"
			position="lightbox"
			className="create-report-popup"
			header={
				'success' === stage
					? { icon: 'yes-alt', title: __('Report Created', 'vulopilot') }
					: {
							icon: 'document',
							title: __('Create Report', 'vulopilot'),
							description: __(
								'Generate a report from your latest website data.',
								'vulopilot'
							),
						}
			}
			footer={
				'form' === stage ? (
					<>
						<ButtonInput
							buttons={{
								text: __('Cancel', 'vulopilot'),
								color: 'border-purple',
								onClick: onClose,
							}}
						/>
						<ButtonInput
							buttons={{
								text: __('Create Report', 'vulopilot'),
								color: 'purple-bg',
								onClick: handleCreate,
							}}
						/>
					</>
				) : 'success' === stage ? (
					<>
						<ButtonInput
							buttons={{
								text: __('View Report', 'vulopilot'),
								color: 'border-purple',
								disabled: !result?.has_file,
								onClick: handleOpenReport,
							}}
						/>
						<ButtonInput
							buttons={{
								text:
									result?.format === 'pdf'
										? __('Download PDF', 'vulopilot')
										: __('Download', 'vulopilot'),
								color: 'border-purple',
								disabled: !result?.has_file,
								onClick: handleOpenReport,
							}}
						/>
						<ButtonInput
							buttons={{
								text: __('Done', 'vulopilot'),
								color: 'purple-bg',
								onClick: onClose,
							}}
						/>
					</>
				) : null
			}
		>
			{'form' === stage && (
				<FormGroupWrapperComponent>
					<FormGroupComponent label={__('Report Type', 'vulopilot')}>
						<SelectInput
							name="create_report_type"
							value={reportType}
							options={REPORT_TYPE_OPTIONS}
							onChange={(value) => setReportType(value as ReportTypeChoice)}
						/>
					</FormGroupComponent>

					<FormGroupComponent label={__('Date Range', 'vulopilot')}>
						<SelectInput
							name="create_report_date_range"
							value={dateRange}
							options={DATE_RANGE_OPTIONS}
							onChange={(value) => setDateRange(value as DateRangeChoice)}
						/>
					</FormGroupComponent>

					{'custom' === dateRange && (
						<FormGroupComponent label={__('Custom Range', 'vulopilot')}>
							<CalendarInput
								value={customRange}
								onChange={(range) => setCustomRange(range ?? {})}
							/>
						</FormGroupComponent>
					)}

					{isFullWebsite && (
						<FormGroupComponent label={__('Sections to Include', 'vulopilot')}>
							{advancedReportsActive ? (
								<MultiCheckboxInput
									options={SECTION_OPTIONS}
									value={sectionIds}
									modules={appLocalizer.active_modules}
									onChange={handleSectionsChange}
								/>
							) : (
								<NoticeComponent
									displayPosition="inline-notice"
									type="info"
									title={__(
										'Every section (SEO & Visibility, Performance, Security, Accessibility, Content) is included automatically. Upgrade to Pro to choose a custom mix.',
										'vulopilot'
									)}
								/>
							)}
						</FormGroupComponent>
					)}

					<FormGroupComponent label={__('Email Report', 'vulopilot')}>
						<ToggleInput
							value={emailEnabled ? '1' : '0'}
							modules={[]}
							options={[
								{ key: 'no', label: __('Off', 'vulopilot'), value: '0' },
								{
									key: 'yes',
									label: __('Email this report after generation', 'vulopilot'),
									value: '1',
								},
							]}
							onChange={(value) => setEmailEnabled('1' === value)}
						/>
					</FormGroupComponent>

					{emailEnabled && (
						<FormGroupComponent label={__('Recipients', 'vulopilot')}>
							<EmailInput
								ref={recipientsInputRef}
								mode="multiple"
								enablePrimary={false}
								value={recipients}
								placeholder={__('email@example.com', 'vulopilot')}
								onChange={(list) => setRecipients(list)}
							/>
						</FormGroupComponent>
					)}
				</FormGroupWrapperComponent>
			)}

			{'progress' === stage && (
				<div className="create-report-progress">
					<p className="create-report-progress-title">
						{__('Creating Report', 'vulopilot')}
					</p>
					<ul className="create-report-progress-steps">
						{steps.map((step, index) => (
							<li
								key={step.id}
								className={`create-report-progress-step ${
									index < stepIndex
										? 'is-done'
										: index === stepIndex
											? 'is-active'
											: 'is-pending'
								}`}
							>
								<i
									className={
										index < stepIndex
											? 'adminfont-yes-alt'
											: index === stepIndex
												? 'adminfont-loader'
												: 'adminfont-circle'
									}
								/>
								{step.label}
							</li>
						))}
					</ul>
				</div>
			)}

			{'success' === stage && result && (
				<div className="create-report-success">
					<p className="create-report-success-message">
						{__('Your report is ready.', 'vulopilot')}
					</p>
					<div className="create-report-success-details">
						<div>
							<span className="create-report-success-label">{__('Report Name', 'vulopilot')}</span>
							<strong className="create-report-success-value">{resultLabel}</strong>
						</div>
						<div>
							<span className="create-report-success-label">{__('Report Type', 'vulopilot')}</span>
							<strong className="create-report-success-value">{meta?.desc || resultLabel}</strong>
						</div>
						<div>
							<span className="create-report-success-label">{__('Date Range', 'vulopilot')}</span>
							<strong className="create-report-success-value">
								{result.period_start && result.period_end
									? `${formatWpDate(result.period_start)} – ${formatWpDate(result.period_end)}`
									: '—'}
							</strong>
						</div>
						<div>
							<span className="create-report-success-label">{__('Generation Date', 'vulopilot')}</span>
							<strong className="create-report-success-value">{formatWpDate(result.created_at)}</strong>
						</div>
						<div>
							<span className="create-report-success-label">{__('Status', 'vulopilot')}</span>
							<strong className="create-report-success-value">{__('Completed', 'vulopilot')}</strong>
						</div>
						<div>
							<span className="create-report-success-label">{__('Email', 'vulopilot')}</span>
							<strong className="create-report-success-value">
								{result.email_requested && result.email_sent
									? sprintf(
											/* translators: %s is a comma-separated list of recipient email addresses. */
											__('Sent to %s', 'vulopilot'),
											result.email_recipients.join(', ')
										)
									: __('Not sent', 'vulopilot')}
							</strong>
						</div>
					</div>
				</div>
			)}
		</PopupComponent>
	);
};

export default CreateReportModal;
