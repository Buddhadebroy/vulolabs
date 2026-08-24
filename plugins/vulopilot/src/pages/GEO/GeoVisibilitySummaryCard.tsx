import { __, sprintf } from '@wordpress/i18n';
import { BadgeComponent, CardComponent, ChartComponent } from '@zyra/components';
import { formatWpDate } from '../../services/formatWpDate';
import ProLockedCard from '../../components/ProLockedCard';
import { computeTrendChange } from './GeoTrendCompactCard';
import type {
	VisibilitySnapshot,
	GeoVisibilityHistoryRow,
} from './useGeoVisibilitySnapshot';

const getRating = (score: number): string => {
	if (score >= 70) {
		return __('Good', 'vulopilot');
	}
	if (score >= 40) {
		return __('Needs Work', 'vulopilot');
	}
	return __('Poor', 'vulopilot');
};

const ratingClass = (score: number): string => {
	if (score >= 70) {
		return 'is-good';
	}
	if (score >= 40) {
		return 'is-attention';
	}
	return 'is-poor';
};

const average = (values: number[]): number =>
	values.length
		? Math.round(values.reduce((sum, n) => sum + n, 0) / values.length)
		: 0;

interface GeoVisibilitySummaryCardProps {
	snapshot: VisibilitySnapshot | null;
	history: GeoVisibilityHistoryRow[];
	isLoading: boolean;
	/** Real total open GEO findings count — GeoTab.tsx's own shared `groups` fetch (useGeoFindingGroups.ts), summed across every GEO scanner. No second fetch just for this one number. */
	totalOpenFindings: number;
}

/**
 * "Overall AI Visibility" — merges 3 previously separate cards into one,
 * same gauge-left/stat-rows-right shape AeoScoreSummaryCard.tsx already
 * established for AeoTab.tsx's own "AEO Score" card (direct instruction:
 * "merge this sections and design like attached image" — the attached
 * reference is that same AEO Score card, reused here rather than a 2nd,
 * different layout). Nothing here is a new number — every real value below
 * was already computed by one of the 2 cards this replaces:
 *
 * - Left (was GeoVisibilityOverviewRow.tsx's own "Overall AI Visibility"
 *   gauge): the same real sitewide `overall_score`, `history`'s own latest
 *   sampled day. Below it, in the reference image's own "Goal: 70+" tip-box
 *   slot, sits GeoTrendCompactCard.tsx's own real trend readout instead (was
 *   its separate "Are You Getting Easier to Find?" card) — "↑/↓ N points
 *   since last scan" plus "Checked N times · best M/100 on <date>", both
 *   straight out of `computeTrendChange()` (that component's own extracted
 *   function, the exact numbers its sparkline card used to plot). The
 *   sparkline chart itself is dropped, same trade AeoScoreSummaryCard.tsx's
 *   own docblock already made for its "Content Change" row — condensed into
 *   real text instead of a fabricated placeholder.
 * - Right (was GeoVisibilityOverviewRow.tsx's own "The 4 things AI checks
 *   for" grid): the same real 4 buckets (Clarity/Recognition/Evidence/Trust,
 *   each a genuine average of `snapshot`'s own `ai_scores`/`sub_scores`
 *   dimensions — see that removed component's own former docblock, reused
 *   verbatim here), one stat row per bucket with a real Good/Needs
 *   Work/Poor `BadgeComponent` as its value — filling the reference image's
 *   4-row list shape with this tab's own real per-dimension breakdown
 *   instead of AeoTab's questions/pages/change numbers, since GEO doesn't
 *   have those.
 * - Card `desc` restates GeoVisibilityOverviewRow.tsx's own real "We checked
 *   N pages and found M things AI cares about" line (`history`'s own
 *   `sample_size` + `totalOpenFindings`), same real numbers, just moved up
 *   from inside the gauge card body into the outer `CardComponent` header.
 *
 * GeoVisibilityOverviewRow.tsx (now fully superseded, every real number it
 * had reproduced here) was deleted rather than kept as unused dead code.
 * GeoTrendCompactCard.tsx's own default-exported sparkline component is
 * left in place — still real, valid code — just no longer rendered
 * anywhere now that GeoTab.tsx renders this card instead; see that file's
 * own docblock.
 */
