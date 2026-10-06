import { useState } from 'react';
import { __ } from '@wordpress/i18n';
import { useLocation, Link } from 'react-router-dom';
import { NavigatorComponent } from '@zyra/components';
import RunScanHeaderExtra from '../../components/RunScanHeaderExtra';
import OverviewTab from './OverviewTab';
import HistoryTab from './HistoryTab';
import ReportsOverviewActions from './ReportsOverviewActions';
import { DAY_OPTIONS } from './reportsOverview';

const TAB_IDS = ['overview', 'history'] as const;

const TAB_META: Record<
	(typeof TAB_IDS)[number],
	{ headerTitle: string; headerIcon: string }
> = {
	overview: { headerTitle: __('Overview', 'vulopilot'), headerIcon: 'bar-chart' },
	// Moved here from AI Copilot - a real, day-grouped scan/change/ conversation timeline
	// (HistoryTab.tsx's own docblock).
	history: { headerTitle: __('History', 'vulopilot'), headerIcon: 'clock' },
};

/**
 * "Reports" - a tab shell, now just Overview/History. "Report Builder" (ReportTab.tsx) and
 * "Activity" (ActivityTab.tsx) were fully deleted.
 */
const Reports = () => {
	const subtab = new URLSearchParams(useLocation().hash.substring(1)).get(
		'subtab'
	);
	const initialTab = (
		subtab && (TAB_IDS as readonly string[]).includes(subtab)
			? subtab
			: 'overview'
	) as (typeof TAB_IDS)[number];

	// No setter needed - unlike AIAssistant.tsx's own `activeTab`, nothing here ever triggers a
	// cross-tab jump from inside a tab's own content.
	const [activeTab] = useState<(typeof TAB_IDS)[number]>(initialTab);

	// Lifted up from OverviewTab.tsx so the page header's own `headerCustomContent`
	// (ReportsOverviewActions.tsx, Overview tab only) and OverviewTab's own cards read the same
	// real state, not two separate copies of it.
	const [days, setDays] = useState<number>(DAY_OPTIONS[1]);
	const [refreshKey, setRefreshKey] = useState(0);

	const settingContent = TAB_IDS.map((tabId) => ({
		type: 'file' as const,
		content: {
			id: tabId,
			headerTitle: TAB_META[tabId].headerTitle,
			headerIcon: TAB_META[tabId].headerIcon,
			hideSettingHeader: true,
		},
	}));

	const getForm = (tabId: string) => {
		switch (tabId) {
			case 'overview':
				return <OverviewTab days={days} refreshKey={refreshKey} />;
			case 'history':
				return <HistoryTab />;
			default:
				return <div></div>;
		}
	};

	return (
		<>
			<NavigatorComponent
				className="reports-tabs"
				settingContent={settingContent}
				currentSetting={activeTab}
				getForm={getForm}
				headerCustomContent={
					'overview' === activeTab ? (
						<ReportsOverviewActions
							days={days}
							onDaysChange={setDays}
							onDataChanged={() => setRefreshKey((key) => key + 1)}
						/>
					) : (
						<RunScanHeaderExtra settingsSubtab="reports" />
					)
				}
				settingName="Reports"
				prepareUrl={(subTab: string) =>
					`?page=vulopilot#&tab=reports&subtab=${subTab}`
				}
				Link={Link}
				// Each tab's own real `headerIcon` (TAB_META above) was already being passed
				// through `settingContent`.
				menuIcon
			/>
		</>
	);
};

export default Reports;
