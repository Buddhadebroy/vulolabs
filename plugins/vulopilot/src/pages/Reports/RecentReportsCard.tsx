/* global vulopilotAppLocalizer */
import { useState } from 'react';
import type { ComponentType } from 'react';
import { __ } from '@wordpress/i18n';
import { scrollToId } from '@zyra/core';
import { CardComponent, PopupComponent } from '@zyra/components';
import { ButtonInput } from '@zyra/inputs';
import { BlurredProContent } from '../../components/UpgradeToProOverlay';
import DummyDataNotice from '../../components/DummyDataNotice';
import ShowProPopup from '../../components/Popup/Popup';
import { ADVANCED_REPORTS_MODULE_ID } from './reportsOverview';
import ReportsDummyRows from './ReportsDummyRows';
import { useFilterSlot } from '../../services/useFilterSlot';

/**
 * The mockup's "Recent Reports" card. Per direct instruction ("the section
 * is in free and the functionality code is in pro" - no duplicate code),
 * this component owns only the "section": the `CardComponent` wrapper,
 * its title/description, and the "View All Reports" action. The real
 * data-fetching/table (scoped to `days`, capped to 6 rows) moved wholesale
 * to vulopilot-pro's own `AdvancedReports/src/RecentReportsPanel.tsx`
 * (that logic no longer exists here at all, not duplicated), registered
 * back in via the `vulopilot_recent_reports_panel` filter slot
 * (`useFilterSlot`, same shape Commerce.tsx/KeywordsTab.tsx's own
 * whole-panel Pro gates already use).
 *
 * Free's own fallback below - `ReportsDummyRows` + `DummyDataNotice`
 * behind `BlurredProContent` - only renders when that slot resolves to
 * nothing, i.e. vulopilot-pro's AdvancedReports module isn't active; it
 * never fetches real report data itself.
 */
interface RecentReportsCardProps {
	days: number;
	/** Bumped by OverviewTab.tsx once the real Pro actions generate a new report - passed straight through to RecentReportsPanel's own refetch. */
	refreshSignal?: number;
}

const RecentReportsCard = ({ days, refreshSignal }: RecentReportsCardProps) => {
	const [isProPopupOpen, setIsProPopupOpen] = useState(false);
	const RealPanel = useFilterSlot<
		ComponentType<{ days: number; refreshSignal?: number }>
	>('vulopilot_recent_reports_panel');
	const isProInstalled = Boolean(vulopilotAppLocalizer.khali_dabba);

	return (
		<CardComponent
			title={__('Recent Reports', 'vulopilot')}
			titleIcon="document"
			desc={__('Your latest generated reports.', 'vulopilot')}
			action={
				<ButtonInput
					buttons={{
						text: __('View All Reports', 'vulopilot'),
						rightIcon: 'arrow-right',
						color: 'text-purple',
						onClick: () => scrollToId('reports-history'),
					}}
				/>
			}
		>
			{RealPanel ? (
				<RealPanel days={days} refreshSignal={refreshSignal} />
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

export default RecentReportsCard;
