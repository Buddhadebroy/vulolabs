import { __ } from '@wordpress/i18n';
import { Link } from 'react-router-dom';
import { NavigatorComponent } from '@zyra/components';
import CrawlOverviewSection from './CrawlOverviewSection';
import BrokenLinksSection from './BrokenLinksSection';
import RedirectsSection from './RedirectsSection';
import NotFoundLogSection from './NotFoundLogSection';
import CrawlRobotsSitemapSection from './CrawlRobotsSitemapSection';

export type CrawlUrlsSectionId =
	| 'overview'
	| 'broken-links'
	| 'redirects'
	| '404s'
	| 'robots-sitemap';

const SECTION_IDS: CrawlUrlsSectionId[] = [
	'overview',
	'broken-links',
	'redirects',
	'404s',
	'robots-sitemap',
];

/**
 * `NavigatorComponent`'s own compact icon-over-title tab bar needs a real
 * `headerIcon` per section — same `Record<SectionId, {...}>` shape
 * SeoVisibility.tsx's own `TAB_META` already establishes one level up for
 * its own outer tabs.
 */
const SECTION_META: Record<
	CrawlUrlsSectionId,
	{ headerTitle: string; headerIcon: string }
> = {
	overview: { headerTitle: __('Overview', 'vulopilot'), headerIcon: 'bar-chart' },
	'broken-links': { headerTitle: __('Broken Links', 'vulopilot'), headerIcon: 'error' },
	redirects: { headerTitle: __('Redirects', 'vulopilot'), headerIcon: 'refresh' },
	'404s': { headerTitle: __('404s', 'vulopilot'), headerIcon: 'close' },
	'robots-sitemap': { headerTitle: __('Robots & Sitemap', 'vulopilot'), headerIcon: 'link' },
};

interface CrawlUrlsTabProps {
	/**
	 * Which inner tab to land on when this whole "Crawl & URLs" tab is
	 * first mounted — set from GEO.tsx's own `SUBTAB_ALIASES` resolution
	 * (a bookmarked `?subtab=crawler-traffic`/`broken-links`/`redirects`
	 * link from before this merge) or from a same-session cross-tab jump
	 * (SeoTab.tsx's own "Search engine access" link, which needs
	 * 'robots-sitemap' specifically, not just this tab's own default).
	 * Read once at mount, same "initial value only" contract
	 * SchemaKnowledgeTab.tsx's own `initialSection` prop already has —
	 * this relies on GEO.tsx's outer `TabsComponent` giving this component
	 * a fresh mount every time its own tab becomes active, not just
	 * hiding/showing an already-mounted instance.
	 */
	initialSection?: CrawlUrlsSectionId;
}

/**
 * "Crawl & URLs" tab of "SEO & Visibility" — merges 3 former standalone
 * tabs (Crawler Traffic, Broken Links, Redirects) plus the 404 log that
 * used to live bundled inside Broken Links, into one tab with 5 real
 * inner tabs (direct instruction: "Broken Links + Redirects + Crawler
 * Traffic are fragmented... And the Redirect screen also contains a 404
 * log... That creates four URL-maintenance concepts spread across three
 * tabs... one main tab: Crawl & URLs [with] Overview | Broken Links |
 * Redirects | 404s | Robots & Sitemap").
 *
 * Real inner tabs, not one continuous scrolling page — a deliberate
 * departure from the "Schema & Knowledge" tab's own precedent
 * (SchemaKnowledgeTab.tsx's own docblock: "no inner tab switcher... per
 * direct instruction"), confirmed before building this: each of these 5
 * sections is large on its own (Broken Links alone was 1600+ lines before
 * this split), so one continuous page here would be a very long scroll
 * rather than the cleaner navigation this merge is actually meant to
 * deliver.
 *
 * `NavigatorComponent` (`variant="compact"`), not a bare `TabsComponent` —
 * same real settings-navigator component SeoVisibility.tsx's own outer
 * tab shell already uses one level up, converted here too so this inner
 * tab bar only ever mounts/renders the one real section that's actually
 * active (`getForm`'s own switch) instead of `TabsComponent`'s own
 * "every tab's `content` is a real element already built up front"
 * shape, which meant all 5 of these (each a substantial page of its own)
 * mounted and fetched together on first render. No top-level
 * `headerTitle`/`headerIcon` passed here (unlike SeoVisibility.tsx's own
 * outer `NavigatorComponent`) — this is a nested sub-tab bar inside a tab
 * that already has its own real page header one level up; each section's
 * own `hideSettingHeader: true` below suppresses `NavigatorComponent`'s
 * own per-file header row too, since every section already renders its
 * own.
 *
 * Every section is the exact same real component/logic that used to live
 * on its own top-level tab, moved here unchanged (Overview/Robots &
 * Sitemap were CrawlerTrafficTab.tsx, split into
 * CrawlOverviewSection.tsx/CrawlRobotsSitemapSection.tsx; Broken Links was
 * BrokenLinksTab.tsx, trimmed into BrokenLinksSection.tsx once its own
 * 404 log moved to NotFoundLogSection.tsx; Redirects was
 * RedirectsTab.tsx, renamed to RedirectsSection.tsx) — nothing here is a
 * rewrite, only a real reorganization of where each already-real section
 * lives. GEO.tsx no longer renders any of those 3 as sibling top-level
 * tabs; this component is the one place all 5 now live.
 */
const CrawlUrlsTab = ({ initialSection = 'overview' }: CrawlUrlsTabProps) => {
	// Read once at mount only — `NavigatorComponent` tracks which of its
	// own tabs is active internally (its own `activeSetting` state), only
	// re-syncing from `currentSetting` when that prop itself changes; a
	// plain in-shell tab click updates its own state directly, same real
	// "the parent's own copy is just the initial/forced value" contract
	// SeoVisibility.tsx's own outer `activeTab` already relies on for the
	// identical conversion one level up.
	const activeSection: CrawlUrlsSectionId = initialSection;

	const settingContent = SECTION_IDS.map((sectionId) => ({
		type: 'file' as const,
		content: {
			id: sectionId,
			headerTitle: SECTION_META[sectionId].headerTitle,
			headerIcon: SECTION_META[sectionId].headerIcon,
			hideSettingHeader: true,
		},
	}));

	const getForm = (sectionId: string) => {
		switch (sectionId) {
			case 'overview':
				return <CrawlOverviewSection />;
			case 'broken-links':
				return <BrokenLinksSection />;
			case 'redirects':
				return <RedirectsSection />;
			case '404s':
				return <NotFoundLogSection />;
			case 'robots-sitemap':
				return <CrawlRobotsSitemapSection />;
			default:
				return <div></div>;
		}
	};

	return (
		<NavigatorComponent
			className="settings-sub-tabs"
			variant="tabs"
			settingContent={settingContent}
			currentSetting={activeSection}
			getForm={getForm}
			prepareUrl={(sectionId: string) =>
				`?page=vulopilot#&tab=seo-visibility&subtab=crawl-urls&section=${sectionId}`
			}
			Link={Link}
			settingName="CrawlUrls"
			menuIcon
		/>
	);
};

export default CrawlUrlsTab;
