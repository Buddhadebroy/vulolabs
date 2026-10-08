import { __, sprintf } from '@wordpress/i18n';
import { PopupComponent } from '@zyra/components';
import { ButtonInput, SelectInput } from '@zyra/inputs';
import { useState } from 'react';
import type { ComponentType } from 'react';
import { DAY_OPTIONS } from './reportsOverview';
import ShowProPopup from '../../components/Popup/Popup';
import { useFilterSlot } from '../../services/useFilterSlot';

interface ReportsOverviewActionsProps {
	days: number;
	// eslint-disable-next-line no-unused-vars
	onDaysChange: (days: number) => void;
	onDataChanged: () => void;
}

/**
 * The Overview tab's own "Last N days" range + Create Report/Schedule Report/Download PDF action
 * row - moved here from ReportsOverviewHeader.tsx's own `rightContent` (per direct instruction) so
 * Reports.tsx can render it in the page header's own `headerCustomContent` slot, replacing
 * "Run scan" there - but only while the Overview tab is active; History keeps "Run scan"
 * (RunScanHeaderExtra) as before.
 */
const ReportsOverviewActions = ({
	days,
	onDaysChange,
	onDataChanged,
}: ReportsOverviewActionsProps) => {
	const [isProPopupOpen, setIsProPopupOpen] = useState(false);
	const RealActions = useFilterSlot<
		ComponentType<{ onDataChanged: () => void }>
	>('vulopilot_reports_header_actions');

	return (
		<>
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
						</span>
					</>
				)}
			</div>
			<PopupComponent
				open={isProPopupOpen}
				onClose={() => setIsProPopupOpen(false)}
				width={31.25}
				height="auto"
				position="lightbox"
			>
				<ShowProPopup />
			</PopupComponent>
		</>
	);
};

export default ReportsOverviewActions;
