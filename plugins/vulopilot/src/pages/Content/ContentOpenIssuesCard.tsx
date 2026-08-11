import { __ } from '@wordpress/i18n';
import { TooltipComponent } from '@zyra/components';
import OpenIssuesGlimpse from '../../components/OpenIssuesGlimpse';

/**
 * Same 2 real scanners AiContentTab.tsx's own "Open Issues" glimpse
 * covered (`thin-content` → category 'seo', `readability`/
 * `heading-structure` → category 'content' — mixed categories, so
 * `scannerIds` is used instead of a single `category`, same reasoning
 * AiContentTab.tsx's own SCANNER_TO_SECTION comment already gives). Its
 * other 3 categories (trust, multimedia, tone) never had a real scanner
 * behind them, so there's nothing further to carry over here.
 */
const CONTENT_SCANNER_IDS = ['thin-content', 'readability', 'heading-structure'];

const goToHealthPage = () => {
	window.location.href = '?page=vulopilot#&tab=health';
};

/**
 * "Content Quality Issues" — moved here from the now-removed "AI Content"
 * tab (AiContentTab.tsx), same real `/findings` glimpse data (open
 * thin-content/readability/heading-structure findings), same "Fix
 * Everything with AI" honestly-disabled footer GEO's/Security's/
 * Performance's own Overview glimpse cards already use (no bulk-fix/
 * action-trigger endpoint exists anywhere in this codebase).
 *
 * Clicking a row used to scroll-and-highlight the matching section further
 * down the AI Content tab; that tab (and its section anchors) no longer
 * exists, so `onItemClick` instead sends the user to the real Health page
 * (`Health.tsx`, tab `health`) — "every finding across every scanner
 * category," the same real destination AiContentTab's own module-off
 * guard already pointed to for these exact findings ("still show up on
 * the Health page").
 */
const ContentOpenIssuesCard = () => (
	<OpenIssuesGlimpse
		scannerIds={CONTENT_SCANNER_IDS}
		titleIcon="content"
		title={__('Content Quality Issues', 'vulopilot')}
		onItemClick={goToHealthPage}
		emptyTitle={__("You're all caught up", 'vulopilot')}
		emptyDesc={__(
			'No open content-quality findings right now.',
			'vulopilot'
		)}
		footer={
			<TooltipComponent
				text={__(
					"Bulk auto-fix isn't available yet — there's no AI action-trigger engine wired up. Fix findings individually from the Health page.",
					'vulopilot'
				)}
			>
				<span
					role="button"
					aria-disabled="true"
					className="content-issues-fix-all disabled"
				>
					<i className="adminfont-ai" />
					{__('Fix All Issues with AI', 'vulopilot')}
				</span>
			</TooltipComponent>
		}
	/>
);

export default ContentOpenIssuesCard;
