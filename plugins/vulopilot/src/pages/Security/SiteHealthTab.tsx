import { __ } from '@wordpress/i18n';
import SectionedFindingsTab, { FindingsSection } from './SectionedFindingsTab';
import FindingsHeroCard from './FindingsHeroCard';

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
 * which this tab (and Files & Plugins) previously didn't have at all.
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

const scrollToFirstSection = () =>
	document
		.getElementById(`protect-my-site-section-${SECTIONS[0].key}`)
		?.scrollIntoView({ behavior: 'smooth', block: 'start' });

const SiteHealthTab = () => (
	<SectionedFindingsTab
		sections={SECTIONS}
		header={
			<FindingsHeroCard
				icon="active"
				label={__('Site Health', 'vulopilot')}
				scannerIds={ALL_SCANNER_IDS}
				onReviewFirst={scrollToFirstSection}
			/>
		}
	/>
);

export default SiteHealthTab;
