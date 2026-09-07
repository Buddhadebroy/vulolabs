import { useState } from 'react';
import { __ } from '@wordpress/i18n';
import { useLocation, Link } from 'react-router-dom';
import { NavigatorComponent } from '@zyra/components';
import RunScanHeaderExtra from '../../components/RunScanHeaderExtra';
import OverviewTab from './OverviewTab';
import SlowPagesTab from './SlowPagesTab';

const TAB_IDS = ['overview', 'slow-pages'] as const;

const TAB_META: Record<
	(typeof TAB_IDS)[number],
	{ headerTitle: string; headerIcon: string }
> = {
	overview: { headerTitle: __('Overview', 'vulopilot'), headerIcon: 'bar-chart' },
	'slow-pages': { headerTitle: __('Slow Pages', 'vulopilot'), headerIcon: 'clock' },
};

/**
 * "Performance" (WP menu slug `performance`) — Overview (OverviewTab.tsx)
 * and a real "Slow Pages" tab (SlowPagesTab.tsx, a real per-page speed
 * report — Repositories\PageSpeedRepository, populated in the background by
 * Services\PageSpeedScanner). Its former sibling tabs are otherwise gone:
 * the standalone "Performance" tab (PerformanceTab.tsx, now deleted) had its
 * full category-'performance' FindingsTable moved down into Overview itself
 * (`#performance-section-findings`) rather than kept on its own tab;
 * "Redirects & 404s" moved to "SEO & Visibility"
 * (`src/pages/GEO/RedirectsTab.tsx`); "Performance Opportunities"
 * (PerformanceOpportunitiesTab.tsx, removed) surfaced the same
 * PageSpeedRepository::get_top_issues() data Slow Pages' own sidebar
 * already shows, as its own tab.
 *
 * Tab bar/body are one `NavigatorComponent` rather than a bare
 * `TabsComponent` — same real settings-navigator component
 * SeoVisibility.tsx's own tab shell already uses, reused here instead of
 * hand-rolling a second `TAB_IDS`-driven tab bar. The page header
 * (`headerIcon`/`headerTitle`/`headerCustomContent`) is folded directly
 * into this one `NavigatorComponent` call — same "one component, no
 * separate `NavigatorHeaderComponent`" shape SeoVisibility.tsx's own
 * conversion already uses — rather than a second, standalone header
 * component above it. `NavigatorComponent` also wraps its own tab body in
 * `ContainerComponent general` internally, so — unlike the old
 * `TabsComponent`, which needed one wrapped around it here — there's no
 * separate wrapper needed any more. Each tab's `hideSettingHeader: true`
 * suppresses `NavigatorComponent`'s own per-tab title/description
 * section, since `OverviewTab`/`SlowPagesTab` already render their own.
 *
 * `activeTab` is still owned here (not left as `NavigatorComponent`'s own
 * uncontrolled tracking) so PerformanceScoreCard's "View Slow Pages"
 * button can jump straight to the Slow Pages tab — fed into
 * `NavigatorComponent`'s own `currentSetting` prop, same "re-syncs its
 * internal active tab whenever `currentSetting` changes, not just on
 * mount" behavior SeoVisibility.tsx's own conversion already relies on
 * for the same kind of cross-tab jump.
 */
const Performance = () => {
	const subtab = new URLSearchParams(useLocation().hash.substring(1)).get(
		'subtab'
	);
	const initialTab = (
		subtab && (TAB_IDS as readonly string[]).includes(subtab)
			? subtab
			: 'overview'
	) as (typeof TAB_IDS)[number];

	const [activeTab, setActiveTab] = useState<(typeof TAB_IDS)[number]>(
		initialTab
	);
	const goToSlowPages = () => setActiveTab('slow-pages');

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
				return <OverviewTab onNavigateToSlowPages={goToSlowPages} />;
			case 'slow-pages':
				return <SlowPagesTab />;
			default:
				return <div></div>;
		}
	};

	return (
		<>
			<NavigatorComponent
				headerIcon="bar-chart"
				headerTitle={__('Performance', 'vulopilot')}
				// headerDescription={__(
				// 	'Make your website faster and deliver a better experience to your visitors.',
				// 	'vulopilot'
				// )}
				headerCustomContent={
					<RunScanHeaderExtra
						categories={['performance']}
						settingsSubtab="performance"
						label={__('Run Speed Test', 'vulopilot')}
					/>
				}
				className="performance-tabs"
				settingContent={settingContent}
				currentSetting={activeTab}
				getForm={getForm}
				prepareUrl={(subTab: string) =>
					`?page=vulopilot#&tab=performance&subtab=${subTab}`
				}
				Link={Link}
				settingName="Performance"
				menuIcon
			/>
		</>
	);
};

export default Performance;
