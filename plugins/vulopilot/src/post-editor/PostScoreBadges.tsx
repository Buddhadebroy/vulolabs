import { sprintf } from '@wordpress/i18n';
import { useEffect, useState } from '@wordpress/element';
import { fetchOpenFindings, getPostSeoScore } from './api';

/**
 * This tab's own local copy of `PageAnalysisTab.tsx`'s `AEO_SCANNER_IDS` - same real scanner-id
 * union, kept in sync by hand the same way that file's own docblock already notes for its
 * GEO/AEO copies.
 */
const AEO_SCANNER_IDS = [ 'geo-faq-opportunity', 'geo-summary-block', 'aeo-schema' ];

/**
 * Same real severity-weighted formula `AeoScoreSummaryCard.tsx`'s own `calculateScore()` (the
 * dashboard-wide "AEO Score" card) already uses - there is no per-post AEO score anywhere yet, so
 * this reuses that exact formula narrowed to this one post's own open AEO findings instead of
 * inventing a new metric.
 */
const calculateAeoScore = ( breakdown: { critical: number; high: number; medium: number; low: number } ): number => {
	const score =
		100 -
		breakdown.critical * 15 -
		breakdown.high * 8 -
		breakdown.medium * 3 -
		breakdown.low * 1;

	return Math.max( 0, Math.min( 100, score ) );
};

interface PostScoreBadgesProps {
	postId: number;
}

/**
 * The two score badges shown at the top of every post/page's "VuloPilot SEO" sidebar - real SEO
 * score (`Seo::calculate_score()`, narrowed server-side to this post) and real AI/AEO score
 * (this post's own open AEO findings, scored client-side with the same formula the dashboard's
 * AEO Score card uses).
 */
export default function PostScoreBadges( { postId }: PostScoreBadgesProps ) {
	const [ seoScore, setSeoScore ] = useState< number | null >( null );
	const [ aeoScore, setAeoScore ] = useState< number | null >( null );

	useEffect( () => {
		if ( ! postId ) {
			return;
		}

		let cancelled = false;

		getPostSeoScore( postId )
			.then( ( response ) => {
				if ( ! cancelled ) {
					setSeoScore( response.score );
				}
			} )
			.catch( () => {
				// Left as "…" - the tabs below show the real error if the underlying fetch failed.
			} );

		fetchOpenFindings( AEO_SCANNER_IDS )
			.then( ( findings ) => {
				if ( cancelled ) {
					return;
				}

				const breakdown = { critical: 0, high: 0, medium: 0, low: 0 };

				findings
					.filter( ( finding ) => finding.object_ref === String( postId ) )
					.forEach( ( finding ) => {
						if ( finding.severity in breakdown ) {
							breakdown[ finding.severity as keyof typeof breakdown ] += 1;
						}
					} );

				setAeoScore( calculateAeoScore( breakdown ) );
			} )
			.catch( () => {} );

		return () => {
			cancelled = true;
		};
	}, [ postId ] );

	return (
		<div className="vulopilot-seo-score-badges">
			<span className="vulopilot-seo-score-badge vulopilot-seo-score-badge--seo">
				<i className="dashicons dashicons-awards" />
				{ null === seoScore ? sprintf( '… / %d', 100 ) : sprintf( '%d / %d', seoScore, 100 ) }
			</span>
			<span className="vulopilot-seo-score-badge vulopilot-seo-score-badge--ai">
				<i className="dashicons dashicons-lightbulb" />
				{ null === aeoScore ? sprintf( '… / %d', 100 ) : sprintf( '%d / %d', aeoScore, 100 ) }
			</span>
		</div>
	);
}
