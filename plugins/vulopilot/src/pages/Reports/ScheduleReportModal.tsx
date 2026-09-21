/* global appLocalizer */
import { useEffect, useRef, useState } from 'react';
import { __ } from '@wordpress/i18n';
import {
	FormGroupComponent,
	FormGroupWrapperComponent,
	NoticeManager,
	PopupComponent,
} from '@zyra/components';
import { ButtonInput, EmailInput, MultiCheckboxInput, SelectInput } from '@zyra/inputs';
import { getApiLink, sendApiResponse } from '@zyra/core';
import { resolvePendingRecipients } from '../../services/resolvePendingRecipients';

/**
 * "Schedule Report"'s real create-schedule flow — the header button used to
 * only `scrollToId('reports-schedules')`; per direct instruction it now
 * opens this modal for a site where vulopilot-pro's AdvancedReports module
 * is already active (ReportsOverviewHeader.tsx decides which), posting
 * straight to the exact real `POST /report-schedules` endpoint
 * (AdvancedReports\ReportSchedulesRest::create_item()) SchedulePanel.tsx's
 * own (orphaned — nothing renders it any more, see ScheduledReportsTable.tsx's
 * own docblock) create-schedule form already proved works, rather than a
 * second, parallel schedule-creation mechanism. A site without that module
 * never sees this modal at all — the header keeps its previous
 * scroll-to-the-existing-Pro-locked-section behavior for that case, per
 * direct instruction ("keep the existing Pro upgrade/module state").
 *
 * Report Type/Sections reuse the exact same choices/ids CreateReportModal.tsx
 * offers, for one consistent vocabulary across both modals — "Full Website
 * Report" here always means a real `custom` report (this modal only ever
 * renders once AdvancedReports is already active, so there's no free-tier
 * fallback branch to consider the way CreateReportModal.tsx has to).
 *
 * Frequency is Daily/Weekly/Monthly — the real, only 3 values
 * `ReportSchedulesRest::create_item()` accepts
 * (`in_array($schedule, ['daily','weekly','monthly'])`) — not the
 * Weekly/Monthly/Quarterly a reference mockup showed; "Quarterly" isn't a
 * real schedule this backend can run, so it isn't offered here (per root
 * CLAUDE.md's own "document gaps, don't silently reinterpret" posture).
 * There's likewise no working "Date Range" field here, unlike
 * CreateReportModal.tsx's real one — a *recurring* schedule has no stored
 * period of its own at all; `ScheduledReportRunner::period_for_schedule()`
 * always derives one fresh from `schedule` itself at run time (today for
 * daily, last 7 days for weekly, last 30 for monthly). Rather than adding a
 * "Date Range" control with nothing real behind it, the frequency field's
 * own helper text states the real derived range directly.
 *
 * Doubles as "Edit" (ScheduledReportsTable.tsx's own row action) when
 * `editSchedule` is passed — same fields, pre-filled from that row's own
 * real `config`/`schedule`, `PATCH`ed to that same row's id
 * (`ReportSchedulesRest::update_item()`'s own real-field-editing path)
 * instead of `POST`ed as a new row. Not a second modal/component — the
 * spec's own "no duplicate schedule builder" instruction.
 */
interface ScheduleRowEditTarget {
	id: number;
	reportType: string;
	schedule: Frequency;
	recipients: string[];
	includedTypes: string[];
}

