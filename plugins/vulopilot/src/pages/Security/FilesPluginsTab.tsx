import { __ } from '@wordpress/i18n';
import SectionedFindingsTab, { FindingsSection } from './SectionedFindingsTab';

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
			'Known vulnerabilities and hardening gaps in installed plugins.',
			'vulopilot'
		),
		emptyMessage: __(
			'No plugin vulnerability findings yet — run a scan to check.',
			'vulopilot'
		),
		scannerIds: ['basic-vulnerabilities', 'advanced-vulnerabilities'],
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

const FilesPluginsTab = () => <SectionedFindingsTab sections={SECTIONS} />;

export default FilesPluginsTab;
