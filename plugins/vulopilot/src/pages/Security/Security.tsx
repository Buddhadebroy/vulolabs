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
import SecurityDetailTab from './SecurityDetailTab';
import SiteHealthTab from './SiteHealthTab';
import FilesPluginsTab from './FilesPluginsTab';
import AccessibilityTab from './AccessibilityTab';

const TAB_IDS = [
	'overview',
	'security',
	'site-health',
	'files-plugins',
	'accessibility',
] as const;

/**
 * "Protect My Site" (WP menu slug `security`) — PROTECT-MY-SITE.md's IA:
 * Overview (the mockup's dashboard-style summary, OverviewTab.tsx) plus 4
 * detail tabs, each a set of independent scanner_id-scoped FindingsTable
 * sections (SectionedFindingsTab.tsx, same pattern GEO/SeoTab.tsx already
 * established for a mixed-category findings page):
 *
 * - Security (SecurityDetailTab.tsx) — Login & Accounts, Website Exposure,
 *   Browser Protection, SSL & Secure Connection, Security Findings.
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
 *
 * Overview's "Review Issues First" button and clicking a "Vulnerabilities
 * Found" row both jump straight to this page's own "Security" tab
 * (`goToSecurityTab` below) — back to an in-page tab switch now that a
 * real Security tab lives here again; Reports' own flat "Security" tab
 * (Reports/SecurityTab.tsx) is unaffected and still exists as a separate,
 * simpler category="security" view. Same `subtab` deep-link convention
 * every tab shell here uses (`?page=vulopilot#&tab=security&subtab=<inner-tab>`).
 */
const Security = () => {
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
	// Scoped to every category this page's 4 detail tabs actually show —
	// same "local tab" scoping every other category page's header
	// "Run scan" button uses.
	const { runScanButton } = useRunScan({
		categories: ['security', 'accessibility', 'wordpress', 'server', 'updates'],
	});

	const goToSecurityTab = () => setActiveTab('security');

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
							label: __('Overview', 'vulopilot'),
							content: (
								<OverviewTab
									onNavigateToSecurityTab={goToSecurityTab}
								/>
							),
						},
						{
							label: __('Security', 'vulopilot'),
							content: <SecurityDetailTab />,
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
					]}
				/>
			</ContainerComponent>
		</>
	);
};

export default Security;
