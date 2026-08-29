/* global appLocalizer */
import { useEffect, useState } from '@wordpress/element';
import { JSX } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { getApiLink, getApiResponse } from '@zyra/core';
import { BadgeComponent, CardComponent, ChartComponent, ColumnComponent, ContainerComponent, ListComponent, TypographyComponent } from '@zyra/components';
import { SelectInput } from '@zyra/inputs';
import { useFilterSlot } from '../../services/useFilterSlot';
import ProLockedCard from '../../components/ProLockedCard';
import { useGeoScore } from './useGeoScore';
import type { GeoSignalScore } from './useGeoScore';
import './SeoVisibility.scss';

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
		return 'green';
	}
	if (score >= 40) {
		return 'yellow';
	}
	return 'red';
};

/**
 * Same `active_modules` gate GeoTab.tsx's own former `isGeoInsightsActive()`
 * used — duplicated here rather than imported since GeoTab.tsx no longer
 * needs its own copy (see this file's own top-of-module docblock).
 */
const isGeoInsightsActive = () =>
	appLocalizer.active_modules?.includes('geo-insights') ?? false;

/**
 * The 7 real signals `Geo.php`'s own `SIGNAL_SCANNER_IDS` (+ the separately
 * computed `content-freshness`) return — display metadata only (label,
 * icon, a real description of what each one actually checks) kept
 * deliberately free of any numeric "weight", since the real `geo_score`
 * behind this card is an unweighted mean (see Geo.php's own docblock) and
 * no such per-signal weighting number exists anywhere in this codebase to
 * honestly print next to these names.
 */
const SIGNAL_META: { key: keyof import('./useGeoScore').GeoScoreResponse['signals']; label: string; icon: string; description: string }[] = [
	{
		key: 'ai-summary',
		label: __('AI Summary', 'vulopilot'),
		icon: 'ai orange',
		description: __(
			'Whether pages have an extractable AI summary block an AI system can lift directly.',
			'vulopilot'
		),
	},
	{
		key: 'question-coverage',
		label: __('Question Coverage', 'vulopilot'),
		icon: 'question blue',
		description: __(
			'Commonly-asked questions a page plausibly answers, but with no FAQ or Q&A block making that answer easy to extract.',
			'vulopilot'
		),
	},
	{
		key: 'evidence-citations',
		label: __('Evidence & Citations', 'vulopilot'),
		icon: 'report sky',
		description: __(
			'Statistic-shaped claims with no citation or outbound link backing them up.',
			'vulopilot'
		),
	},
	{
		key: 'ai-readable-structure',
		label: __('AI-Readable Structure', 'vulopilot'),
		icon: 'blocks lime',
		description: __(
			'Paragraph length and heading hierarchy — how easily an AI system can extract a clean chunk of this content.',
			'vulopilot'
		),
	},
	{
		key: 'entity-clarity',
		label: __('Entity Clarity', 'vulopilot'),
		icon: 'person cyan',
		description: __(
			'Whether your brand, people, and product names are used consistently enough for AI to recognize them as the same entity.',
			'vulopilot'
		),
	},
	{
		key: 'content-freshness',
		label: __('Content Freshness', 'vulopilot'),
		icon: 'calendar green',
		description: __(
			'How recently your published pages have been updated, relative to your own "stale after" setting.',
			'vulopilot'
		),
	},
	{
		key: 'other-geo-signals',
		label: __('Other GEO Signals', 'vulopilot'),
		icon: 'module violet',
		description: __('Author credentials, trust signals, and llms.txt.', 'vulopilot'),
	},
];

type PeriodDays = '7' | '30' | '90';
const PERIOD_OPTIONS = [
	{ value: '7', label: __('Last 7 days', 'vulopilot') },
	{ value: '30', label: __('Last 30 days', 'vulopilot') },
	{ value: '90', label: __('Last 90 days', 'vulopilot') },
];

interface ProgressResponse {
	days: number;
	trend: { date: string; score: number }[];
}

const mainProblemText = (key: string, signal: GeoSignalScore): string => {
	if (signal.main_problem) {
		return signal.main_problem;
	}
	if (null === signal.score) {
		return __('Not enough content to check yet', 'vulopilot');
	}
	return 'content-freshness' === key
		? __('All checked pages are reasonably up to date', 'vulopilot')
		: __('No open issues found', 'vulopilot');
};

/**
 * "GEO Score" — SEO & Visibility → GEO's own real, free, deterministic
 * scorecard (`GET /geo/score`/`GET /geo/progress`, Geo.php), replacing
 * `GeoVisibilitySummaryCard`'s former "Overall AI Visibility" slot on this
 * tab. That card's own real number came from Pro-only routes
 * (`useGeoVisibilitySnapshot.ts` → `/geo-visibility-summary`/
 * `/geo-visibility-history`, both registered only by vulopilot-pro's
 * GeoInsights module) and silently read `0/100 Poor` with Pro inactive —
 * this card's own `geo_score` is real and populated on every install,
 * matching the reference mockup's own 4-part layout while fixing that
 * free-tier gap. `GeoVisibilitySummaryCard.tsx`/`useGeoVisibilitySnapshot.ts`/
 * `GeoTrendCompactCard.tsx` are left in place, still real, valid code — just
 * no longer rendered anywhere on this tab, same "supersede, don't delete"
 * precedent that file's own docblock already documents for
 * `GeoVisibilityOverviewRow.tsx`.
 *
 * Also absorbs GeoTab.tsx's former standalone "How You Compare to Similar
 * Sites" row (the exact same Pro-slot-or-ProLockedCard rendering, just
 * retitled "Competitor Comparison" to match this card's own reference
 * mockup and placed in this section instead) — GeoTab.tsx used to render it
 * a second time separately, which would now duplicate this section's own
 * bottom-right card.
 *
 * Layout: GEO Score ring + "How this score is calculated" signal list (top
 * left) / Score Snapshot real day trend (top right) / GEO Score Breakdown
 * table — Signal, Score, Status, Main Problem (bottom left) / Competitor
 * Comparison (bottom right, Pro-gated, same as before).
 */
