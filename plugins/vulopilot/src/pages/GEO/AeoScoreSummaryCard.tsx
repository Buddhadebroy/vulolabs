import { __, sprintf } from '@wordpress/i18n';
import { COLOR_PALETTE } from '@zyra/core';
import { AnalyticsComponent, CardComponent, ChartComponent, IconComponent, ListComponent, TypographyComponent } from '@zyra/components';
import type { FindingGroup } from '../../components/Issues/issuesTypes';
import type { TrendChange } from './geoTrendChange';

/**
 * Same real severity-weighted 0-100 formula `Seo::calculate_score()`/ `Geo::calculate_score()` use
 * server-side for their own per-category/per-signal scores.
 */
const calculateScore = (breakdown: {
	critical: number;
	high: number;
	medium: number;
	low: number;
}): number => {
	const score =
		100 -
		breakdown.critical * 15 -
		breakdown.high * 8 -
		breakdown.medium * 3 -
		breakdown.low * 1;

	return Math.max(0, Math.min(100, score));
};

const ratingColorFor = (score: number): string => {
	if (score >= 70) {
		return 'green';
	}
	if (score >= 40) {
		return 'yellow';
	}
	return 'red';
};

/**
 * Same real 3-tier text `AeoTab.tsx`'s own (now-removed) local `getRating()` used for this same
 * ring.
 */
const overallRatingLabel = (score: number): string => {
	if (score >= 70) {
		return __('Good', 'vulopilot');
	}
	if (score >= 40) {
		return __('Needs Work', 'vulopilot');
	}
	return __('At Risk', 'vulopilot');
};


interface AeoTopic {
	key: string;
	title: string;
	titleIcon: string;
	scannerIds: string[];
}


interface AeoScoreSummaryCardProps {
	isLoading: boolean;
	questionsAnswered: number;
	totalPages: number;
	pagesReady: number;
	/** `null` when there isn't at least 2 real sampled days to compare yet (GeoTrendCompactCard.tsx's own `computeTrendChange()`). */
	trend: TrendChange | null;
	/** AeoTab.tsx's own real `AEO_SECTIONS` - this card's own row breakdown, same shape `GeoScoreSection.tsx`'s own `SIGNAL_META` feeds its 7 rows. */
	topics: AeoTopic[];
	/** `GET /findings/groups`, already fetched by AeoTab.tsx for `GeoByTopicGrid`. */
	groups: FindingGroup[];
	/** AeoTab.tsx's own real `goToIssuesTable` - same real click-through `GeoScoreSection.tsx`'s own `onSelectSignal` gives its rows. */
	// eslint-disable-next-line no-unused-vars
	onSelectTopic?: (topicKey: string) => void;
}

/**
 * "AEO Score" - restructured to match `GeoScoreSection.tsx`'s own "GEO Score" card exactly.
 */
const AeoScoreSummaryCard = ({
	isLoading,
	questionsAnswered,
	totalPages,
	pagesReady,
	trend,
	topics,
	groups,
	onSelectTopic,
}: AeoScoreSummaryCardProps) => {
	const changeValue = trend
		? sprintf(
				/* translators: %1$s is a signed number, e.g. "+8"; %2$s is "pts". */
				'%1$s%2$d %3$s',
				trend.change >= 0 ? '+' : '',
				trend.change,
				__('pts', 'vulopilot')
			)
		: '-';

	const topicScores = topics.map((topic) => {
		const topicGroups = groups.filter((group) =>
			topic.scannerIds.includes(group.scanner_id)
		);
		const openCount = topicGroups.reduce((sum, group) => sum + group.count, 0);
		const breakdown = { critical: 0, high: 0, medium: 0, low: 0 };
		topicGroups.forEach((group) => {
			if ('info' !== group.severity) {
				breakdown[group.severity] += group.count;
			}
		});

		return { topic, openCount, score: calculateScore(breakdown) };
	});

	const overallScore = topicScores.length
		? Math.round(
				topicScores.reduce((sum, row) => sum + row.score, 0) /
					topicScores.length
			)
		: 0;

	const topicRows = topicScores.map(({ topic, openCount, score }) => {
		return {
			id: topic.key,
			icon: topic.titleIcon,
			title: topic.title,
			desc: sprintf(
				/* translators: %d: real number of open findings. */
				__('%d issues', 'vulopilot'),
				openCount
			),
			tags: (
				<>
					<TypographyComponent
						variant="h5"
						weight="bold"
						color={ratingColorFor(score)}
						className="seo-health-score-row-value"
					>
						{score}
						<TypographyComponent
							as="span"
							variant="body-md"
							className="seo-health-score-row-suffix"
						>
							/100
						</TypographyComponent>
					</TypographyComponent>
					<IconComponent name="pagination-right-arrow" />
				</>
			),
			action: () => onSelectTopic?.(topic.key),
		};
	});

	return (
		<CardComponent
			title={__('AEO Score', 'vulopilot')}
			titleIcon="ai"
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
							type="ring"
							height={200}
							// Top-level `color` - `type="ring"` only ever paints its stroke from
							// this prop.
							color={
								COLOR_PALETTE[
									ratingColorFor(overallScore) as keyof typeof COLOR_PALETTE
								]
							}
							centerLabel={
								<>
									<TypographyComponent
										variant={'h1'}
										color={ratingColorFor(overallScore)}
									>
										{overallScore}
									</TypographyComponent>
									<TypographyComponent variant={'h4'}>
										{overallRatingLabel(overallScore)}
									</TypographyComponent>
								</>
							}
							data={[
								{
									label: __('Score', 'vulopilot'),
									value: overallScore,
									// Same real rating color the ring's own Needs Work/Good/Poor
									// label above already uses (`overallRatingClass()`/
									// `overallRatingLabel()`).
									color: COLOR_PALETTE[
										ratingColorFor(overallScore) as keyof typeof COLOR_PALETTE
									],
								},
								{
									label: __('Remaining', 'vulopilot'),
									value: 100 - overallScore,
									color: '#e5e7eb',
								},
							]}
						/>
						<TypographyComponent variant={'h3'} color="text-green">
							{__('AEO Score', 'vulopilot')}
						</TypographyComponent>
						<div className="desc">
							{__(
								'How ready your content is to be extracted and quoted directly by AI answer engines.',
								'vulopilot'
							)}
						</div>
					</div>
				</div>
				<div className="aeo-score-summary-stat">
					<ListComponent
						className="mini-card report hover without-border seo-health-score-category-list"
						loading={isLoading}
						items={topicRows}
					/>
				</div>
			</div>
			<AnalyticsComponent
				variant="background-color"
				cols={3}
				isLoading={isLoading}
				data={[
					{
						colorClass: 'admin-bg-color2',
						number: sprintf(
							/* translators: 1: real count for this metric, 2: real total published pages checked. */
							__('%1$d / %2$d', 'vulopilot'),
							questionsAnswered,
							totalPages
						),
						text: __('Questions Answered', 'vulopilot'),
					},
					{
						colorClass: 'admin-bg-color3',
						number: sprintf(
							/* translators: 1: real count for this metric, 2: real total published pages checked. */
							__('%1$d / %2$d', 'vulopilot'),
							pagesReady,
							totalPages
						),
						text: __('Pages Ready', 'vulopilot'),
					},
					{
						colorClass: 'admin-bg-color4',
						number: (
							<span className={trend && trend.change < 0 ? 'is-attention' : 'is-good'}>
								{changeValue}
							</span>
						),
						text: __('Content Change', 'vulopilot'),
					},
				]}
			/>
		</CardComponent>
	);
};

export default AeoScoreSummaryCard;
