import { useState } from 'react';
import { __ } from '@wordpress/i18n';
import { ColumnComponent, ContainerComponent } from '@zyra/components';
import SectionedFindingsTab, {
	FindingsSection,
	SECTIONED_FINDINGS_TABLE_ID,
} from './SectionedFindingsTab';
import { SectionedIssuesTab } from './SectionedIssuesTable';
import FindingsHeroCard from './FindingsHeroCard';
import FilesPluginsStatusCard from './FilesPluginsStatusCard';
import PluginOverlapCard from './PluginOverlapCard';

/**
 * "Files & Plugins" tab of "Protect My Site" (PROTECT-MY-SITE.md's IA) —
 * 5 sections. "Theme Vulnerabilities" is the one genuinely new scanner
 * here (ThemeVulnerabilitiesScanner, vulopilot-pro) — everything else
 * reuses scanners that already existed, just organized under this new
 * heading. "Outdated Software" and "Recent File Changes" deliberately
 * share their scanner ids with Site Health's "Updates" and this tab's
 * own "File Integrity" respectively — same finding, two organizational
 * views, not two separate checks (PROTECT-MY-SITE.md's IA lists both
 * explicitly rather than only picking one home for each).
 *
 * "Plugin Vulnerabilities" is scoped to `advanced-vulnerabilities` alone
 * — real per-plugin CVE matches against installed plugin versions
 * (AdvancedVulnerabilitiesScanner). It used to also include
 * `basic-vulnerabilities`, but that scanner has zero plugin awareness at
 * all (BasicVulnerabilitiesScanner's own 3 checks: a homepage generator
 * meta tag, a public readme.html, and the default `wp_` table prefix —
 * pure WordPress-core hardening) — and since AdvancedVulnerabilitiesScanner's
 * own feed is illustrative-only sample data matching two fictional plugin
 * slugs (LocalSeedVulnerabilityFeed's own docblock — deliberately never a
 * real plugin, so this repo makes no vulnerability claim about any real
 * third-party plugin), it almost never actually matches anything on a
 * real site. In practice that meant this section was really only ever
 * showing `basic-vulnerabilities`' generic WordPress findings under a
 * "Plugin Vulnerabilities" heading. Moved `basic-vulnerabilities` to
 * SecurityTab.tsx's own "Website Exposure" section instead, where it
 * belongs — it's already counted in that tab's broader
 * `SECURITY_FINDINGS_SCANNER_IDS` scope, just without a named section of
 * its own until now.
 *
 * Starts with FindingsHeroCard — same "hero summary + chart before the
 * detail sections" shape the Security/Performance tabs already use,
 * which this tab (and Site Health) previously didn't have at all —
 * followed by FilesPluginsStatusCard, a real per-section status row
 * matching the depth of Security's own supporting cards. Ends with
 * PluginOverlapCard (`GET /plugin-overlap`, PluginOverlap.php) — real,
 * currently-active plugins whose category overlaps with a VuloPilot
 * feature, e.g. "Yoast SEO is active — VuloPilot's own SEO Copilot covers
 * this." Deliberately not tied to any vulnerability claim (see that
 * card's own docblock for why) — a plain "you have two tools doing the
 * same job" comparison, not a security warning about a named plugin.
 * Rendered here unfiltered (every category, `seo`/`security`/
 * `accessibility`/`automation`/`caching`) since this is the one place a
 * user browsing "what plugins do I have" should see the complete list —
 * SecurityTab/AccessibilityTab/PerformanceTab each also render their own
 * `category`-filtered instance so the same cross-sell also surfaces in
 * the tab a user is already reading about that specific category.
 */
const SECTIONS: FindingsSection[] = [
	{
		key: 'file-integrity',
		title: __('File Integrity', 'vulopilot'),
		description: __(
			'Unexpected changes to core/theme/plugin files.',
			'vulopilot'
		),
		emptyMessage: __(
			'No file integrity findings yet — run a scan to check.',
			'vulopilot'
		),
		scannerIds: ['core-file-integrity', 'integrity-monitoring'],
	},
	{
		key: 'plugin-vulnerabilities',
		title: __('Plugin Vulnerabilities', 'vulopilot'),
		description: __(
			'Known CVEs matched against your installed plugins\' exact versions.',
			'vulopilot'
		),
		emptyMessage: __(
			'No plugin vulnerability findings yet — run a scan to check.',
			'vulopilot'
		),
		scannerIds: ['advanced-vulnerabilities'],
	},
	{
		key: 'theme-vulnerabilities',
		title: __('Theme Vulnerabilities', 'vulopilot'),
		description: __(
			'Known vulnerabilities in installed themes.',
			'vulopilot'
		),
		emptyMessage: __(
			'No theme vulnerability findings yet — run a scan to check.',
			'vulopilot'
		),
		scannerIds: ['theme-vulnerabilities'],
	},
	{
		key: 'outdated-software',
		title: __('Outdated Software', 'vulopilot'),
		description: __(
			'Pending WordPress core, plugin, or theme updates — same data as Site Health’s "Updates".',
			'vulopilot'
		),
		emptyMessage: __(
			'No outdated software found yet — run a scan to check.',
			'vulopilot'
		),
		scannerIds: ['updates'],
	},
	{
		key: 'recent-file-changes',
		title: __('Recent File Changes', 'vulopilot'),
		description: __(
			'Unexpected changes to core/theme/plugin files — same data as "File Integrity" above.',
			'vulopilot'
		),
		emptyMessage: __(
			'No recent file changes found yet — run a scan to check.',
			'vulopilot'
		),
		scannerIds: ['core-file-integrity', 'integrity-monitoring'],
	},
];

const ALL_SCANNER_IDS = Array.from(
	new Set(SECTIONS.flatMap((section) => section.scannerIds))
);

const FilesPluginsTab = () => {
	const [activeTab, setActiveTab] = useState<SectionedIssuesTab>('all');

	const goToIssuesTable = (tab: SectionedIssuesTab) => {
		setActiveTab(tab);
		setTimeout(
			() =>
				document
					.getElementById(SECTIONED_FINDINGS_TABLE_ID)
					?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
			50
		);
	};

	return (
		<SectionedFindingsTab
			title={__('All Files & Plugins Issues', 'vulopilot')}
			sections={SECTIONS}
			activeTab={activeTab}
			onTabChange={setActiveTab}
			header={
				<ContainerComponent>
					<ColumnComponent fullHeight grid={6}>
						<FilesPluginsStatusCard />
					</ColumnComponent>
					<ColumnComponent fullHeight grid={6}>
						<FindingsHeroCard
							icon="module"
							label={__('Files & Plugins', 'vulopilot')}
							scannerIds={ALL_SCANNER_IDS}
							onReviewFirst={() => goToIssuesTable('important')}
						/>
					</ColumnComponent>
				</ContainerComponent>
			}
			footer={<PluginOverlapCard />}
		/>
	);
};

export default FilesPluginsTab;
