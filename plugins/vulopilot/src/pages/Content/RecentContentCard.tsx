/* global appLocalizer */
import { useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { ColumnComponent, ContainerComponent } from '@zyra/components';
import { ButtonInput } from '@zyra/inputs';
import IssuesSection, { ContentModeConfig, ContentRowTab } from '../GEO/IssuesSection';
import type { PageRow } from '../GEO/seoIssuesShared';
import ContentQualityCard from './ContentQualityCard';

/**
 * `GenerateLandingPageAction::META_KEY`'s literal string — this plugin has
 * no localization pipeline exposing PHP action constants to this page's
 * JS bundle, so it's duplicated here as a plain string rather than adding
 * a whole new mechanism for one value. Must stay in sync with that
 * class's own `META_KEY` constant.
 */
const LANDING_PAGE_META_KEY = '_vulopilot_landing_page';

/**
 * The 3 real scanners that flag per-post content-quality findings — same
 * set the now-removed "Content Quality Issues"/"AI Content" tabs already
 * covered (see classes/Scanners/Basic/{ThinContent,Readability,HeadingStructure}Scanner.php,
 * all 3 of which write `object_type: 'post', object_ref: (string) $post->ID`).
 */
const CONTENT_SCANNER_IDS = ['thin-content', 'readability', 'heading-structure'];

const CATEGORY_LABELS: Record<string, string> = {
	'blog-post': __('Blog Post', 'vulopilot'),
	'landing-page': __('Landing Page', 'vulopilot'),
	product: __('Product Description', 'vulopilot'),
	other: __('Page', 'vulopilot'),
};

const CATEGORY_ICONS: Record<string, string> = {
	'blog-post': 'document',
	'landing-page': 'web-page-website',
	product: 'cart',
	other: 'document',
};

const CATEGORIES: ContentModeConfig['categories'] = {
	'blog-post': { label: CATEGORY_LABELS['blog-post'], icon: CATEGORY_ICONS['blog-post'] },
	'landing-page': { label: CATEGORY_LABELS['landing-page'], icon: CATEGORY_ICONS['landing-page'] },
	product: { label: CATEGORY_LABELS.product, icon: CATEGORY_ICONS.product },
	other: { label: CATEGORY_LABELS.other, icon: CATEGORY_ICONS.other },
};

/** Real per-row category test, one per real resource type — `'all'` always matches, same "no real category key" convention `IssuesSection.tsx`'s own `activeTab === 'all'` default already relies on. */
const RESOURCE_TABS: ContentRowTab[] = [
	{ key: 'all', label: __('All resources', 'vulopilot'), matches: () => true },
	{
		key: 'blog-post',
		label: __('Blog Posts', 'vulopilot'),
		matches: (row: PageRow) => 'blog-post' === row.categoryKey,
	},
	{
		key: 'landing-page',
		label: __('Landing Pages', 'vulopilot'),
		matches: (row: PageRow) => 'landing-page' === row.categoryKey,
	},
	{
		key: 'product',
		label: __('Products', 'vulopilot'),
		matches: (row: PageRow) => 'product' === row.categoryKey,
	},
	{
		key: 'other',
		label: __('Other', 'vulopilot'),
		matches: (row: PageRow) => 'other' === row.categoryKey,
	},
];

/**
 * "Recent Content" — converted to a thin wrapper around the same real
 * `IssuesSection.tsx` SEO's/AEO's/GEO's own "All Issues" tables already
 * use, per direct instruction. `IssuesSection.tsx`'s own `content` mode
 * (added for this exact conversion — see its own docblock) does the real
 * work: real `wp/v2/posts`/`pages` + `wc/v3/products` fetch, real
 * Blog Post/Landing Page/Product/Other classification + tabs, real
 * word counts, and the same real per-post content-quality findings
 * (`GET /findings`, joined by `object_ref`) `SeoIssuesByPageTable.tsx`
 * already renders as expandable finding sub-rows.
 *
 * Real capabilities this component used to have on its own don't survive
 * the move to that shared table's own fixed action/column set, and
 * aren't rebuilt here — said plainly rather than silently dropped:
 * - The "Show ignored" toggle: `IssuesSection.tsx`'s own findings fetch
 *   (`fetchOpenFindingsFor`) only ever requests `status=open` findings: an
 *   already-ignored finding is no longer fetched at all, so there's
 *   nothing left to toggle back into view.
 * - The per-finding Review/Resolve/Ignore/Fix-with-AI action row
 *   (`renderFindingsDetail`'s own custom button group): a finding
 *   sub-row now gets the same fixed action set every page row gets
 *   (just "Analyze" today — see `SeoIssuesByPageTable.tsx`'s own
 *   current `action` header), not a dedicated inline Resolve/Ignore/
 *   Reopen row.
 * - Edit/View/Delete row actions: `SeoIssuesByPageTable.tsx` currently
 *   has no Edit/View at all (removed there independently of this
 *   conversion), and this conversion's own real Delete (a real `DELETE`
 *   request) was removed again per direct instruction — "Analyze" is the
 *   one row action this table shows for Recent Content today.
 */
const RecentContentCard = () => {
	/** Set by a real "Analyze" click in the "Pages & Posts" table below — opens the same real `ContentQualityCard` sidebar (`GET /content-intelligence/quality?post_id=`, real for any real post id). */
	const [analyzingId, setAnalyzingId] = useState<number | null>(null);

	const content: ContentModeConfig = {
		landingPageMetaKey: LANDING_PAGE_META_KEY,
		categories: CATEGORIES,
		rowTabs: RESOURCE_TABS,
		// This card's own original bespoke toolbar (search + severity/
		// resource selects + Show ignored + Export CSV), restored in place
		// of the usual tab-bar/summary-cards pair per direct instruction.
		toolbarFilters: true,
	};

	return (
		<ContainerComponent>
			<ColumnComponent grid={analyzingId ? 8 : 12}>
				<IssuesSection
					id="content-audit-section"
					scannerIds={CONTENT_SCANNER_IDS}
					title={__('Recent Content', 'vulopilot')}
					titleIcon="edit"
					desc={__('Your most recently published or updated content.', 'vulopilot')}
					issuesColumnLabel={__('Content Issues', 'vulopilot')}
					content={content}
					onAnalyze={setAnalyzingId}
					activePostId={analyzingId}
					headerAction={
						<ButtonInput
							buttons={{
								text: __('View All', 'vulopilot'),
								rightIcon: 'arrow-right',
								color: 'text-purple',
								onClick: (e: { preventDefault: () => void }) => {
									e.preventDefault();
									window.location.href = `${appLocalizer.site_url}/wp-admin/edit.php`;
								},
							}}
						/>
					}
				/>
			</ColumnComponent>
			{analyzingId && (
				<ColumnComponent grid={4}>
					<ContentQualityCard
						postId={analyzingId}
						onClose={() => setAnalyzingId(null)}
					/>
				</ColumnComponent>
			)}
		</ContainerComponent>
	);
};

export default RecentContentCard;
