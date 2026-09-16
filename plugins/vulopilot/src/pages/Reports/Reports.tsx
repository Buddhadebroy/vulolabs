import { useState } from 'react';
import { __ } from '@wordpress/i18n';
import { useLocation, Link } from 'react-router-dom';
import {
	NavigatorComponent,
	NavigatorHeaderComponent,
} from '@zyra/components';
import RunScanHeaderExtra from '../../components/RunScanHeaderExtra';
import OverviewTab from './OverviewTab';
import HistoryTab from './HistoryTab';

const TAB_IDS = ['overview', 'history'] as const;

const TAB_META: Record<
	(typeof TAB_IDS)[number],
	{ headerTitle: string; headerIcon: string }
> = {
	overview: { headerTitle: __('Overview', 'vulopilot'), headerIcon: 'bar-chart' },
	// Moved here from AI Copilot — a real, day-grouped scan/change/
	// conversation timeline (HistoryTab.tsx's own docblock), never
	// specific to that page's own chat surface.
	history: { headerTitle: __('History', 'vulopilot'), headerIcon: 'clock' },
};

/**
 * "Reports" — a tab shell, now just Overview/History per direct
 * instruction ("only two tab here one overview and history"). "Report
 * Builder" (ReportTab.tsx) and "Activity" (ActivityTab.tsx) were both
 * removed from TAB_IDS/TAB_META/getForm below — neither component file
 * was deleted (still real, valid code, just unreached from here now,
 * same "supersede, don't delete" posture this codebase already applies
 * elsewhere), so restoring either tab later is a one-line revert of this
 * change rather than a rebuild. Several real buttons still deep-link to
 * `#&tab=reports&subtab=report`/`subtab=activity` (OverviewTab.tsx's
 * "Create Report", ScheduledReportsTable.tsx's "Manage Schedules",
 * RecentReportsCard.tsx, RecentActivityCard.tsx/RecentActivityWidget.tsx,
 * TodaysTasksWidget.tsx, LiveThreatMonitorCard.tsx, searchIndex.ts) — with
 * neither id in `TAB_IDS` any more, `initialTab`'s own fallback below now
 * lands those clicks on Overview instead of a dead tab, not left
 * unhandled; those callers weren't touched as part of this change.
 *
 * "History" (HistoryTab.tsx) was moved here from AI Copilot's own tab
 * shell, which used to render it alongside Chat; AI Copilot now renders
 * Chat directly (AIAssistant.tsx), same "drop to one real section, no tab
 * bar" pattern Commerce.tsx/Security.tsx already established.
 *
 * Same `subtab` deep-link convention as every other tab shell
 * (`?page=vulopilot#&tab=reports&subtab=<inner-tab>`). Tab bar/body are
 * `NavigatorComponent` (`variant="tab"`) rather than a bare `TabsComponent`
 * — same real settings-navigator component AIAssistant.tsx's own tab shell
 * already uses, reused here instead of hand-rolling a second `TAB_IDS`-
 * driven tab bar. `headerTitle`/`headerDescription` are deliberately left
 * unset on it — this page's own `NavigatorHeaderComponent` above already
 * renders the page header, and passing them here would render a second,
 * duplicate one (`NavigatorHeaderComponent` only renders when at least one
 * of the two is set). `NavigatorComponent` also wraps its own tab body in
 * `ContainerComponent general` internally, so — unlike the old
 * `TabsComponent`, which needed one wrapped around it here to match the
 * left padding every other tab shell's own `ContainerComponent` already
 * gave it — there's no separate wrapper needed around it now. Each tab's
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

	// No setter needed — unlike AIAssistant.tsx's own `activeTab`, nothing
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
			/>
		</>
	);
};

export default Reports;
