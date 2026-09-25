/* global vulopilotAppLocalizer */
import { __, sprintf } from '@wordpress/i18n';
import { PopupComponent, SectionComponent } from '@zyra/components';
import { ButtonInput, SelectInput } from '@zyra/inputs';
import { useState } from 'react';
import type { ComponentType } from 'react';
import { ADVANCED_REPORTS_MODULE_ID, DAY_OPTIONS } from './reportsOverview';
import ShowProPopup, { resolveModuleDisplayName } from '../../components/Popup/Popup';
import { useFilterSlot } from '../../services/useFilterSlot';

interface ReportsOverviewHeaderProps {
	days: number;
	onDaysChange: (days: number) => void;
	onDataChanged: () => void;
}

/**
 * The reference mockup's page-header row: "Reports" title + description on
 * the left, a "Last N days" range dropdown plus action buttons on the
 * right - a `SectionComponent` (its own `title`/`desc`/`rightContent`
 * props, same plain page-header shape SectionedIssuesTable.tsx's own
 * "Issues" heading already uses), not a `CardComponent` - no card border/
 * background here, just a real section divider.
 *
 * `days` is one of DAY_OPTIONS (7/30/90 - same 3-preset shape
 * WebsiteProgressChart.tsx already uses on this page) rather than an
 * arbitrary calendar range picker; shown as a real dropdown here instead of
 * the badge-toggle row this header used before, to match the mockup. It
 * only scopes `RecentReportsPanel`'s own preview - Report History stays a
 * real, unfiltered, paginated list of every report.
 */
const ReportsOverviewHeader = ({
	days,
	onDaysChange,
	onDataChanged,
}: ReportsOverviewHeaderProps) => {
	const [isProPopupOpen, setIsProPopupOpen] = useState(false);
	const RealActions = useFilterSlot<
		ComponentType<{ onDataChanged: () => void }>
	>('vulopilot_reports_header_actions');
	const isProInstalled = Boolean(vulopilotAppLocalizer.khali_dabba);
	const proTagText = isProInstalled
		? resolveModuleDisplayName(ADVANCED_REPORTS_MODULE_ID)
		: __('PRO', 'vulopilot');

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
							onChange={(newValue) => onDaysChange(Number(newValue))}
							size="10rem"
						/>
						{RealActions ? (
							<RealActions onDataChanged={onDataChanged} />
						) : (
							<>
								<span className="reports-overview-action-with-tag">
									<ButtonInput
										buttons={{
											text: __('Create Report', 'vulopilot'),
											icon: 'plus',
											color: 'border-purple',
											onClick: () => setIsProPopupOpen(true),
										}}
									/>
									{/* <span className="admin-tag pro-tag pro-tag-inline">
										<i className="adminfont-lock" />
										{proTagText}
									</span> */}
								</span>
								<span className="reports-overview-action-with-tag">
									<ButtonInput
										buttons={{
											text: __('Schedule Report', 'vulopilot'),
											icon: 'calendar',
											color: 'border-purple',
											onClick: () => setIsProPopupOpen(true),
										}}
									/>
									{/* <span className="admin-tag pro-tag pro-tag-inline">
										<i className="adminfont-lock" />
										{proTagText}
									</span> */}
								</span>
								<span className="reports-overview-action-with-tag">
									<ButtonInput
										buttons={{
											text: __('Download PDF', 'vulopilot'),
											icon: 'download',
											color: 'border-purple',
											onClick: () => setIsProPopupOpen(true),
										}}
									/>
									{/* <span className="admin-tag pro-tag pro-tag-inline">
										<i className="adminfont-lock" />
										{proTagText}
									</span> */}
								</span>
							</>
						)}
					</div>
				}
			/>
			<PopupComponent
				open={isProPopupOpen}
				onClose={() => setIsProPopupOpen(false)}
				width={31.25}
				height="auto"
				position="lightbox"
			>
				{isProInstalled ? (
					<ShowProPopup moduleName={ADVANCED_REPORTS_MODULE_ID} />
				) : (
					<ShowProPopup />
				)}
			</PopupComponent>
		</>
	);
};

export default ReportsOverviewHeader;
