import { useState } from 'react';
import { __ } from '@wordpress/i18n';
import { useLocation } from 'react-router-dom';
import {
	ContainerComponent,
	NavigatorHeaderComponent,
	TabsComponent,
} from '@zyra/components';
import { useRunScan } from '../../services/useRunScan';
import { pushSubtabUrl } from '../../services/pushSubtabUrl';
import SecurityTab from './SecurityTab';
import SiteHealthTab from './SiteHealthTab';
import BackupsTab from './BackupsTab';
import BackupProtectionNotice from './BackupProtectionNotice';

const TAB_IDS = ['security', 'site-health', 'backups'] as const;

/**
 * "Protect My Site" (WP menu slug `security`) — PROTECT-MY-SITE.md's IA:
 * 3 detail tabs, "Security" first (default tab):
 *
 * BackupProtectionNotice (a single real "Backup protection: Enabled/Not
 * enabled" status line + a link to the real Backups tab, `GET /settings`'s
 * own `enable_automatic_backups`) sits here, above this page's own outer
 * "Security"/"Site Health"/"Backups" tab bar — moved up from inside
 * SecurityTab.tsx (where it briefly lived twice, in two different spots)
 * per direct instruction ("move this before tab names Security Site
 * Health Backups"), so it's a real, always-visible status line no matter
 * which of the 3 inner tabs is active, not just when "Security" is
 * selected. See SecurityTab.tsx's own docblock for that history.
 *
 * - Security (SecurityTab.tsx) — the mockup's own single-page
 *   design (hero/status/tile-grid, "Issues that need your attention", a
 *   3-panel footer row, then one real, unified issues table
 *   (SectionedIssuesTable.tsx — All/Important/Login & Accounts/Website
 *   Exposure/Browser Protection/SSL & Secure Connection tabs), same merge
 *   pattern WooCommerce's own "All WooCommerce Issues" already
 *   established. Was briefly split into two tabs ("Security" + "Old
 *   Security", the latter a sectioned-IA redesign of the same content) —
 *   "Old Security" was removed and its sections folded back into this one
 *   tab per direct instruction, so there's only ever one "Security" tab
 *   again. There was also briefly a separate "Overview" tab
 *   (OverviewTab.tsx, this page's own default tab) — removed per direct
 *   instruction; its "Vulnerabilities Found" card moved onto this tab
 *   instead of being deleted, then later removed outright per direct
 *   instruction once the merged issues table below it covered the same
 *   ground. Its now-redundant "Security Overview" gauge
 *   (SecurityOverviewCard.tsx — the same `category_scores.security` gauge
 *   SecurityStatusCard.tsx, still on this tab via SecurityMockupHeader,
 *   already shows) was deleted along with the Overview tab itself.
 * - Site Health (SiteHealthTab.tsx) — WordPress, Updates, Background
 *   Tasks, Database, Server. "WordPress"/"Server" wrap WordPress core's
 *   own WP_Site_Health tests (WordPressHealthScanner/ServerHealthScanner)
 *   rather than reinventing them. "Server" also now shows
 *   PhpAccelerationCard.tsx (OPcache status) — see below.
 *
 * This page used to have a 2nd tab, "Performance" (PerformanceTab.tsx,
 * now deleted) — WordPress/server-side efficiency checks read live from
 * `GET /efficiency-checks` (Controllers\EfficiencyChecks.php): page
 * caching, browser caching, persistent object cache, and PHP acceleration
 * (OPcache). Removed per direct instruction to eliminate the IA overlap
 * with the separate top-level "Improve My Speed" page
 * (`pages/Performance/`) — its content was redistributed rather than
 * deleted: page/browser caching + persistent object cache (+
 * LiveSiteInsightsCard.tsx) moved into Improve Speed's own Overview tab
 * (`pages/Performance/OverviewTab.tsx`, still importing
 * EfficiencyHeroCard.tsx/EfficiencySectionsList.tsx/
 * EfficiencyThingsToReview.tsx/EfficiencyOverviewChart.tsx/
 * LiveSiteInsightsCard.tsx/efficiencyChecks.ts from this folder — kept
 * here rather than physically moved since SiteHealthTab.tsx, right below,
 * still needs the same live endpoint for its own PHP-acceleration-only
 * card), while PHP acceleration itself moved to SiteHealthTab.tsx's
 * Server section (PhpAccelerationCard.tsx, this folder) since it's a
 * server-config fact, not a page-delivery one.
 * This page used to have a "Files & Plugins" tab too (FilesPluginsTab.tsx,
 * now deleted) — removed per direct instruction, since virtually every
 * section it held already had a better home: File Integrity, Plugin
 * Vulnerabilities, Theme Vulnerabilities (ThemeVulnerabilitiesScanner —
 * the one genuinely new Pro scanner that tab originally added), and
 * Recent File Changes all moved onto SecurityTab.tsx's own issues table
 * (its "Vulnerabilities"/"Suspicious File Changes" sections, its own
 * docblock explains the merge) — Outdated Software wasn't moved anywhere,
 * since it shared its scanner id with, and was fully covered by,
 * SiteHealthTab.tsx's own "Updates" section already. Once all 5 sections
 * were accounted for elsewhere, nothing genuinely Files-&-Plugins-shaped
 * was left to keep a whole tab for.
 *
 * This page also used to have an "Accessibility" tab
 * (AccessibilityTab.tsx, now moved) — Images, Page Structure, Forms,
 * Links & Buttons, Readability, Keyboard & Assistive Technology. Promoted
 * to its own top-level page (`pages/Accessibility/Accessibility.tsx`,
 * WP menu slug `accessibility`) per direct instruction: its checks are
 * content-quality concepts, not security/protection ones, so they never
 * really belonged inside "Protect My Site" — same reasoning that drove
 * the Performance-tab and Files-&-Plugins-tab removals above, just
 * pointed at an IA smell instead of a data-overlap one. That page still
 * imports SectionedIssuesTable.tsx/PluginOverlapCard.tsx from this folder
 * cross-folder rather than duplicating them.
 * - Backups (BackupsTab.tsx) — real database + file archives
 *   (Services\BackupManager/BackupScheduler), manual or scheduled, with
 *   real download/delete/restore. Also where Recovery's real, destructive
 *   restore lives (typed-confirmation-gated, backed by an automatic
 *   pre-restore safety snapshot).
 *
 * Reports used to have its own flat "Security" tab (a different,
 * now-deleted Reports/SecurityTab.tsx — a plain `category="security"`
 * FindingsTable) — removed per direct instruction, so this tab
 * (SecurityTab.tsx, this folder) is now the sole real home for security
 * findings in the whole plugin. Same `subtab` deep-link
 * convention every tab shell here uses
 * (`?page=vulopilot#&tab=security&subtab=<inner-tab>`) — `getCategoryTabLink.ts`'s
 * own `security: 'security&subtab=security'` mapping still resolves
 * correctly since this tab's id stays `security`, which is also this
 * page's own default tab now that "Overview" is gone.
 */
