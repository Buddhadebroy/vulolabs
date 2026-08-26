import { __ } from '@wordpress/i18n';
import { NavigatorHeaderComponent } from '@zyra/components';
import RunScanHeaderExtra from '../../components/RunScanHeaderExtra';
import OverviewTab from './OverviewTab';

/**
 * "Content" (WP menu slug `content`) — used to be a tab shell over
 * Overview (OverviewTab.tsx), "AI Content" (AiContentTab.tsx, moved here
 * from "SEO & Visibility"), and later a standalone "Content Quality
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
						settingsSubtab="seo-content"
					/>
				}
			/>
			<OverviewTab />
		</>
	);
};

export default Content;