interface ScheduleReportModalProps {
	open: boolean;
	onClose: () => void;
	onScheduleCreated: () => void;
	editSchedule?: ScheduleRowEditTarget | null;
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

const REPORT_TYPE_TO_ID: Record<ReportTypeChoice, string> = {
	full: 'custom',
	seo: 'seo',
	performance: 'performance',
	security: 'security',
	accessibility: 'accessibility',
	content: 'content_intelligence',
};

/** The reverse of REPORT_TYPE_TO_ID — resolves an existing row's real `report_type` id back to this modal's own dropdown choice, for "Edit". */
const ID_TO_REPORT_TYPE: Record<string, ReportTypeChoice> = {
	custom: 'full',
	seo: 'seo',
	performance: 'performance',
	security: 'security',
	accessibility: 'accessibility',
	content_intelligence: 'content',
};

const SECTION_OPTIONS = [
	{ key: 'seo', value: 'seo', label: __('SEO & Visibility', 'vulopilot') },
	{ key: 'performance', value: 'performance', label: __('Performance', 'vulopilot') },
	{ key: 'security', value: 'security', label: __('Security', 'vulopilot') },
	{ key: 'accessibility', value: 'accessibility', label: __('Accessibility', 'vulopilot') },
	{ key: 'content_intelligence', value: 'content_intelligence', label: __('Content', 'vulopilot') },
];
const ALL_SECTION_IDS = SECTION_OPTIONS.map((option) => option.value);

type Frequency = 'daily' | 'weekly' | 'monthly';

const FREQUENCY_OPTIONS: { label: string; value: Frequency }[] = [
	{ label: __('Daily', 'vulopilot'), value: 'daily' },
	{ label: __('Weekly', 'vulopilot'), value: 'weekly' },
	{ label: __('Monthly', 'vulopilot'), value: 'monthly' },
];

const FREQUENCY_RANGE_NOTE: Record<Frequency, string> = {
	daily: __('Each run covers today.', 'vulopilot'),
	weekly: __('Each run covers the last 7 days.', 'vulopilot'),
	monthly: __('Each run covers the last 30 days.', 'vulopilot'),
};

const ScheduleReportModal = ({
	open,
	onClose,
	onScheduleCreated,
	editSchedule,
}: ScheduleReportModalProps) => {
	const isEditing = !!editSchedule;
	const [reportType, setReportType] = useState<ReportTypeChoice>('full');
	const [sectionIds, setSectionIds] = useState<string[]>(ALL_SECTION_IDS);
	const [frequency, setFrequency] = useState<Frequency>('monthly');
	const [recipients, setRecipients] = useState<string[]>([]);
	const [isSaving, setIsSaving] = useState(false);
	const recipientsInputRef = useRef<HTMLInputElement>(null);

	// Pre-fills from the row being edited every time the modal opens for it;
	// resets to fresh "create" defaults when it opens without one.
	useEffect(() => {
		if (!open) {
			return;
		}

		if (editSchedule) {
			setReportType(ID_TO_REPORT_TYPE[editSchedule.reportType] ?? 'full');
			setSectionIds(
				editSchedule.includedTypes.length > 0
					? editSchedule.includedTypes
					: ALL_SECTION_IDS
			);
			setFrequency(editSchedule.schedule);
			setRecipients(editSchedule.recipients);
		} else {
			setReportType('full');
			setSectionIds(ALL_SECTION_IDS);
			setFrequency('monthly');
			setRecipients([]);
		}
	}, [open, editSchedule]);

	const handleCreate = () => {
		// A typed-but-not-yet-Enter'd address (EmailInput's own commit
		// gesture) still counts — see resolvePendingRecipients()'s own
		// docblock for why this modal can't just trust `recipients` alone.
		const finalRecipients = resolvePendingRecipients(
			recipients,
			recipientsInputRef.current
		);

		if (0 === finalRecipients.length) {
			NoticeManager.add({
				uniqueKey: 'vulopilot-schedule-report-missing-recipients',
				type: 'error',
				position: 'float',
				message: __('Add at least one recipient.', 'vulopilot'),
			});
			return;
		}

		setIsSaving(true);

		const body = {
			report_type: REPORT_TYPE_TO_ID[reportType],
			schedule: frequency,
			recipients: finalRecipients,
			included_types: 'full' === reportType ? sectionIds : [],
		};

		const url = isEditing
			? getApiLink(appLocalizer, `report-schedules/${editSchedule.id}`)
			: getApiLink(appLocalizer, 'report-schedules');

		sendApiResponse(
			appLocalizer,
			url,
			isEditing ? body : { ...body, format: 'pdf' }
		)
			.then((response) => {
				if (!response) {
					NoticeManager.add({
						uniqueKey: 'vulopilot-schedule-report-failed',
						type: 'error',
						position: 'float',
						message: isEditing
							? __('Could not save this schedule. Please try again.', 'vulopilot')
							: __(
									'Could not create this schedule. Please try again.',
									'vulopilot'
								),
					});
					return;
				}

				NoticeManager.add({
					uniqueKey: 'vulopilot-schedule-report-created',
					type: 'success',
					position: 'float',
					message: isEditing
						? __('Report schedule updated.', 'vulopilot')
						: __('Report schedule created.', 'vulopilot'),
				});
				onScheduleCreated();
				onClose();
			})
			.finally(() => setIsSaving(false));
	};

	return (
		<PopupComponent
			open={open}
			onClose={onClose}
			width={31.25}
			height="auto"
			position="lightbox"
			className="schedule-report-popup"
			header={{
				icon: 'calendar',
				title: isEditing
					? __('Edit Schedule', 'vulopilot')
					: __('Schedule Report', 'vulopilot'),
				description: __(
					'Automatically generate and email this report on a recurring basis.',
					'vulopilot'
				),
			}}
			footer={
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
							text: isSaving
								? __('Saving…', 'vulopilot')
								: isEditing
									? __('Save Changes', 'vulopilot')
									: __('Schedule Report', 'vulopilot'),
							color: 'purple-bg',
							disabled: isSaving,
							onClick: handleCreate,
						}}
					/>
				</>
			}
		>
			<FormGroupWrapperComponent>
				<FormGroupComponent label={__('Report Type', 'vulopilot')}>
					<SelectInput
						name="schedule_report_type"
						value={reportType}
						options={REPORT_TYPE_OPTIONS}
						onChange={(value) => setReportType(value as ReportTypeChoice)}
					/>
				</FormGroupComponent>

				{'full' === reportType && (
					<FormGroupComponent label={__('Sections to Include', 'vulopilot')}>
						<MultiCheckboxInput
							options={SECTION_OPTIONS}
							value={sectionIds}
							modules={appLocalizer.active_modules}
							onChange={(values) =>
								setSectionIds(values.length > 0 ? values : sectionIds)
							}
						/>
					</FormGroupComponent>
				)}

				<FormGroupComponent
					label={__('Frequency', 'vulopilot')}
					desc={FREQUENCY_RANGE_NOTE[frequency]}
				>
					<SelectInput
						name="schedule_report_frequency"
						value={frequency}
						options={FREQUENCY_OPTIONS}
						onChange={(value) => setFrequency(value as Frequency)}
					/>
				</FormGroupComponent>

				<FormGroupComponent label={__('Recipients', 'vulopilot')}>
					<EmailInput
						ref={recipientsInputRef}
						mode="multiple"
						enablePrimary={false}
						value={recipients}
						placeholder={__('team@example.com', 'vulopilot')}
						onChange={(list) => setRecipients(list)}
					/>
				</FormGroupComponent>
			</FormGroupWrapperComponent>
		</PopupComponent>
	);
};

export default ScheduleReportModal;