const GeoScoreSection = () => {
	const { score, isLoading } = useGeoScore();
	const [period, setPeriod] = useState<PeriodDays>('30');
	const [progress, setProgress] = useState<ProgressResponse | null>(null);
	const [isLoadingProgress, setIsLoadingProgress] = useState(true);

	useEffect(() => {
		setIsLoadingProgress(true);
		getApiResponse<ProgressResponse>(
			getApiLink(appLocalizer, `geo/progress?days=${period}`),
			{ headers: { 'X-WP-Nonce': appLocalizer.nonce } }
		)
			.then((response) => response && setProgress(response))
			.finally(() => setIsLoadingProgress(false));
	}, [period]);

	const GeoCompetitorVisibility = useFilterSlot<
		(props: { yourScore?: number | null }) => JSX.Element
	>('vulopilot_geo_competitor_visibility');

	const overall = score?.geo_score ?? 0;

	return (
		<>
			<ColumnComponent grid={6}>
				<CardComponent
					title={__('GEO Score', 'vulopilot')}
					titleIcon='tools'
					desc={sprintf(
						/* translators: %d: real number of published pages/posts every GEO scanner scans. */
						__('Based on %d published pages.', 'vulopilot'),
						score?.pages_checked ?? 0
					)}
					isLoading={isLoading}
				>
					<div className="geo-score-card-layout">
						<div className="geo-score-ring-col">
							<ChartComponent
								type="ring"
								height={140}
								centerLabel={
									<>
										<span className="score-ring-number">{overall}</span>
										<span className="score-ring-label">/100</span>
										<span className={`score-ring-label geo-overall-rating ${ratingClass(overall)}`}>
											{getRating(overall)}
										</span>
									</>
								}
								data={[
									{ label: __('Score', 'vulopilot'), value: overall, color: '#7c3aed' },
									{ label: __('Remaining', 'vulopilot'), value: 100 - overall, color: '#e5e7eb' },
								]}
							/>
						</div>
						<div className="geo-score-calc-col">
							<TypographyComponent variant="title">
								{__('How this score is calculated', 'vulopilot')}
							</TypographyComponent>
							<ListComponent
								className="mini-card without-border report"
								items={SIGNAL_META.map((meta) => ({
									id: meta.key,
									icon: meta.icon,
									title: meta.label,
								}))}
							/>
						</div>
					</div>
				</CardComponent>
			</ColumnComponent>
			<ColumnComponent grid={6} fullHeight>
				<CardComponent
					title={__('Score Snapshot', 'vulopilot')}
					desc={__('Score Snapshot Score Snapshot Score Snapshot', 'vulopilot')}
					titleIcon='tools'
					isLoading={isLoadingProgress}
					action={
						<SelectInput
							type="single-select"
							name="geo-score-progress-period"
							value={period}
							onChange={(value) => setPeriod(value as PeriodDays)}
							options={PERIOD_OPTIONS}
							isClearable={false}
						/>
					}
				>
					{progress && (
						<ChartComponent
							type="area"
							data={progress.trend}
							dataKey="score"
							xKey="date"
							height={220}
							yDomain={[0, 100]}
							color="#7C3AED"
						/>
					)}
				</CardComponent>
			</ColumnComponent>
			<CardComponent
				title={__('GEO Score Breakdown', 'vulopilot')}
				desc={__('See how your site performs across the signals that matter most for AI engines.', 'vulopilot')}
				isLoading={isLoading}
				titleIcon='tools'
			>
				<table className="geo-score-breakdown-table">
					<thead>
						<tr>
							<th>{__('Signal', 'vulopilot')}</th>
							<th>{__('Score', 'vulopilot')}</th>
							<th>{__('Status', 'vulopilot')}</th>
							<th>{__('Main Problem', 'vulopilot')}</th>
						</tr>
					</thead>
					<tbody>
						{SIGNAL_META.map((meta) => {
							const signal = score?.signals[meta.key];
							const rowScore = signal?.score ?? null;

							return (
								<tr key={meta.key}>
									<td>{meta.label}</td>
									<td>{null === rowScore ? __('—', 'vulopilot') : `${rowScore}/100`}</td>
									<td>
										{null !== rowScore && (
											<BadgeComponent color={ratingClass(rowScore)} text={getRating(rowScore)} />
										)}
									</td>
									<td className="geo-score-breakdown-problem">
										{signal ? mainProblemText(meta.key, signal) : __('—', 'vulopilot')}
									</td>
								</tr>
							);
						})}
					</tbody>
				</table>
			</CardComponent>

			{isGeoInsightsActive() && GeoCompetitorVisibility ? (
				<GeoCompetitorVisibility yourScore={score?.geo_score ?? null} />
			) : (
				<CardComponent title={__('Competitor Comparison', 'vulopilot')} desc={__('See how your site performs across the signals that matter most for AI engines.', 'vulopilot')}
				titleIcon='tools'>
					<ProLockedCard moduleName="geo-insights" />
				</CardComponent>
			)}
		</>
	);
};

export default GeoScoreSection;
