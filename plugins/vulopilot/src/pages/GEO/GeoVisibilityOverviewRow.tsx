import { __, sprintf } from '@wordpress/i18n';
import { CardComponent, ChartComponent, ContainerComponent, ColumnComponent, BadgeComponent } from '@zyra/components';
import ProLockedCard from '../../components/ProLockedCard';
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

interface GeoVisibilityOverviewRowProps {
	snapshot: VisibilitySnapshot | null;
	history: GeoVisibilityHistoryRow[];
	isLoading: boolean;
	/** Real total open GEO findings count — GeoTab.tsx's own shared `groups` fetch (useGeoFindingGroups.ts), summed across every GEO scanner. No second fetch just for this one number. */
	totalOpenFindings: number;
}

/**
 * "Overall AI Visibility" + "The 4 things AI checks for" — both real,
 * sourced from vulopilot-pro's GeoInsights module (Pro-only). `snapshot`/
 * `history` are fetched once by GeoTab.tsx via useGeoVisibilitySnapshot.ts
 * and passed down (shared with GeoTrendCompactCard.tsx and the competitor
 * comparison card's own "your own score" bar) rather than fetched again
 * here.
 *
 * - Overall score + "up N points since last scan" + "checked N times" all
 *   come from `history` — its own daily rows already include a real
 *   `overall_score`
 *   (GeoInsights\VisibilitySnapshotBuilder::calculate_overall_score(), the
 *   same "one combined number across every ai_scores + sub_scores value"
 *   formula GeoAnalyzer's own per-post overall_score uses, applied
 *   sitewide) — `snapshot` itself doesn't expose that field (it only
 *   returns the raw per-dimension breakdown), but history's own
 *   most-recent row is written in the same run, so it's the same real
 *   number.
 * - "The 4 things AI checks for" groups `snapshot`'s own 10 real
 *   dimensions (`ai_scores`/`sub_scores`) into 4 human-readable buckets,
 *   each a genuine average of its own real constituent scores — a
 *   presentational grouping, not an invented number: Clarity
 *   (purpose_clarity/llm_readability/answer_first_structure), Recognition
 *   (entity_coverage/knowledge_graph_coverage), Evidence
 *   (citation_readiness/retrieval_score), Trust
 *   (conversation_readiness/question_coverage/answer_completeness).
 */
const GeoVisibilityOverviewRow = ({
	snapshot,
	history,
	isLoading,
	totalOpenFindings,
}: GeoVisibilityOverviewRowProps) => {
	if (isLoading) {
		return (
			<ContainerComponent>
				<ColumnComponent grid={6}>
					<CardComponent
						title={__('Overall AI Visibility', 'vulopilot')}
						isLoading
					/>
				</ColumnComponent>
				<ColumnComponent grid={6}>
					<CardComponent
						title={__('The 4 things AI checks for', 'vulopilot')}
						isLoading
					/>
				</ColumnComponent>
			</ContainerComponent>
		);
	}

	if (!snapshot || !snapshot.ai_scores || !snapshot.sub_scores) {
		return (
			<ContainerComponent>
				<ColumnComponent grid={6}>
					<CardComponent
						title={__('Overall AI Visibility', 'vulopilot')}
						desc={__(
							'How easy it is for AI search engines to discover, understand, and trust your website.',
							'vulopilot'
						)}
					>
						<ProLockedCard moduleName="geo-insights" />
					</CardComponent>
				</ColumnComponent>
				<ColumnComponent grid={6}>
					<CardComponent title={__('The 4 things AI checks for', 'vulopilot')}>
						<ProLockedCard moduleName="geo-insights" />
					</CardComponent>
				</ColumnComponent>
			</ContainerComponent>
		);
	}

	const withScore = history.filter((row) => null !== row.overall_score);
	const latest = withScore[withScore.length - 1] ?? null;
	const previous = withScore[withScore.length - 2] ?? null;
	const overall = latest?.overall_score ?? 0;
	const delta =
		latest && previous
			? (latest.overall_score as number) - (previous.overall_score as number)
			: null;

	const { ai_scores, sub_scores } = snapshot;

	const buckets = [
		{
			key: 'clarity',
			label: __('How Clear Your Content Is', 'vulopilot'),
			score: average([
				ai_scores.purpose_clarity,
				ai_scores.llm_readability,
				ai_scores.answer_first_structure,
			]),
		},
		{
			key: 'recognition',
			label: __('How Well AI Recognizes You', 'vulopilot'),
			score: average([
				ai_scores.entity_coverage,
				ai_scores.knowledge_graph_coverage,
			]),
		},
		{
			key: 'evidence',
			label: __('Whether Claims Are Backed Up', 'vulopilot'),
			score: average([
				sub_scores.citation_readiness,
				sub_scores.retrieval_score,
			]),
		},
		{
			key: 'trust',
			label: __('How Trustworthy You Look', 'vulopilot'),
			score: average([
				ai_scores.conversation_readiness,
				ai_scores.question_coverage,
				ai_scores.answer_completeness,
			]),
		},
	];

	return (
		<ContainerComponent>
			<ColumnComponent grid={6}>
				<CardComponent title={__('Overall AI Visibility', 'vulopilot')}>
					<div className="geo-overall-visibility">
						<ChartComponent
							type="pie"
							height={140}
							centerLabel={
								<>
									<span className="score-ring-number">{overall}</span>
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
						<div className="geo-overall-visibility-meta">
							{null !== delta && (
								<p
									className={`geo-overall-visibility-delta ${delta >= 0 ? 'is-good' : 'is-attention'}`}
								>
									{delta >= 0 ? '↑' : '↓'}{' '}
									{sprintf(
										/* translators: %d is the number of points changed since the previous scan. */
										__('%d points since last scan', 'vulopilot'),
										Math.abs(delta)
									)}
								</p>
							)}
							<p className="geo-overall-visibility-desc">
								{sprintf(
									/* translators: 1: number of pages sampled, 2: number of open GEO findings across the site. */
									__(
										'We checked %1$d pages and found %2$d things AI cares about.',
										'vulopilot'
									),
									latest?.sample_size ?? snapshot.sample_size,
									totalOpenFindings
								)}
							</p>
						</div>
					</div>
				</CardComponent>
			</ColumnComponent>
			<ColumnComponent grid={6}>
				<CardComponent title={__('The 4 things AI checks for', 'vulopilot')}>
					<div className="geo-four-checks-grid">
						{buckets.map((bucket) => (
							<div
								key={bucket.key}
								className={`geo-four-checks-tile ${ratingClass(bucket.score)}`}
							>
								<p className="geo-four-checks-title">{bucket.label}</p>
								<BadgeComponent
									className="geo-four-checks-badge"
									color={ratingClass(bucket.score)}
									text={getRating(bucket.score)}
								/>
							</div>
						))}
					</div>
				</CardComponent>
			</ColumnComponent>
		</ContainerComponent>
	);
};

export default GeoVisibilityOverviewRow;
