import { useState } from 'react';
import { __ } from '@wordpress/i18n';
import { useLocation } from 'react-router-dom';
import {
	ContainerComponent,
	NavigatorHeaderComponent,
	TabsComponent,
} from '@zyra/components';
import { useRunScan } from '../../services/useRunScan';
import OverviewTab from './OverviewTab';
import ReportTab from './ReportTab';
import ActivityTab from './ActivityTab';

const TAB_IDS = ['overview', 'report', 'activity'] as const;

/**
 * "Reports" — a tab shell. The reference mockup originally showed 3 tabs
 * (Overview/Report Builder/Scheduled Reports); "Scheduled Reports" has
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
 * (`?page=vulopilot#&tab=reports&subtab=<inner-tab>`). `TabsComponent`
 * is wrapped in its own `ContainerComponent general` here — every other
 * multi-tab page shell (Automation.tsx/Performance.tsx/Security.tsx)
 * already wraps its own `TabsComponent` this way; this page previously
 * didn't, so the tab bar rendered flush against the page edge instead of
 * sharing the same left padding as the tab content below it, reading as
 * "left aligned" relative to it.
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

	const [activeTab, setActiveTab] =
		useState<(typeof TAB_IDS)[number]>(initialTab);
	// Whole-site scan, same reasoning Dashboard's Run Audit widget/
	// Health.tsx's own header button already use (this page reports on
	// every category, not one).
	const { runScanButton } = useRunScan();

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
			<ContainerComponent general>
				<TabsComponent
					className="reports-tabs"
					activeIndex={TAB_IDS.indexOf(activeTab)}
					onTabChange={(index) => setActiveTab(TAB_IDS[index])}
					tabs={[
						{
							label: __('Overview', 'vulopilot'),
							content: <OverviewTab />,
						},
						{
							label: __('Report Builder', 'vulopilot'),
							content: <ReportTab />,
						},
						{
							label: __('Activity', 'vulopilot'),
							content: <ActivityTab />,
						},
					]}
				/>
			</ContainerComponent>
		</>
	);
};

export default Reports;