const Security = () => {
	const subtab = new URLSearchParams(useLocation().hash.substring(1)).get(
		'subtab'
	);
	const initialTab = (
		subtab && (TAB_IDS as readonly string[]).includes(subtab)
			? subtab
			: 'security'
	) as (typeof TAB_IDS)[number];

	const [activeTab, setActiveTab] = useState<(typeof TAB_IDS)[number]>(
		initialTab
	);
	// Scoped to every category this page's 3 detail tabs actually show —
	// same "local tab" scoping every other category page's header
	// "Run scan" button uses.
	const { runScanButton } = useRunScan({
		categories: ['security', 'wordpress', 'server', 'updates'],
	});

	return (
		<>
			<NavigatorHeaderComponent
				headerIcon="security"
				headerTitle={__('Protect My Site', 'vulopilot')}
				headerDescription={__(
					'AI continuously protects your website from threats and vulnerabilities.',
					'vulopilot'
				)}
				buttons={[runScanButton]}
			/>
			<BackupProtectionNotice />
			<ContainerComponent general>
				<TabsComponent
					className="protect-my-site-tabs"
					activeIndex={TAB_IDS.indexOf(activeTab)}
					onTabChange={(index) => {
						setActiveTab(TAB_IDS[index]);
						pushSubtabUrl('security', TAB_IDS[index]);
					}}
					tabs={[
						{
							label: __('Security', 'vulopilot'),
							content: <SecurityTab />,
						},
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

export default Security;
