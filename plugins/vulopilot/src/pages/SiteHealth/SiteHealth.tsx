import { useState } from 'react';
import { __ } from '@wordpress/i18n';
import { useLocation, Link } from 'react-router-dom';
import { NavigatorComponent } from '@zyra/components';
import RunScanHeaderExtra from '../../components/RunScanHeaderExtra';
import SiteHealthTab from '../Security/SiteHealthTab';
import BackupsTab from '../Security/BackupsTab';

const TAB_IDS = ['site-health', 'backups'] as const;

const TAB_META: Record<
	(typeof TAB_IDS)[number],
	{ headerTitle: string; headerIcon: string }
> = {
	'site-health': { headerTitle: __('Site Health', 'vulopilot'), headerIcon: 'active' },
	backups: { headerTitle: __('Backups', 'vulopilot'), headerIcon: 'error' },
};

/**
 * "Site Health" (WP menu slug `site-health`) — promoted out of the former
 * "Protect My Site" page's own 3-tab shell (Security.tsx), which used to
 * hold Security/Site Health/Backups as inner tabs. Security became its own
 * standalone top-level page; Site Health and Backups are merged into this
 * one page as 2 real inner tabs — Site Health first (SiteHealthTab.tsx),
 * Backups second (BackupsTab.tsx).
 *
 * Tab bar/body are one `NavigatorComponent` rather than a bare
 * `TabsComponent` — same real settings-navigator component
 * Performance.tsx/SeoVisibility.tsx's own tab shells already use, reused
 * here instead of a hand-rolled `TAB_IDS`-driven `TabsComponent` +
 * separate `NavigatorHeaderComponent` above it. `NavigatorComponent` wraps
 * its own tab body in `ContainerComponent general` internally, so no
 * separate wrapper is needed here either. Each tab's `hideSettingHeader:
 * true` suppresses `NavigatorComponent`'s own per-tab title/description
 * section, since `SiteHealthTab`/`BackupsTab` already render their own.
 *
 * `activeTab` is still owned here (not left as `NavigatorComponent`'s own
 * uncontrolled tracking) so `BackupProtectionNotice`'s "View Backups"
 * action (rendered inside `SiteHealthTab.tsx`) can jump straight to the
 * Backups tab in place instead of a full reload — fed into
 * `NavigatorComponent`'s own `currentSetting` prop, same "re-syncs its
 * internal active tab whenever `currentSetting` changes, not just on
 * mount" behavior Performance.tsx's own conversion already relies on for
 * the same kind of cross-tab jump.
 *
 * `goToBackups()` also pushes the matching URL itself
 * (`window.history.pushState`) — confirmed live: `NavigatorComponent`'s own
 * `useEffect` that reacts to a `currentSetting` prop change (as opposed to
 * one of its own tab-bar `Link` clicks) only updates its internal active
 * tab, it never calls `prepareUrl`/`pushState` for that path (that's
 * install-specific to its own `navigate()`, run only from a real click).
 * Left alone, the panel content correctly swapped to Backups but the
 * address bar silently kept showing Site Health — refreshing, using back,
 * or sharing/copying the link would all land back on Site Health instead.
 * The `window.history.pushState(null, '', url)` call below is the exact
 * same real call zyra's own `navigate()` makes for a genuine tab click
 * (confirmed by reading the installed `@multivendorx/zyra` build), so this
 * keeps the address bar in sync the same way a direct click already does.
 *
 * `SiteHealthTab`/`BackupsTab` are imported from `../Security/` rather
 * than physically moved — they're both still genuinely shared with
 * Security's own file tree there (`SectionedFindingsTab`,
 * `SectionedIssuesTable` types), same "kept here, cross-imported" choice
 * `Performance/OverviewTab.tsx` already makes for the Efficiency* cards it
 * shares with this same folder. `BackupProtectionNotice` itself renders
 * inside `SiteHealthTab.tsx` (its own header, right before
 * `SiteHealthStatusCard`) rather than above the tab bar here.
 */
const SiteHealth = () => {
	const subtab = new URLSearchParams(useLocation().hash.substring(1)).get(
		'subtab'
	);
	const initialTab = (
		subtab && (TAB_IDS as readonly string[]).includes(subtab)
			? subtab
			: 'site-health'
	) as (typeof TAB_IDS)[number];

	const [activeTab, setActiveTab] = useState<(typeof TAB_IDS)[number]>(
		initialTab
	);

	const prepareUrl = (subTab: string) =>
		`?page=vulopilot#&tab=site-health&subtab=${subTab}`;

	const goToBackups = () => {
		setActiveTab('backups');
		window.history.pushState(null, '', prepareUrl('backups'));
	};

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
			case 'site-health':
				return <SiteHealthTab onNavigateToBackups={goToBackups} />;
			case 'backups':
				return <BackupsTab />;
			default:
				return <div></div>;
		}
	};

	return (
		<NavigatorComponent
			headerIcon="active"
			headerTitle={__('Site Health', 'vulopilot')}
			headerDescription={__(
				'A real-time check of your WordPress core, server, database, and backup protection.',
				'vulopilot'
			)}
			headerCustomContent={
				<RunScanHeaderExtra
					categories={[
						'wordpress',
						'server',
						'cron',
						'database',
						'updates',
					]}
					settingsSubtab="general"
				/>
			}
			className="site-health-tabs"
			settingContent={settingContent}
			currentSetting={activeTab}
			getForm={getForm}
			prepareUrl={prepareUrl}
			Link={Link}
			settingName="Site Health"
			menuIcon
		/>
	);
};

export default SiteHealth;