const GeoVisibilitySummaryCard = ({
	snapshot,
	history,
	isLoading,
	totalOpenFindings,
}: GeoVisibilitySummaryCardProps) => {
	const hasSnapshot = Boolean(
		snapshot && snapshot.ai_scores && snapshot.sub_scores
	);

	const withScore = history.filter((row) => null !== row.overall_score);
	const latest = withScore[withScore.length - 1] ?? null;
	const overall = (latest?.overall_score as number) ?? 0;
	const trend = computeTrendChange(history);

	const buckets =
		hasSnapshot && snapshot
			? [
					{
						key: 'clarity',
						icon: 'blocks',
						colorClass: 'is-score',
						title: __('How Clear Your Content Is', 'vulopilot'),
						desc: __(
							'Purpose clarity, LLM readability, answer-first structure',
							'vulopilot'
						),
						score: average([
							snapshot.ai_scores.purpose_clarity,
							snapshot.ai_scores.llm_readability,
							snapshot.ai_scores.answer_first_structure,
						]),
					},
					{
						key: 'recognition',
						icon: 'person',
						colorClass: 'is-questions',
						title: __('How Well AI Recognizes You', 'vulopilot'),
						desc: __(
							'Entity coverage, knowledge graph coverage',
							'vulopilot'
						),
						score: average([
							snapshot.ai_scores.entity_coverage,
							snapshot.ai_scores.knowledge_graph_coverage,
						]),
					},
					{
						key: 'evidence',
						icon: 'report',
						colorClass: 'is-ready',
						title: __('Whether Claims Are Backed Up', 'vulopilot'),
						desc: __(
							'Citation readiness, retrieval score',
							'vulopilot'
						),
						score: average([
							snapshot.sub_scores.citation_readiness,
							snapshot.sub_scores.retrieval_score,
						]),
					},
					{
						key: 'trust',
						icon: 'faq',
						colorClass: 'is-change',
						title: __('How Trustworthy You Look', 'vulopilot'),
						desc: __(
							'Conversation readiness, question coverage, answer completeness',
							'vulopilot'
						),
						score: average([
							snapshot.ai_scores.conversation_readiness,
							snapshot.ai_scores.question_coverage,
							snapshot.ai_scores.answer_completeness,
						]),
					},
				]
			: [];

	const cardDesc = hasSnapshot
		? sprintf(
				/* translators: 1: number of pages sampled, 2: number of open GEO findings across the site. */
				__(
					'We checked %1$d pages and found %2$d things AI cares about.',
					'vulopilot'
				),
				latest?.sample_size ?? snapshot?.sample_size ?? 0,
				totalOpenFindings
			)
		: __(
				'How easy it is for AI search engines to discover, understand, and trust your website.',
				'vulopilot'
			);

	return (
		<CardComponent
			title={__('Overall AI Visibility', 'vulopilot')}
			desc={cardDesc}
			isLoading={isLoading}
		>
			<div className="aeo-score-summary">
				<div className="aeo-score-summary-gauge">
					<div className="geo-overall-visibility">
						<ChartComponent
							type="pie"
							height={140}
							centerLabel={
								<>
									<span className="score-ring-number">
										{overall}
									</span>
									<span className="score-ring-label">/100</span>
									<span
										className={`score-ring-label geo-overall-rating ${ratingClass(overall)}`}
									>
										{getRating(overall)}
									</span>
								</>
							}
							data={[
								{
									label: __('Score', 'vulopilot'),
									value: overall,
									color: '#16a34a',
								},
								{
									label: __('Remaining', 'vulopilot'),
									value: 100 - overall,
									color: '#e5e7eb',
								},
							]}
						/>
					</div>
					<div className="aeo-score-goal-box">
						<i className="adminfont-light" />
						{trend ? (
							<div>
								<strong
									className={trend.change >= 0 ? 'is-good' : 'is-attention'}
								>
									{trend.change >= 0 ? '↑' : '↓'}{' '}
									{sprintf(
										/* translators: %d is the number of points changed since the previous scan. */
										__('%d points since last scan', 'vulopilot'),
										Math.abs(trend.change)
									)}
								</strong>
								<p>
									{sprintf(
										/* translators: 1: number of times this site has been scanned, 2: the best score ever recorded, 3: the date it was recorded on. */
										__(
											'Checked %1$d times · best %2$d/100 on %3$s',
											'vulopilot'
										),
										trend.checkedCount,
										trend.best,
										formatWpDate(trend.bestDate)
									)}
								</p>
							</div>
						) : (
							<div>
								<strong>
									{__('Not enough history yet', 'vulopilot')}
								</strong>
								<p>
									{__(
										'This builds up automatically each time your snapshot schedule runs.',
										'vulopilot'
									)}
								</p>
							</div>
						)}
					</div>
				</div>
				<div className="aeo-score-summary-stats">
					{buckets.map((bucket, index) => (
						<div
							key={bucket.key}
							className={`aeo-score-stat-row ${0 === index ? 'is-first' : ''}`}
						>
							<div className={`aeo-score-stat-icon ${bucket.colorClass}`}>
								<i className={`adminfont-${bucket.icon}`} />
							</div>
							<div className="aeo-score-stat-text">
								<div className="aeo-score-stat-title">
									{bucket.title}
								</div>
								<div className="aeo-score-stat-desc">
									{bucket.desc}
								</div>
							</div>
							<BadgeComponent
								className="geo-four-checks-badge"
								color={ratingClass(bucket.score)}
								text={getRating(bucket.score)}
							/>
						</div>
					))}
				</div>
			</div>
		</CardComponent>
	);
};

export default GeoVisibilitySummaryCard;
