import { useState } from 'react';
import { __ } from '@wordpress/i18n';
import { useLocation } from 'react-router-dom';
import { NavigatorHeaderComponent, TabsComponent } from '@zyra/components';
import OverviewTab from './OverviewTab';
import ReportTab from './ReportTab';
import ActivityTab from './ActivityTab';

const TAB_IDS = ['overview', 'report', 'activity'] as const;

/**
 * "Reports" — a tab shell over three views: the mockup's new Overview
 * (OverviewTab.tsx), today's real report-generation/list page
 * (ReportTab.tsx, kept rather than replaced — same "keep the real page,
 * add the new mockup alongside it" move every prior Overview split this
 * session made), and the previously-separate Activity page
 * (ActivityTab.tsx, folded in — its own native WP submenu row was already
 * removed in favor of exactly this kind of re-surfacing, per
 * classes/Admin.php's legacy_submenus() docblock). Same `subtab` deep-link
 * convention as every other tab shell
 * (`?page=vulopilot#&tab=reports&subtab=<inner-tab>`).
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

	return (
		<>
			<NavigatorHeaderComponent
				headerIcon="report"
				headerTitle={__('Reports', 'vulopilot')}
				headerDescription={__(
					"AI-powered insights about your website's performance and growth.",
					'vulopilot'
				)}
			/>
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
						label: __('Report', 'vulopilot'),
						content: <ReportTab />,
					},
					{
						label: __('Activity', 'vulopilot'),
						content: <ActivityTab />,
					},
				]}
			/>
		</>
	);
};

export default Reports;
