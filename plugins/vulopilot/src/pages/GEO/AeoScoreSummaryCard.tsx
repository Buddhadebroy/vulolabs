import { __, sprintf } from '@wordpress/i18n';
import { CardComponent, ChartComponent } from '@zyra/components';
import type { TrendChange } from './GeoTrendCompactCard';

/**
 * Score a site needs to reach for a real "Good" AEO rating — same `>= 70`
 * cutoff AeoTab.tsx's own `getRating()`/`ratingClass()` already use for the
 * gauge itself, so this card's own "Goal: 70+" copy always agrees with
 * what actually turns that gauge green, rather than a second, invented
 * number.
 */
const GOOD_RATING_THRESHOLD = 70;

interface AeoScoreSummaryCardProps {
	isLoading: boolean;
	aeoScore: number;
	ratingLabel: string;
	ratingClassName: string;
	questionsAnswered: number;
	totalPages: number;
	pagesReady: number;
	/** `null` when there isn't at least 2 real sampled days to compare yet (GeoTrendCompactCard.tsx's own `computeTrendChange()`) — the "Content Change" row shows an em dash rather than a fabricated number in that case. */
	trend: TrendChange | null;
}

/**
 * "AEO Score" — one real card matching the reference mockup exactly (direct
 * instruction: "design this exact same card... with dynamic data"): the
 * score gauge + a real "Goal: 70+" nudge on the left, 4 real stat rows on
 * the right. Replaces the previous 3-card row this tab had (a merged
 * gauge+sparkline card, plus 2 standalone "Questions Answered"/"Pages
 * Ready" tiles) with the single unified card the mockup shows.
 *
 * "Current AEO Score" restates the same gauge number as its own list row —
 * intentional, matching the mockup exactly, not an accidental duplicate
 * the way earlier passes on this tab flagged and removed real duplicates.
 * The sparkline chart itself is dropped in this design (the mockup has
 * none) — condensed into the single real "Content Change" stat row
 * instead, via GeoTrendCompactCard.tsx's own extracted `computeTrendChange()`
 * (the exact same real first-vs-latest number that component's own
 * sparkline card plots, just without the chart) rather than a fabricated
 * placeholder. "Questions Answered"/"Pages Ready" are the same two real
 * numbers (`useAeoPageAnalysis.ts`) this tab already computed for its own
 * former standalone tiles.
 */
const AeoScoreSummaryCard = ({
	isLoading,
	aeoScore,
	ratingLabel,
	ratingClassName,
	questionsAnswered,
	totalPages,
	pagesReady,
	trend,
}: AeoScoreSummaryCardProps) => {
	const changeValue = trend
		? sprintf(
				/* translators: %1$s is a signed number, e.g. "+8"; %2$s is "pts". */
				'%1$s%2$d %3$s',
				trend.change >= 0 ? '+' : '',
				trend.change,
				__('pts', 'vulopilot')
			)
		: '—';

	const rows: {
		key: string;
		icon: string;
		colorClass: string;
		title: string;
		desc: string;
		value: string;
		valueClass?: string;
	}[] = [
		{
			key: 'score',
			icon: 'check',
			colorClass: 'is-score',
			title: __('Out of 100', 'vulopilot'),
			desc: __('Current AEO Score', 'vulopilot'),
			value: String(aeoScore),
		},
		{
			key: 'questions',
			icon: 'faq',
			colorClass: 'is-questions',
			title: __('Questions Answered', 'vulopilot'),
			desc: __('Published pages with adequate FAQ/Q&A', 'vulopilot'),
			value: sprintf('%d/%d', questionsAnswered, totalPages),
		},
		{
			key: 'pages-ready',
			icon: 'document',
			colorClass: 'is-ready',
			title: __('Pages Ready', 'vulopilot'),
			desc: __('Ready for AI answer engine', 'vulopilot'),
			value: sprintf('%d/%d', pagesReady, totalPages),
		},
		{
			key: 'change',
			icon: trend && trend.change < 0 ? 'arrow-down' : 'arrow-up',
			colorClass: 'is-change',
			title: __('Content Change', 'vulopilot'),
			desc: __('Score movement (last 30 days)', 'vulopilot'),
			value: changeValue,
			valueClass: trend ? (trend.change >= 0 ? 'is-good' : 'is-attention') : '',
		},
	];

	return (
		<CardComponent
			title={__('AEO Score', 'vulopilot')}
			desc={__(
				'How ready your content is to be extracted and quoted directly by AI answer engines.',
				'vulopilot'
			)}
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
										{aeoScore}
									</span>
									<span className="score-ring-label">/100</span>
									<span
										className={`score-ring-label geo-overall-rating ${ratingClassName}`}
									>
										{ratingLabel}
									</span>
								</>
							}
							data={[
								{
									label: __('Score', 'vulopilot'),
									value: aeoScore,
									color: '#7C3AED',
								},
								{
									label: __('Remaining', 'vulopilot'),
									value: 100 - aeoScore,
									color: '#e5e7eb',
								},
							]}
						/>
					</div>
					<div className="aeo-score-goal-box">
						<i className="adminfont-light" />
						<div>
							<strong>
								{sprintf(
									/* translators: %d is the real score this tab's own "Good" rating starts at. */
									__('Goal: %d+ for strong AI visibility', 'vulopilot'),
									GOOD_RATING_THRESHOLD
								)}
							</strong>
							<p>
								{__(
									'Improve content structure and clarity to be more discoverable by AI engines.',
									'vulopilot'
								)}
							</p>
						</div>
					</div>
				</div>
				<div className="aeo-score-summary-stats">
					{rows.map((row, index) => (
						<div
							key={row.key}
							className={`aeo-score-stat-row ${0 === index ? 'is-first' : ''}`}
						>
							<div className={`aeo-score-stat-icon ${row.colorClass}`}>
								<i className={`adminfont-${row.icon}`} />
							</div>
							<div className="aeo-score-stat-text">
								<div className="aeo-score-stat-title">
									{row.title}
								</div>
								<div className="aeo-score-stat-desc">
									{row.desc}
								</div>
							</div>
							<div
								className={`aeo-score-stat-value ${row.valueClass ?? ''}`}
							>
								{row.value}
							</div>
						</div>
					))}
				</div>
			</div>
		</CardComponent>
	);
};

export default AeoScoreSummaryCard;
