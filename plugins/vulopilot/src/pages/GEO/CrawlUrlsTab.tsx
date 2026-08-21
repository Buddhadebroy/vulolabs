import { useState } from 'react';
import { __ } from '@wordpress/i18n';
import { TabsComponent } from '@zyra/components';
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
 * Real inner tabs (a clickable `TabsComponent`), not one continuous
 * scrolling page — a deliberate departure from the "Schema & Knowledge"
 * tab's own precedent (SchemaKnowledgeTab.tsx's own docblock: "no inner
 * tab switcher... per direct instruction"), confirmed before building
 * this: each of these 5 sections is large on its own (Broken Links alone
 * was 1600+ lines before this split), so one continuous page here would
 * be a very long scroll rather than the cleaner navigation this merge is
 * actually meant to deliver.
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
	const [activeSection, setActiveSection] =
		useState<CrawlUrlsSectionId>(initialSection);

	return (
		<TabsComponent
			className="crawl-urls-tabs"
			activeIndex={SECTION_IDS.indexOf(activeSection)}
			onTabChange={(index) => setActiveSection(SECTION_IDS[index])}
			tabs={[
				{
					label: __('Overview', 'vulopilot'),
					content: <CrawlOverviewSection />,
				},
				{
					label: __('Broken Links', 'vulopilot'),
					content: <BrokenLinksSection />,
				},
				{
					label: __('Redirects', 'vulopilot'),
					content: <RedirectsSection />,
				},
				{
					label: __('404s', 'vulopilot'),
					content: <NotFoundLogSection />,
				},
				{
					label: __('Robots & Sitemap', 'vulopilot'),
					content: <CrawlRobotsSitemapSection />,
				},
			]}
		/>
	);
};

export default CrawlUrlsTab;
