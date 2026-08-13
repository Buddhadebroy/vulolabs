import { __ } from '@wordpress/i18n';
import SectionedFindingsTab, { FindingsSection } from './SectionedFindingsTab';

/**
 * "Site Health" tab of "Protect My Site" (PROTECT-MY-SITE.md's IA) — 5
 * sections. "WordPress" and "Server" are both thin wrappers around
 * WordPress core's own `WP_Site_Health` tests (WordPressHealthScanner/
 * ServerHealthScanner — see their own docblocks for why wrapping core's
 * existing test suite beat writing new checks from scratch), same
 * "genuinely new backend work, not a UI-only reshuffle" case
 * "Background Tasks"/"Updates"/"Database" aren't — those three already
 * existed as CronScanner/UpdatesScanner/DatabaseScanner before this pass.
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

const SiteHealthTab = () => <SectionedFindingsTab sections={SECTIONS} />;

export default SiteHealthTab;
