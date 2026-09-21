/* global appLocalizer */
import { useState } from 'react';
import type { ComponentType } from 'react';
import { __ } from '@wordpress/i18n';
import { CardComponent, PopupComponent } from '@zyra/components';
import { BlurredProContent } from '../../components/UpgradeToProOverlay';
import DummyDataNotice from '../../components/DummyDataNotice';
import ShowProPopup from '../../components/Popup/Popup';
import { ADVANCED_REPORTS_MODULE_ID } from './reportsOverview';
import ReportsDummyRows from './ReportsDummyRows';
import { useFilterSlot } from '../../services/useFilterSlot';

/**
 * The mockup's "Report History" table. Per direct instruction ("the
 * section is in free and the functionality code is in pro" — no duplicate
 * code), this component owns only the "section": the `CardComponent`
 * wrapper (`id="reports-history"`, title/description) — the real,
 * complete, paginated `GET /reports` list moved wholesale to
 * vulopilot-pro's own `AdvancedReports/src/ReportHistoryPanel.tsx` (that
 * logic no longer exists here at all, not duplicated), registered back in
 * via the `vulopilot_report_history_panel` filter slot (`useFilterSlot`,
 * same shape Commerce.tsx/KeywordsTab.tsx's own whole-panel Pro gates
 * already use).
 *
 * Free's own fallback below — `ReportsDummyRows` + `DummyDataNotice`
 * behind `BlurredProContent` — only renders when that slot resolves to
 * nothing, i.e. vulopilot-pro's AdvancedReports module isn't active; it
 * never fetches real report data itself.
 */
interface ReportHistoryTableProps {
	/** Bumped by OverviewTab.tsx once the real Pro actions generate a new report — passed straight through to ReportHistoryPanel's own refetch. */
	refreshSignal?: number;
}

const ReportHistoryTable = ({ refreshSignal }: ReportHistoryTableProps) => {
	const [isProPopupOpen, setIsProPopupOpen] = useState(false);
	const RealPanel = useFilterSlot<
		ComponentType<{ refreshSignal?: number }>
	>('vulopilot_report_history_panel');
	const isProInstalled = Boolean(appLocalizer.khali_dabba);

	return (
		<CardComponent
			id="reports-history"
			title={__('Report History', 'vulopilot')}
			titleIcon="clock"
			desc={__('A complete log of all generated reports.', 'vulopilot')}
		>
			{RealPanel ? (
				<RealPanel refreshSignal={refreshSignal} />
			) : (
				<>
					<BlurredProContent
						contentClassName="reports-dummy-content"
						onClick={() => setIsProPopupOpen(true)}
					>
						<ReportsDummyRows />
					</BlurredProContent>
					<DummyDataNotice />
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
			)}
		</CardComponent>
	);
};

export default ReportHistoryTable;
