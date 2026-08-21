import { useState } from 'react';
import { __ } from '@wordpress/i18n';
import { useLocation, Link } from 'react-router-dom';
import {
	NavigatorComponent,
	NavigatorHeaderComponent,
} from '@zyra/components';
import { useRunScan } from '../../services/useRunScan';
import OverviewTab from './OverviewTab';
import ReportTab from './ReportTab';
import ActivityTab from './ActivityTab';
import HistoryTab from './HistoryTab';

const TAB_IDS = ['overview', 'report', 'activity', 'history'] as const;

const TAB_META: Record<
	(typeof TAB_IDS)[number],
	{ headerTitle: string; headerIcon: string }
> = {
	overview: { headerTitle: __('Overview', 'vulopilot'), headerIcon: 'bar-chart' },
	report: { headerTitle: __('Report Builder', 'vulopilot'), headerIcon: 'report' },
	activity: { headerTitle: __('Activity', 'vulopilot'), headerIcon: 'clock' },
	// Moved here from AI Copilot — a real, day-grouped scan/change/
	// conversation timeline (HistoryTab.tsx's own docblock), never
	// specific to that page's own chat surface. Kept as its own tab
	// alongside Activity rather than merged into it — different source/
	// shape (GET /history's 3-way scan+change+conversation join vs
	// Activity's flat GET /activity-logs), per direct instruction.
	history: { headerTitle: __('History', 'vulopilot'), headerIcon: 'history' },
};

/**
 * "Reports" — a tab shell. A 4th tab, "History" (HistoryTab.tsx), was
 * added later — moved here from AI Copilot's own tab shell, which used
 * to render it alongside Chat; AI Copilot now renders Chat directly
 * (AIAssistant.tsx), same "drop to one real section, no tab bar" pattern
 * Commerce.tsx/Security.tsx already established. The reference mockup
 * originally showed 3 tabs (Overview/Report Builder/Scheduled Reports);
 * "Scheduled Reports" has
 * since been merged into "Report Builder" per direct instruction (its
 * content — ReportSchedulesSummary.tsx plus the Pro schedule-management
 * panel — now lives inside ReportTab.tsx's own second section; see that
 * file's own docblock), leaving Overview/Report Builder/Activity
 * (ActivityTab.tsx, folded in from its own now-removed native WP submenu
 * row, per classes/Admin.php's legacy_submenus() docblock), same "match
 * the mockup's own visible tabs, don't delete real functionality the
 * mockup doesn't happen to show" move Protect My Site's own
 * Performance-tab addition already made for Site Health/Files & Plugins.
 * There was also briefly a flat "Security" tab here (Reports/SecurityTab.tsx,
 * `category="security"` FindingsTable) — removed per direct instruction;
 * Protect My Site's own Security tab (SecurityTab.tsx) is the real,
 * complete home for security findings now (it scopes to a full
 * 14-scanner-id list rather than the narrower `category="security"` this
 * deleted tab used, so nothing here was lost — the deleted tab actually
 * undercounted relative to it).
 *
 * - Overview (OverviewTab.tsx) — the redesigned mockup's own dashboard.
 * - "Report" is relabeled "Report Builder" here (ReportTab.tsx —
 *   today's real report-generation/list page, now also the real home for
 *   scheduled reports).
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
 * title/description section, since `OverviewTab`/`ReportTab`/`ActivityTab`
 * already render their own.
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
	// Whole-site scan, same reasoning Dashboard's Run Audit widget/
	// Health.tsx's own header button already use (this page reports on
	// every category, not one).
	const { runScanButton } = useRunScan();

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
			case 'report':
				return <ReportTab />;
			case 'activity':
				return <ActivityTab />;
			case 'history':
				return <HistoryTab />;
			default:
				return <div></div>;
		}
	};

	return (
		<>
			<NavigatorHeaderComponent
				headerIcon="report"
				headerTitle={__('Reports', 'vulopilot')}
				headerDescription={__(
					"AI-powered insights about your website's performance and growth.",
					'vulopilot'
				)}
				buttons={[runScanButton]}
			/>
			<NavigatorComponent
				className="reports-tabs"
				settingContent={settingContent}
				currentSetting={activeTab}
				getForm={getForm}
				prepareUrl={(subTab: string) =>
					`?page=vulopilot#&tab=reports&subtab=${subTab}`
				}
				Link={Link}
				variant="tab"
			/>
		</>
	);
};

export default Reports;
