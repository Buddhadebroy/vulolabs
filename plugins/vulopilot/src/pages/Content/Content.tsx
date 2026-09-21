import { __ } from '@wordpress/i18n';
import { ColumnComponent, ContainerComponent, NavigatorHeaderComponent } from '@zyra/components';
import RunScanHeaderExtra from '../../components/RunScanHeaderExtra';
import ContentToolsGrid from './ContentToolsGrid';
import ContentStatsCard from './ContentStatsCard';
import RecentContentCard from './RecentContentCard';
import QuickActionsCard from './QuickActionsCard';
import AiContentAssistantSidebar from './AiContentAssistantSidebar';
import './CreateContent.scss';

/**
 * "Content" (WP menu slug `content`) — used to be a tab shell over
 * Overview (formerly its own OverviewTab.tsx, inlined here — it had
 * exactly one consumer, this file), "AI Content" (AiContentTab.tsx, moved
 * here from "SEO & Visibility"), and later a standalone "Content Quality
 * Issues" card (ContentOpenIssuesCard.tsx) once AI Content was removed.
 * That card's own real data — each post's open content-quality findings,
 * with real Fix with AI/Resolve/Ignore/Review actions — is now shown
 * directly inside RecentContentCard.tsx's own rows instead of a separate
 * card pointing elsewhere, so there's only ever been one real view left:
 * this collapsed from a `TabsComponent` shell down to a plain header +
 * single body, same as any other single-view admin page in this codebase
 * — a tab bar with exactly one, permanently-active tab isn't real
 * navigation.
 *
 * The header's own bare settings-gear button used to be this page's one
 * real outlier — every other category page's header (Health/Security/
 * Site Health/Accessibility/Commerce/SEO & Visibility/Reports/Performance)
 * already gets the shared `RunScanHeaderExtra` cluster (Run Scan button +
 * gear + real last-scan time, RunScanHeaderExtra.tsx's own docblock) — now
 * matches, scoped to the real `content` scan category
 * (Scanners/Basic/ReadabilityScanner.php's own `get_category()`).
 *
 * See this folder's sibling files for the per-section real-data mapping
 * (ContentToolsGrid, ContentStatsCard, RecentContentCard,
 * AiContentAssistantSidebar — each documents its own data source and,
 * where the mockup shows something with no real backend, its honest
 * fallback). There's no separate "Content Quality Issues" card here —
 * that section (formerly ContentOpenIssuesCard.tsx) was merged directly
 * into RecentContentCard.tsx, which now shows each post's own real open
 * content-quality findings inline in its own row, rather than a second,
 * separate glimpse card pointing elsewhere. `ContentQualityCard` itself
 * isn't rendered here at all — `RecentContentCard.tsx`'s own "Analyze"
 * action opens it directly, as a side panel, per that file's `postId`
 * prop; it never needed a second mount on this tab.
 */
const Content = () => {
	return (
		<>
			<NavigatorHeaderComponent
				headerIcon="image"
				headerTitle={__('Content', 'vulopilot')}
				headerDescription={__(
					'AI-powered tools to help you create, optimize and rank content that drives traffic and engagement.',
					'vulopilot'
				)}
				headerCustomContent={
					<RunScanHeaderExtra
						categories={['content']}
						label={__('Run Content Audit', 'vulopilot')}
						settingsSubtab="seo-content"
					/>
				}
			/>
			<ContainerComponent general>
				<ColumnComponent grid={8}>
					<AiContentAssistantSidebar />
					<ContentToolsGrid />
				</ColumnComponent>
				<ColumnComponent grid={4}>
					<ContentStatsCard />
					<QuickActionsCard />
				</ColumnComponent>

				<ColumnComponent >
					<RecentContentCard />
				</ColumnComponent>
			</ContainerComponent>
		</>
	);
};

export default Content;
