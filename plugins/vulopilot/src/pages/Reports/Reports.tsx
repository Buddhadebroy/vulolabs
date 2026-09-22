import { useState } from 'react';
import { __ } from '@wordpress/i18n';
import { useLocation, Link } from 'react-router-dom';
import { NavigatorComponent } from '@zyra/components';
import RunScanHeaderExtra from '../../components/RunScanHeaderExtra';
import OverviewTab from './OverviewTab';
import HistoryTab from './HistoryTab';

const TAB_IDS = ['overview', 'history'] as const;

const TAB_META: Record<
	(typeof TAB_IDS)[number],
	{ headerTitle: string; headerIcon: string }
> = {
	overview: { headerTitle: __('Overview', 'vulopilot'), headerIcon: 'bar-chart' },
	// Moved here from AI Copilot - a real, day-grouped scan/change/
	// conversation timeline (HistoryTab.tsx's own docblock), never
	// specific to that page's own chat surface.
	history: { headerTitle: __('History', 'vulopilot'), headerIcon: 'clock' },
};

/**
 * "Reports" - a tab shell, now just Overview/History per direct
 * instruction ("only two tab here one overview and history"). "Report
 * Builder" (ReportTab.tsx) and "Activity" (ActivityTab.tsx) were fully
 * deleted, per direct instruction, along with every real button/link
 * elsewhere that deep-linked to them (`#&tab=reports&subtab=report`/
 * `subtab=activity`) - see those call sites' own docblocks
 * (OverviewTab.tsx/RecentActivityCard.tsx/LiveThreatMonitorCard.tsx/
 * RecentActivityWidget.tsx/TodaysTasksWidget.tsx/ReportsOverviewHeader.tsx/
 * ScheduledReportsTable.tsx/searchIndex.ts) for what each one used to do.
 * `ReportTab.tsx`'s own second section (ReportSchedulesSummary.tsx, the
 * real create-schedule form) went with it - `ScheduledReportsTable.tsx`
 * (still real, still on Overview) can no longer deep-link admins to a
 * "create a new schedule" flow as a result; flagged rather than silently
 * left half-working, since nothing here rebuilds that flow elsewhere.
 *
 * "History" (HistoryTab.tsx) was moved here from AI Copilot's own tab
 * shell, which used to render it alongside Chat; AI Copilot now renders
 * Chat directly (AIAssistant.tsx), same "drop to one real section, no tab
 * bar" pattern Commerce.tsx/Security.tsx already established.
 *
 * Same `subtab` deep-link convention as every other tab shell
 * (`?page=vulopilot#&tab=reports&subtab=<inner-tab>`). Tab bar/body are
 * `NavigatorComponent` (`variant="tab"`) rather than a bare `TabsComponent`
 * - same real settings-navigator component AIAssistant.tsx's own tab shell
 * already uses, reused here instead of hand-rolling a second `TAB_IDS`-
 * driven tab bar. `headerTitle`/`headerDescription` are deliberately left
 * unset on it - this page's own `NavigatorHeaderComponent` above already
 * renders the page header, and passing them here would render a second,
 * duplicate one (`NavigatorHeaderComponent` only renders when at least one
 * of the two is set). `NavigatorComponent` also wraps its own tab body in
 * `ContainerComponent general` internally, so - unlike the old
 * `TabsComponent`, which needed one wrapped around it here to match the
 * left padding every other tab shell's own `ContainerComponent` already
 * gave it - there's no separate wrapper needed around it now. Each tab's
 * `hideSettingHeader: true` suppresses `NavigatorComponent`'s own per-tab
 * title/description section, since `OverviewTab`/`HistoryTab` already
 * render their own.
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

	// No setter needed - unlike AIAssistant.tsx's own `activeTab`, nothing
	// here ever triggers a cross-tab jump from inside a tab's own content,
	// so this only ever seeds NavigatorComponent's `currentSetting` with
	// the URL's initial `subtab`; NavigatorComponent tracks the active tab
	// itself from there (its own `activeSetting` state, updated by its
	// tab-bar Link clicks / prepareUrl's pushState).
	const [activeTab] = useState<(typeof TAB_IDS)[number]>(initialTab);
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
				return <OverviewTab />;
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
					<RunScanHeaderExtra settingsSubtab="reports" />
				}
				settingName="Reports"
				prepareUrl={(subTab: string) =>
					`?page=vulopilot#&tab=reports&subtab=${subTab}`
				}
				Link={Link}
				// Each tab's own real `headerIcon` (TAB_META above) was already
				// being passed through `settingContent`, but
				// NavigatorComponent.tsx only ever renders a tab-bar icon when
				// this `menuIcon` prop is set (confirmed by reading zyra's own
				// source) - every sibling tab shell that shows icons
				// (SeoVisibility.tsx/Performance.tsx/SiteHealth.tsx) already
				// sets it; this page was the one missing it.
				menuIcon
			/>
		</>
	);
};

export default Reports;
