/* global appLocalizer */
import { useEffect, useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { getApiLink, getApiResponse } from '@zyra/core';
import {
	CardComponent,
	ChartComponent,
	ContainerComponent,
	ColumnComponent,
	ModuleGuardComponent,
} from '@zyra/components';
import { ButtonInput } from '@zyra/inputs';
import './Performance.scss';
import RealTimeMonitoringCard from './RealTimeMonitoringCard';
import QuickActionsCard from './QuickActionsCard';

/** `id: 'pagespeed-insights'` (Settings/Connections/PageSpeedInsights.ts) — where the real PageSpeed Insights API key field this card's own "no PSI connected" message used to describe in text actually lives; moved from the old Settings → Scanning → Performance tab, same "moved into Connections" precedent GoogleServices.ts's own docblock documents. */
const PERFORMANCE_SETTINGS_URL = '?page=vulopilot#&tab=settings&subtab=pagespeed-insights';

interface DashboardSummary {
	category_scores: { performance: number };
	psi_speed_scores: {
		mobile: number | null;
		desktop: number | null;
		checked_at: string | null;
	};
}

interface CoreWebVitalsSummary {
	lcp_ms: number | null;
	cls: number | null;
	inp_ms: number | null;
	sample_count: number;
}

interface PerformanceScoreCardProps {
	/** Scrolls to the "Top Issues" FindingsTable further down this Overview tab. */
	onViewDetails: () => void;
}

/** Below this many real RUM samples, a p75 isn't trustworthy enough to show. */
const MIN_SAMPLES = 10;

interface Rating {
	label: string;
	className: 'good' | 'needs-improvement' | 'poor';
}

/** Lighthouse's own real, documented 0-100 performance-score bands. */
const getScoreRating = (score: number): Rating => {
	if (score >= 90) {
		return { label: __('Good', 'vulopilot'), className: 'good' };
	}
	if (score >= 50) {
		return { label: __('Needs Improvement', 'vulopilot'), className: 'needs-improvement' };
	}
	return { label: __('Poor', 'vulopilot'), className: 'poor' };
};

/**
 * The exact same 3 hex values Performance.scss's own `$vulopilot-rating-*`
 * variables already use for this tile's text/badge colors — `ChartComponent`'s
 * own `type="ring"` needs a literal CSS color for its stroke, not a class
 * name, so this mirrors those rather than inventing a 2nd color source.
 */
const RATING_COLOR: Record<Rating['className'], string> = {
	good: '#16a34a',
	'needs-improvement': '#d97706',
	poor: '#dc2626',
};

/** Google's real, public Core Web Vitals thresholds — LCP/INP in ms, CLS unitless. */
const CWV_THRESHOLDS: Record<'lcp' | 'inp' | 'cls', { good: number; needsImprovement: number }> = {
	lcp: { good: 2500, needsImprovement: 4000 },
	inp: { good: 200, needsImprovement: 500 },
	cls: { good: 0.1, needsImprovement: 0.25 },
};

const getVitalRating = (
	value: number,
	thresholds: { good: number; needsImprovement: number }
): Rating => {
	if (value <= thresholds.good) {
		return { label: __('Good', 'vulopilot'), className: 'good' };
	}
	if (value <= thresholds.needsImprovement) {
		return { label: __('Needs Improvement', 'vulopilot'), className: 'needs-improvement' };
	}
	return { label: __('Poor', 'vulopilot'), className: 'poor' };
};

interface VitalRowProps {
	label: string;
	displayValue: string;
	value: number;
	thresholds: { good: number; needsImprovement: number };
	goodCaption: string;
}

const VitalRow = ({ label, displayValue, value, thresholds, goodCaption }: VitalRowProps) => {
	const rating = getVitalRating(value, thresholds);
	// Fill width scaled against 1.3x the "needs improvement" ceiling, capped
	// at 100% — a real proportional read of where this value sits, not a
	// literal percentile-of-all-sites (no such dataset exists here).
	const fillPercent = Math.min(100, (value / (thresholds.needsImprovement * 1.3)) * 100);

	return (
		<div className="core-web-vital-row">
			<div className="core-web-vital-row-label">{label}</div>
			<div className={`core-web-vital-row-value ${rating.className}`}>{displayValue}</div>
			<div className={`core-web-vital-row-rating ${rating.className}`}>
				<span className="core-web-vital-row-dot" />
				{rating.label}
			</div>
			<div className="core-web-vital-bar">
				<div className={`core-web-vital-bar-fill ${rating.className}`} style={{ width: `${fillPercent}%` }} />
			</div>
			<div className="core-web-vital-row-caption">{goodCaption}</div>
		</div>
	);
};

interface ScoreTileProps {
	label: string;
	score: number;
	/** `speed-score-tile-single` when there's no PSI key configured (one real unified score, not a device split) — see the "Overall Speed Score" fallback below. */
	single?: boolean;
}

/**
 * One score-ring tile — Mobile/Desktop (real PSI key configured) or Overall
 * (no PSI key, the single real unified `category_scores.performance`
 * number). Extracted from 3 near-identical copies of the same
 * ring+label+rating markup, one per case, that only ever differed in which
 * real score they read.
 */
const ScoreTile = ({ label, score, single = false }: ScoreTileProps) => {
	const rating = getScoreRating(score);

	return (
		<div className={`speed-score-tile${single ? ' speed-score-tile-single' : ''}`}>
			<div className="speed-score-tile-label">{label}</div>
			<ChartComponent
				type="ring"
				height={90}
				color={RATING_COLOR[rating.className]}
				data={[{ value: score }]}
				centerLabel={
					<>
						<span className={`speed-score-tile-value ${rating.className}`}>
							{score}
						</span>
						<span className="speed-score-tile-max">/100</span>
					</>
				}
			/>
			<span className={`speed-score-tile-rating ${rating.className}`}>
				<span className="speed-score-tile-dot" />
				{rating.label}
			</span>
		</div>
	);
};

/**
 * "Performance Score" — now two real cards:
 *
 * "Overall Speed Score" reads `psi_speed_scores` from `GET /dashboard`
 * (`classes/RestAPI/Controllers/Dashboard.php`, populated by
 * `Services\PageSpeedInsightsFetcher` only when a real `psi_api_key` is
 * configured in Settings → Scanning → Performance). With a key configured,
 * shows real Mobile/Desktop scores from Google PageSpeed Insights, rated
 * against Lighthouse's own real Good/Needs Improvement/Poor bands, plus a
 * real one-line comparison only when the two scores actually differ by
 * ≥10 points. Without a key, falls back to the single real unified
 * `category_scores.performance` number (no fabricated device split).
 *
 * "Core Web Vitals" reads `GET /core-web-vitals`
 * (`classes/RestAPI/Controllers/CoreWebVitals.php`), a real p75 of LCP/INP/
 * CLS collected from actual visitors by `public/js/performance-vitals-
 * beacon.js` (Services\CoreWebVitalsBeacon) — genuine client-side RUM, no
 * external API. FCP is deliberately dropped: INP replaced FID as Google's
 * third official Core Web Vital in March 2024, so LCP/INP/CLS is the
 * current real set. Below `MIN_SAMPLES` real samples, shows an honest
 * "still collecting" state instead of a p75 computed from too few points.
 */
const PerformanceScoreCard = ({ onViewDetails }: PerformanceScoreCardProps) => {
	const [dashboard, setDashboard] = useState<DashboardSummary | null>(null);
	const [vitals, setVitals] = useState<CoreWebVitalsSummary | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [hasError, setHasError] = useState(false);

	/**
	 * Real objects only — `getApiResponse` (zyra) hands back whatever axios
	 * parsed `response.data` into, and axios silently falls back to a raw
	 * string rather than throwing when the body isn't valid JSON (e.g. a
	 * stray PHP notice/warning printed ahead of the real JSON on some
	 * hosts/PHP configs, only ever seen on a fresh install this dev
	 * environment's already-populated options never triggered). A truthy
	 * non-object response used to pass the old `dashboardResponse &&` check
	 * unchanged, then crash further down reading `.category_scores.performance`
	 * off a string — this validates the actual shape before it's ever
	 * stored, so a malformed response becomes an honest error state instead
	 * of a render-time crash with no error boundary.
	 */
	const isPlainObject = (value: unknown): value is Record<string, unknown> =>
		null !== value && 'object' === typeof value && !Array.isArray(value);

	useEffect(() => {
		setIsLoading(true);
		setHasError(false);

		Promise.all([
			getApiResponse<DashboardSummary>(getApiLink(appLocalizer, 'dashboard'), {
				headers: { 'X-WP-Nonce': appLocalizer.nonce },
			}),
			getApiResponse<CoreWebVitalsSummary>(getApiLink(appLocalizer, 'core-web-vitals'), {
				headers: { 'X-WP-Nonce': appLocalizer.nonce },
			}),
		])
			.then(([dashboardResponse, vitalsResponse]) => {
				const dashboardValid =
					isPlainObject(dashboardResponse) &&
					isPlainObject(dashboardResponse.category_scores);
				const vitalsValid = isPlainObject(vitalsResponse);

				if (!dashboardValid || !vitalsValid) {
					setHasError(true);
					return;
				}

				setDashboard(dashboardResponse);
				setVitals(vitalsResponse);
			})
			.catch(() => setHasError(true))
			.finally(() => setIsLoading(false));
	}, []);

	const psi = dashboard?.psi_speed_scores ?? null;
	const hasPsi =
		null !== psi &&
		'number' === typeof psi.mobile &&
		'number' === typeof psi.desktop;

	const comparisonMessage = (): string | null => {
		if (
			!hasPsi ||
			'number' !== typeof psi?.mobile ||
			'number' !== typeof psi?.desktop
		) {
			return null;
		}

		const gap = psi.desktop - psi.mobile;

		if (gap >= 10) {
			return sprintf(
				/* translators: %d is how many points lower the mobile score is than desktop. */
				__(
					'Your mobile site is %d points slower than desktop. Focus on improving mobile performance for a better experience.',
					'vulopilot'
				),
				gap
			);
		}

		if (gap <= -10) {
			return sprintf(
				/* translators: %d is how many points lower the desktop score is than mobile. */
				__('Your desktop site is %d points slower than mobile.', 'vulopilot'),
				Math.abs(gap)
			);
		}

		return __('Mobile and desktop performance are similar.', 'vulopilot');
	};

	return (
		<>
			<ColumnComponent row fullHeight>
				<CardComponent>
					{!isLoading && hasError && (
						<ModuleGuardComponent
							icon="error"
							title={__('Could not load your speed score', 'vulopilot')}
							desc={__('Please refresh the page to try again.', 'vulopilot')}
						/>
					)}
					{!isLoading && !hasError && dashboard && (
						<>
							<div className="speed-score-tiles">
								{hasPsi && psi ? (
									<>
										<ScoreTile label={__('Mobile', 'vulopilot')} score={psi.mobile as number} />
										<ScoreTile label={__('Desktop', 'vulopilot')} score={psi.desktop as number} />
									</>
								) : (
									<ScoreTile
										label={__('Overall', 'vulopilot')}
										score={dashboard.category_scores.performance}
										single
									/>
								)}
							</div>

							<div className="desc">
								{hasPsi
									? comparisonMessage()
									: __(
											'Connect Google PageSpeed Insights for a real Mobile/Desktop breakdown.',
											'vulopilot'
										)}
							</div>

							<ButtonInput
								position="full-width"
								buttons={{
									text: __('View Slow Pages', 'vulopilot'),
									onClick: onViewDetails,
								}}
							/>
						</>
					)}
				</CardComponent>
				<CardComponent id="performance-core-web-vitals-card" title={__('Core Web Vitals', 'vulopilot')} titleIcon="analytics" isLoading={isLoading}>
					{!isLoading && hasError && (
						<ModuleGuardComponent
							icon="error"
							title={__('Could not load Core Web Vitals', 'vulopilot')}
							desc={__('Please refresh the page to try again.', 'vulopilot')}
						/>
					)}
					{!isLoading && !hasError && vitals && (
						<>
							{vitals.sample_count < MIN_SAMPLES ? (
								<div className="desc">
									{sprintf(
										/* translators: 1: real samples collected so far, 2: how many are needed. */
										__(
											'Still collecting real visitor data — %1$d of %2$d samples so far.',
											'vulopilot'
										),
										vitals.sample_count,
										MIN_SAMPLES
									)}
								</div>
							) : (
								<>
									{'number' === typeof vitals.lcp_ms && (
										<VitalRow
											label={__('Largest Contentful Paint (LCP)', 'vulopilot')}
											displayValue={`${(vitals.lcp_ms / 1000).toFixed(1)}s`}
											value={vitals.lcp_ms}
											thresholds={CWV_THRESHOLDS.lcp}
											goodCaption={__('Good: ≤ 2.5s', 'vulopilot')}
										/>
									)}
									{'number' === typeof vitals.inp_ms && (
										<VitalRow
											label={__('Interaction to Next Paint (INP)', 'vulopilot')}
											displayValue={`${vitals.inp_ms}ms`}
											value={vitals.inp_ms}
											thresholds={CWV_THRESHOLDS.inp}
											goodCaption={__('Good: ≤ 200ms', 'vulopilot')}
										/>
									)}
									{'number' === typeof vitals.cls && (
										<VitalRow
											label={__('Cumulative Layout Shift (CLS)', 'vulopilot')}
											displayValue={vitals.cls.toFixed(2)}
											value={vitals.cls}
											thresholds={CWV_THRESHOLDS.cls}
											goodCaption={__('Good: ≤ 0.1', 'vulopilot')}
										/>
									)}
								</>
							)}
							<ButtonInput
								buttons={{
									text: `${__('About Core Web Vitals', 'vulopilot')} ↗`,
									color: 'border-purple',
									onClick: () =>
										window.open(
											'https://web.dev/articles/vitals',
											'_blank',
											'noopener,noreferrer'
										),
								}}
							/>
						</>
					)}
				</CardComponent>
				<RealTimeMonitoringCard />
				<QuickActionsCard />
			</ColumnComponent>
		</>
	);
};

export default PerformanceScoreCard;
