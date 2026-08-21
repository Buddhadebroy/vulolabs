import { __ } from '@wordpress/i18n';
import { NavigatorHeaderComponent, ContainerComponent } from '@zyra/components';
import { useRunScan } from '../../services/useRunScan';
import SiteHealthTab from '../Security/SiteHealthTab';
import BackupsTab from '../Security/BackupsTab';
import BackupProtectionNotice from '../Security/BackupProtectionNotice';

/**
 * "Site Health" (WP menu slug `site-health`) — promoted out of the former
 * "Protect My Site" page's own 3-tab shell (Security.tsx), which used to
 * hold Security/Site Health/Backups as inner tabs. Security became its own
 * standalone top-level page; Site Health and Backups are merged here into
 * one page with no inner tab bar (per direct instruction) — the 5 real
 * health sections (SiteHealthTab.tsx) stacked above real backup management
 * (BackupsTab.tsx), rather than a second tab bar.
 *
 * `SiteHealthTab`/`BackupsTab`/`BackupProtectionNotice` are imported from
 * `../Security/` rather than physically moved — they're both still
 * genuinely shared with Security's own file tree there (`SectionedFindingsTab`,
 * `SectionedIssuesTable` types), same "kept here, cross-imported" choice
 * `Performance/OverviewTab.tsx` already makes for the Efficiency* cards it
 * shares with this same folder.
 *
 * `BackupProtectionNotice` moves here from Security.tsx's own header area
 * — it deep-links straight to this page now (no more `subtab=backups`,
 * since there's no inner tab bar to land on a specific one anymore).
 */
const SiteHealth = () => {
	// Scoped to the 5 real health-section categories — same "local tab"
	// scoping every other category page's header "Run scan" button uses.
	const { runScanButton } = useRunScan({
		categories: ['wordpress', 'server', 'cron', 'database', 'updates'],
	});

	return (
			<NavigatorHeaderComponent
				headerIcon="active"
				headerTitle={__('Site Health', 'vulopilot')}
				headerDescription={__(
					'A real-time check of your WordPress core, server, database, and backup protection.',
					'vulopilot'
				)}
				buttons={[runScanButton]}
			/>
			<ContainerComponent general>
			<BackupProtectionNotice />
			<SiteHealthTab />
			<BackupsTab />
		</ContainerComponent>
	);
};

export default SiteHealth;
