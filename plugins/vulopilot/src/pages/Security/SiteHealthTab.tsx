import { useState } from 'react';
import { __ } from '@wordpress/i18n';
import { ColumnComponent, ContainerComponent } from '@zyra/components';
import SectionedFindingsTab, {
	FindingsSection,
	SECTIONED_FINDINGS_TABLE_ID,
} from './SectionedFindingsTab';
import { SectionedIssuesTab } from './SectionedIssuesTable';
import FindingsHeroCard from './FindingsHeroCard';
import SiteHealthStatusCard from './SiteHealthStatusCard';

/**
 * "Site Health" tab of "Protect My Site" (PROTECT-MY-SITE.md's IA) — 5
 * sections. "WordPress" and "Server" are both thin wrappers around
 * WordPress core's own `WP_Site_Health` tests (WordPressHealthScanner/
 * ServerHealthScanner — see their own docblocks for why wrapping core's
 * existing test suite beat writing new checks from scratch), same
 * "genuinely new backend work, not a UI-only reshuffle" case
 * "Background Tasks"/"Updates"/"Database" aren't — those three already
 * existed as CronScanner/UpdatesScanner/DatabaseScanner before this pass.
 *
 * Starts with FindingsHeroCard — same "hero summary + chart before the
 * detail sections" shape the Security/Performance tabs already use,
 * which this tab (and Files & Plugins) previously didn't have at all —
 * side by side (grid={6}/grid={6}, same row pattern WooCommerceTab.tsx's
 * own AiSalesOptimizerCard/StoreIntelligenceSummaryCard pairing already
 * uses) with SiteHealthStatusCard, a real per-section status row matching
 * the depth of Security's own supporting cards.
 */
const SECTIONS: FindingsSection[] = [
	{
		key: 'wordpress',
		title: __('WordPress', 'vulopilot'),
		description: __(
			'Core version, HTTPS setup, and REST API availability.',
			'vulopilot'
		),
		emptyMessage: __(
			'No WordPress health findings yet — run a scan to check.',
			'vulopilot'
		),
		scannerIds: ['wordpress-health'],
	},
	{
		key: 'updates',
		title: __('Updates', 'vulopilot'),
		description: __(
			'Pending WordPress core, plugin, or theme updates.',
			'vulopilot'
		),
		emptyMessage: __(
			'No pending updates found yet — run a scan to check.',
			'vulopilot'
		),
		scannerIds: ['updates'],
	},
	{
		key: 'background-tasks',
		title: __('Background Tasks', 'vulopilot'),
		description: __(
			'Overdue scheduled events — a sign WP-Cron isn’t actually firing.',
			'vulopilot'
		),
		emptyMessage: __(
			'No overdue background tasks yet — run a scan to check.',
			'vulopilot'
		),
		scannerIds: ['cron'],
	},
	{
		key: 'database',
		title: __('Database', 'vulopilot'),
		description: __('Excessive post-revision buildup.', 'vulopilot'),
		emptyMessage: __(
			'No database findings yet — run a scan to check.',
			'vulopilot'
		),
		scannerIds: ['database'],
	},
	{
		key: 'server',
		title: __('Server', 'vulopilot'),
		description: __(
			'PHP version, SQL server version, and recent PHP warnings/errors.',
			'vulopilot'
		),
		emptyMessage: __(
			'No server findings yet — run a scan to check.',
			'vulopilot'
		),
		scannerIds: ['server-health', 'php-warnings'],
	},
];

const ALL_SCANNER_IDS = Array.from(
	new Set(SECTIONS.flatMap((section) => section.scannerIds))
);

const SiteHealthTab = () => {
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
			title={__('All Site Health Issues', 'vulopilot')}
			sections={SECTIONS}
			activeTab={activeTab}
			onTabChange={setActiveTab}
			header={
				<ContainerComponent>
					<ColumnComponent grid={6}>
						<SiteHealthStatusCard />
					</ColumnComponent>
					<ColumnComponent grid={6}>
						<FindingsHeroCard
							icon="active"
							label={__('Site Health', 'vulopilot')}
							scannerIds={ALL_SCANNER_IDS}
							onReviewFirst={() => goToIssuesTable('important')}
						/>
					</ColumnComponent>
				</ContainerComponent>
			}
		/>
	);
};

export default SiteHealthTab;
