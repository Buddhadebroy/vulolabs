/* global appLocalizer */
import { useState } from 'react';
import type { ComponentType } from 'react';
import { __ } from '@wordpress/i18n';
import { BadgeComponent, CardComponent, PopupComponent } from '@zyra/components';
import ShowProPopup from '../../components/Popup/Popup';
import { BlurredProContent } from '../../components/UpgradeToProOverlay';
import DummyDataNotice from '../../components/DummyDataNotice';
import { ADVANCED_REPORTS_MODULE_ID } from './reportsOverview';
import { useFilterSlot } from '../../services/useFilterSlot';

/**
 * Fabricated preview rows — same "obviously fake" reasoning
 * reportsOverview.ts's own `DUMMY_REPORT_ROWS` documents, shaped for this
 * table's own columns (frequency/recipients) rather than a report row's.
 */
const DUMMY_SCHEDULE_ROWS = [
	{
		id: 'dummy-1',
		name: __('Full Website Report', 'vulopilot'),
		shortLabel: __('Full Website', 'vulopilot'),
		badgeColor: 'indigo',
		icon: 'global-community',
		frequency: __('Weekly', 'vulopilot'),
		recipients: __('team@example.com', 'vulopilot'),
	},
	{
		id: 'dummy-2',
		name: __('SEO Report', 'vulopilot'),
		shortLabel: __('SEO', 'vulopilot'),
		badgeColor: 'pink',
		icon: 'search-discovery',
		frequency: __('Monthly', 'vulopilot'),
		recipients: __('client@example.com', 'vulopilot'),
	},
];

/**
 * The mockup's "Scheduled Reports" table. Per direct instruction ("the
 * section is in free and the functionality code is in pro" — no duplicate
 * code), this component owns only the "section": the `CardComponent`
 * wrapper (`id="reports-schedules"`, title/description) — the real
 * `GET /report-schedules` list, Send Now/Edit/Pause-Resume/Delete actions,
 * and the Edit modal moved wholesale to vulopilot-pro's own
 * `AdvancedReports/src/ScheduledReportsPanel.tsx` (that logic no longer
 * exists here at all, not duplicated), registered back in via the
 * `vulopilot_scheduled_reports_panel` filter slot (`useFilterSlot`, same
 * shape Commerce.tsx/KeywordsTab.tsx's own whole-panel Pro gates already
 * use).
 *
 * Free's own fallback below — `DUMMY_SCHEDULE_ROWS` behind
 * `BlurredProContent` + `DummyDataNotice` — only renders when that slot
 * resolves to nothing, i.e. vulopilot-pro's AdvancedReports module isn't
 * active; it never reaches the real `GET /report-schedules` endpoint at
 * all (that route doesn't even exist without this module active).
 * Clicking anywhere in it opens the real generic upgrade popup
 * (`ShowProPopup`, no props — same "Unlock the full VuloPilot toolkit"
 * pitch every other Pro-locked surface on this page uses).
 */
interface ScheduledReportsTableProps {
	/** Bumped by OverviewTab.tsx once the real Pro actions save a schedule — passed straight through to ScheduledReportsPanel's own refetch. */
	refreshSignal?: number;
}

const ScheduledReportsTable = ({ refreshSignal }: ScheduledReportsTableProps) => {
	const [isProPopupOpen, setIsProPopupOpen] = useState(false);
	const RealPanel = useFilterSlot<
		ComponentType<{ refreshSignal?: number }>
	>('vulopilot_scheduled_reports_panel');
	const isProInstalled = Boolean(appLocalizer.khali_dabba);

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
		>
			{RealPanel ? (
				<RealPanel refreshSignal={refreshSignal} />
			) : (
				<>
					<BlurredProContent
						contentClassName="reports-dummy-content"
						onClick={() => setIsProPopupOpen(true)}
					>
						<div className="reports-dummy-rows">
							{DUMMY_SCHEDULE_ROWS.map((row) => (
								<div className="reports-dummy-row" key={row.id}>
									<i className={`adminfont-${row.icon} reports-dummy-row-icon`} />
									<div className="reports-dummy-row-main">
										<span className="reports-dummy-row-name">{row.name}</span>
										<span className="reports-dummy-row-period">{row.recipients}</span>
									</div>
									<BadgeComponent color={row.badgeColor} text={row.shortLabel} />
									<span>{row.frequency}</span>
									<BadgeComponent color="green" text={__('Enabled', 'vulopilot')} />
									<span className="reports-dummy-row-actions">
										{__('Send Now', 'vulopilot')} · {__('Edit', 'vulopilot')}
									</span>
								</div>
							))}
						</div>
					</BlurredProContent>
					<DummyDataNotice />
					<PopupComponent
						position="lightbox"
						open={isProPopupOpen}
						onClose={() => setIsProPopupOpen(false)}
						width={31.25}
						height="auto"
					>
						{isProInstalled ? (
							<ShowProPopup moduleName={ADVANCED_REPORTS_MODULE_ID} />
						) : (
							<ShowProPopup />
						)}
					</PopupComponent>
				</>
			)}
		</CardComponent>
	);
};

export default ScheduledReportsTable;
