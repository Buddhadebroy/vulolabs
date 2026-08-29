import { useState } from 'react';
import { __ } from '@wordpress/i18n';
import { useLocation } from 'react-router-dom';
import {
	ContainerComponent,
	NavigatorHeaderComponent,
	TabsComponent,
} from '@zyra/components';
import RunScanHeaderExtra from '../../components/RunScanHeaderExtra';
import { pushSubtabUrl } from '../../services/pushSubtabUrl';
import SiteHealthTab from '../Security/SiteHealthTab';
import BackupsTab from '../Security/BackupsTab';
import BackupProtectionNotice from '../Security/BackupProtectionNotice';

const TAB_IDS = ['site-health', 'backups'] as const;

/**
 * "Site Health" (WP menu slug `site-health`) — promoted out of the former
 * "Protect My Site" page's own 3-tab shell (Security.tsx), which used to
 * hold Security/Site Health/Backups as inner tabs. Security became its own
 * standalone top-level page; Site Health and Backups are merged into this
 * one page as 2 real inner tabs — Site Health first (SiteHealthTab.tsx),
 * Backups second (BackupsTab.tsx) — same real `activeIndex`/`onTabChange`
 * + `subtab` deep-link shape Performance.tsx/GEO.tsx/Security.tsx already
 * use, replacing this page's own former no-tab-bar stacked layout.
 *
 * `SiteHealthTab`/`BackupsTab`/`BackupProtectionNotice` are imported from
 * `../Security/` rather than physically moved — they're both still
 * genuinely shared with Security's own file tree there (`SectionedFindingsTab`,
 * `SectionedIssuesTable` types), same "kept here, cross-imported" choice
 * `Performance/OverviewTab.tsx` already makes for the Efficiency* cards it
 * shares with this same folder.
 *
 * `BackupProtectionNotice` stays above the tab bar (visible on both tabs,
 * same spot it held in the former stacked layout) — its own "View Backups"
 * action now switches this page's real `backups` tab in place
 * (`onNavigateToBackups`) instead of a full reload back to this same page.
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
	const goToBackups = () => setActiveTab('backups');

	return (
		<>
			<NavigatorHeaderComponent
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
			/>
			<ContainerComponent general>
				<BackupProtectionNotice onNavigateToBackups={goToBackups} />
				<TabsComponent
					className="site-health-tabs"
					activeIndex={TAB_IDS.indexOf(activeTab)}
					onTabChange={(index) => {
						setActiveTab(TAB_IDS[index]);
						pushSubtabUrl('site-health', TAB_IDS[index]);
					}}
					tabs={[
						{
							label: __('Site Health', 'vulopilot'),
							content: <SiteHealthTab />,
						},
						{
							label: __('Backups', 'vulopilot'),
							content: <BackupsTab />,
						},
					]}
				/>
			</ContainerComponent>
		</>
	);
};

export default SiteHealth;
