import { useState } from 'react';
import { __ } from '@wordpress/i18n';
import type { FindingsSection } from '../Security/SectionedFindingsTab';
import SectionedIssuesTable, {
	SectionedIssuesTab,
} from '../Security/SectionedIssuesTable';
import PluginOverlapCard from '../Security/PluginOverlapCard';

/** DOM anchor id the merged table below carries — what SpeedBoostCard's/AiSpeedAssistantCard's "View Details"/"Review Speed Issues" buttons scroll to (via OverviewTab.tsx's own `#performance-section-findings` wrapper). */
const ISSUES_TABLE_ID = 'performance-top-issues-table';

/**
 * The 11 real category-'performance' scanner ids (`classes/Scanners/Basic/`),
 * grouped the same human-readable way MetricsGrid.tsx's own 10-tile grid
 * already labels them, into the same "one real, unified issues table with a
 * category tab bar" shape Security/Files & Plugins/Accessibility already
 * use (SectionedIssuesTable.tsx) — same real `GET /findings/groups` data,
 * summary priority cards, and side detail panel, replacing the plain
 * spreadsheet-style FindingsTable this tab used to render alone.
 */
const SECTIONS: FindingsSection[] = [
	{
		key: 'server-response',
		title: __('Server & Response Time', 'vulopilot'),
		description: __(
			'Homepage response time and autoloaded options — the biggest levers on how fast every request feels.',
			'vulopilot'
		),
		emptyMessage: __(
			'No server/response findings yet — run a scan to check.',
			'vulopilot'
		),
		scannerIds: ['performance', 'slow-pages'],
	},
	{
		key: 'images-media',
		title: __('Images & Media', 'vulopilot'),
		description: __('Oversized or unoptimized images.', 'vulopilot'),
		emptyMessage: __(
			'No image findings yet — run a scan to check.',
			'vulopilot'
		),
		scannerIds: ['large-images'],
	},
	{
		key: 'code-optimization',
		title: __('Code Optimization', 'vulopilot'),
		description: __(
			'Unused or render-blocking CSS and JavaScript.',
			'vulopilot'
		),
		emptyMessage: __(
			'No code optimization findings yet — run a scan to check.',
			'vulopilot'
		),
		scannerIds: ['css-optimization', 'javascript-optimization'],
	},
	{
		key: 'caching-delivery',
		title: __('Caching & Delivery', 'vulopilot'),
		description: __(
			'Page caching effectiveness and content delivery network coverage.',
			'vulopilot'
		),
		emptyMessage: __(
			'No caching/delivery findings yet — run a scan to check.',
			'vulopilot'
		),
		scannerIds: ['cache-detection', 'cdn'],
	},
	{
		key: 'loading-fonts',
		title: __('Loading Behavior & Fonts', 'vulopilot'),
		description: __(
			'Deferred loading for below-the-fold content and web font loading performance.',
			'vulopilot'
		),
		emptyMessage: __(
			'No loading/font findings yet — run a scan to check.',
			'vulopilot'
		),
		scannerIds: ['lazy-loading', 'fonts'],
	},
	{
		key: 'plugins-database',
		title: __('Plugins & Database', 'vulopilot'),
		description: __(
			'A large active plugin count and database bloat — old revisions, expired transients.',
			'vulopilot'
		),
		emptyMessage: __(
			'No plugin/database findings yet — run a scan to check.',
			'vulopilot'
		),
		scannerIds: ['heavy-plugins', 'database-cleanup'],
	},
];

/**
 * "Top Issues" — Improve Speed's own OverviewTab.tsx (wrapped in
 * `#performance-section-findings`) is this component's only call site.
 * Now the same real, unified issues table (summary priority cards +
 * tabbed category bar + side detail panel) "Protect My Site"'s Security/
 * Files & Plugins/Accessibility tabs already use, scoped to every real
 * category-'performance' scanner instead of the plain per-row spreadsheet
 * FindingsTable this tab used to render alone — same underlying
 * `GET /findings/groups` data either way.
 *
 * Closes with PluginOverlapCard filtered to `category="caching"` (real
 * active caching plugins — WP Rocket, etc. — overlapping with VuloPilot's
 * own efficiency/speed-monitoring checks), matching the same per-tab
 * cross-sell promotion Security/Accessibility already carry.
 */
const PerformanceTab = () => {
	const [activeTab, setActiveTab] = useState<SectionedIssuesTab>('all');

	return (
		<>
			<SectionedIssuesTable
				id={ISSUES_TABLE_ID}
				title={__('Top Issues', 'vulopilot')}
				sections={SECTIONS}
				activeTab={activeTab}
				onTabChange={setActiveTab}
			/>
			<PluginOverlapCard category="caching" />
		</>
	);
};

export default PerformanceTab;
