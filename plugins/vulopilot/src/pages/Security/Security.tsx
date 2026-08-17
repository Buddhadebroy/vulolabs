import { useState } from 'react';
import { __ } from '@wordpress/i18n';
import { useLocation } from 'react-router-dom';
import {
	ContainerComponent,
	NavigatorHeaderComponent,
	TabsComponent,
} from '@zyra/components';
import { useRunScan } from '../../services/useRunScan';
import SecurityTab from './SecurityTab';
import PerformanceTab from './PerformanceTab';
import SiteHealthTab from './SiteHealthTab';
import FilesPluginsTab from './FilesPluginsTab';
import AccessibilityTab from './AccessibilityTab';
import BackupsTab from './BackupsTab';

const TAB_IDS = [
	'security',
	'performance',
	'site-health',
	'files-plugins',
	'accessibility',
	'backups',
] as const;

/**
 * "Protect My Site" (WP menu slug `security`) — PROTECT-MY-SITE.md's IA:
 * 6 detail tabs, "Security" first (default tab):
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
 * - Performance (PerformanceTab.tsx) — WordPress/server-side efficiency:
 *   page caching, browser caching, persistent object cache, PHP
 *   acceleration (OPcache). Reads `GET /efficiency-checks`
 *   (Controllers\EfficiencyChecks.php), computed live on every load
 *   rather than stored findings — that controller's own docblock explains
 *   why. Distinct from the separate top-level "Improve My Speed" page
 *   (`routes.ts`'s `tab: 'performance'`, `pages/Performance/`) — that one
 *   covers front-end loading speed/Core Web Vitals, this tab covers
 *   WordPress's own configuration efficiency; PerformanceTab.tsx's own
 *   closing banner links to the other one.
 * - Site Health (SiteHealthTab.tsx) — WordPress, Updates, Background
 *   Tasks, Database, Server. "WordPress"/"Server" wrap WordPress core's
 *   own WP_Site_Health tests (WordPressHealthScanner/ServerHealthScanner)
 *   rather than reinventing them.
 * - Files & Plugins (FilesPluginsTab.tsx) — File Integrity, Plugin
 *   Vulnerabilities, Theme Vulnerabilities (ThemeVulnerabilitiesScanner,
 *   the one genuinely new Pro scanner this pass adds), Outdated Software,
 *   Recent File Changes.
 * - Accessibility (AccessibilityTab.tsx) — Images, Page Structure, Forms,
 *   Links & Buttons, Readability, Keyboard & Assistive Technology
 *   (KeyboardAccessibilityScanner — positive tabindex — the one new
 *   accessibility scanner this pass adds).
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
	// Scoped to every category this page's 4 detail tabs actually show —
	// same "local tab" scoping every other category page's header
	// "Run scan" button uses.
	const { runScanButton } = useRunScan({
		categories: ['security', 'accessibility', 'wordpress', 'server', 'updates'],
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
			<ContainerComponent general>
				<TabsComponent
					className="protect-my-site-tabs"
					activeIndex={TAB_IDS.indexOf(activeTab)}
					onTabChange={(index) => setActiveTab(TAB_IDS[index])}
					tabs={[
						{
							label: __('Security', 'vulopilot'),
							content: <SecurityTab />,
						},
						{
							label: __('Performance', 'vulopilot'),
							content: <PerformanceTab />,
						},
						{
							label: __('Site Health', 'vulopilot'),
							content: <SiteHealthTab />,
						},
						{
							label: __('Files & Plugins', 'vulopilot'),
							content: <FilesPluginsTab />,
						},
						{
							label: __('Accessibility', 'vulopilot'),
							content: <AccessibilityTab />,
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
