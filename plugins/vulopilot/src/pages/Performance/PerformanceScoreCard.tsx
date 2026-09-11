/* global appLocalizer */
import { useEffect, useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { getApiLink, getApiResponse, COLOR_PALETTE } from '@zyra/core';
import {
	CardComponent,
	ChartComponent,
	ContainerComponent,
	ColumnComponent,
	ModuleGuardComponent,
} from '@zyra/components';
import { ButtonInput } from '@zyra/inputs';
import './Performance.scss';
import SpeedHistoryCard from './SpeedHistoryCard';

/** Real "Health" tab route (`routes.ts`'s own `tab: 'health'`) — where the "Key Insights" card's own "View Full Insights" button below actually sends someone: the real overview page that already combines the same Security/Performance/GEO/AEO category scores this card's tiles read individually here. */
const HEALTH_OVERVIEW_URL = '?page=vulopilot#&tab=health';

interface DashboardSummary {
	category_scores: { performance: number; security: number };
	psi_speed_scores: {
		mobile: number | null;
		desktop: number | null;
		checked_at: string | null;
	};
}

interface CrawlerAnalyticsResponse {
	current_total: number;
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
 * Real zyra palette hex (`@zyra/core`'s `COLOR_PALETTE`) — the same real
 * colors Performance.scss's own `$vulopilot-rating-*` variables now read
 * too. `ChartComponent`'s own `type="ring"` needs a literal CSS color for
 * its stroke, not a class name, so this reads the shared source rather
 * than inventing a 2nd copy of it.
 */
const RATING_COLOR: Record<Rating['className'], string> = {
	good: COLOR_PALETTE.green,
	'needs-improvement': COLOR_PALETTE.orange,
	poor: COLOR_PALETTE.red,
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
 * 1st-fold row — rebuilt to match a newer reference mockup, 3 real cards:
 *
 * "Overall Performance" reads `psi_speed_scores` from `GET /dashboard`
 * (`classes/RestAPI/Controllers/Dashboard.php`, populated by
 * `Services\PageSpeedInsightsFetcher` only when a real `psi_api_key` is
 * configured in Settings → Scanning → Performance). With a key configured,
 * shows real Mobile/Desktop scores from Google PageSpeed Insights, rated
 * against Lighthouse's own real Good/Needs Improvement/Poor bands, plus a
 * real one-line comparison only when the two scores actually differ by
 * ≥10 points. Without a key, falls back to the single real unified
 * `category_scores.performance` number (no fabricated device split). Also
 * shows a real 3-item checklist (see `checklist` below for exactly what
 * each real check is) — the mockup's own 4th item, "Server is healthy",
 * is deliberately dropped: no uptime-monitoring mechanism exists anywhere
 * in this codebase to back it (confirmed — RealTimeMonitoringCard.tsx's
 * own real metrics are Server Response Time/Page Views/Page Load Time/
 * Bandwidth, none of which is an uptime percentage), so showing it would
 * mean fabricating a number this plugin has no way to actually measure.
 *
 * "Performance Trend" is SpeedHistoryCard.tsx, moved up into this row from
 * its own former standalone spot in OverviewTab.tsx's 2nd fold — same real
 * `GET /performance-score-snapshots` daily trend, unchanged.
 *
 * "Key Insights" is 3 real, already-available-elsewhere numbers rather
 * than a new data source: `category_scores.security` (the same real value
 * already on this same `GET /dashboard` response), the real
 * `GET /crawler-traffic/analytics?days=30` `current_total`
 * (VuloPilotActivityWidget.tsx's own "AI crawler visits" tile reads the
 * identical real endpoint), and a compact real LCP summary from the same
 * `GET /core-web-vitals` read below (full CWV detail now lives in its own
 * CoreWebVitalsCard.tsx, moved down to OverviewTab.tsx's 2nd fold —
 * genuine client-side RUM either way, `public/js/performance-vitals-
 * beacon.js`/`Services\CoreWebVitalsBeacon`).
 */
const PerformanceScoreCard = ({ onViewDetails }: PerformanceScoreCardProps) => {
	const [dashboard, setDashboard] = useState<DashboardSummary | null>(null);
	const [vitals, setVitals] = useState<CoreWebVitalsSummary | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [hasError, setHasError] = useState(false);
	// "Key Insights" card's own 2 extra real reads — same real
	// `category=performance` critical(+high)-priority open-finding count
	// CriticalIssuesCard.tsx's own pattern already uses elsewhere, and the
	// same real `GET /crawler-traffic/analytics` VuloPilotActivityWidget.tsx
	// already reads for its own "AI crawler visits" tile.
	const [criticalCount, setCriticalCount] = useState(0);
	const [crawlerTotal, setCrawlerTotal] = useState(0);

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

		getApiResponse<{ total: number }>(
			getApiLink(appLocalizer, 'findings?category=performance&status=open&priority=high&per_page=1'),
			{ headers: { 'X-WP-Nonce': appLocalizer.nonce } }
		).then((response: { total: number } | undefined) => setCriticalCount(response?.total ?? 0));

		getApiResponse<CrawlerAnalyticsResponse>(
			getApiLink(appLocalizer, 'crawler-traffic/analytics?days=30'),
			{ headers: { 'X-WP-Nonce': appLocalizer.nonce } }
		).then((response: CrawlerAnalyticsResponse | undefined) =>
			setCrawlerTotal(response?.current_total ?? 0)
		);
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

	/**
	 * "Overall Performance" card's own real checklist — 3 real, independent
	 * pass/fail checks, not a decorative always-green list:
	 * - "Fast loading speed": the same real Lighthouse-band rating the
	 *   score ring itself shows (`getScoreRating()`) — the real
	 *   `category_scores.performance` (or, with a PSI key configured, the
	 *   real Mobile score, the more conservative of the two real device
	 *   scores) rated "Good".
	 * - "Good Core Web Vitals": every real vital that has enough real RUM
	 *   samples to rate is rated "Good" — `false` (not silently skipped)
	 *   while still collecting samples, since there's no real vital-quality
	 *   claim to make yet either way.
	 * - "No critical issues": the same real `category=performance`,
	 *   `priority=high` (critical+high) open-finding count
	 *   CriticalIssuesCard.tsx's own pattern already uses elsewhere is 0.
	 */
	const overallScoreForChecklist = hasPsi && psi
		? Math.min(psi.mobile as number, psi.desktop as number)
		: dashboard?.category_scores.performance ?? 0;
	const hasEnoughVitalSamples = (vitals?.sample_count ?? 0) >= MIN_SAMPLES;
	const vitalChecks: (number | null)[] = vitals
		? [vitals.lcp_ms, vitals.inp_ms, vitals.cls]
		: [];
	const checklist = [
		{
			key: 'fast-loading',
			label: __('Fast loading speed', 'vulopilot'),
			pass: 'good' === getScoreRating(overallScoreForChecklist).className,
		},
		{
			key: 'good-cwv',
			label: __('Good Core Web Vitals', 'vulopilot'),
			pass:
				hasEnoughVitalSamples &&
				vitalChecks.every(
					(value, index) =>
						null === value ||
						'good' ===
							getVitalRating(
								value,
								CWV_THRESHOLDS[(['lcp', 'inp', 'cls'] as const)[index]]
							).className
				),
		},
		{
			key: 'no-critical-issues',
			label: __('No critical issues', 'vulopilot'),
			pass: 0 === criticalCount,
		},
	];

	return (
		<ContainerComponent>
			<ColumnComponent grid={4} row fullHeight>
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

							<ul className="performance-overall-checklist">
								{checklist.map((item) => (
									<li key={item.key} className={item.pass ? 'is-good' : 'is-poor'}>
										<i className={`adminfont-${item.pass ? 'check' : 'close'}`} />
										{item.label}
									</li>
								))}
							</ul>

							<ButtonInput
								position="full-width"
								buttons={{
									text: __('View Slow Pages', 'vulopilot'),
									icon: 'eye',
									color: 'border-purple',
									onClick: onViewDetails,
								}}
							/>
						</>
					)}
				</CardComponent>
			</ColumnComponent>
			<ColumnComponent grid={4} row fullHeight>
				<SpeedHistoryCard />
			</ColumnComponent>
			<ColumnComponent grid={4} row fullHeight>
				<CardComponent
					title={__('Key Insights', 'vulopilot')}
					titleIcon="idea"
					desc={__('Important metrics from your site, without duplication.', 'vulopilot')}
					isLoading={isLoading}
					action={
						<ButtonInput
							buttons={{
								text: __('View Full Insights', 'vulopilot'),
								rightIcon: 'arrow-right',
								color: 'text-purple',
								onClick: () => window.open(HEALTH_OVERVIEW_URL, '_self'),
							}}
						/>
					}
				>
					{!isLoading && hasError && (
						<ModuleGuardComponent
							icon="error"
							title={__('Could not load Core Web Vitals', 'vulopilot')}
							desc={__('Please refresh the page to try again.', 'vulopilot')}
						/>
					)}
					{!isLoading && !hasError && vitals && dashboard && (
						<ul className="performance-key-insights">
							<li>
								<i className="adminfont-security performance-key-insight-icon" />
								<div className="performance-key-insight-body">
									<div className="performance-key-insight-label">
										{__('Security score', 'vulopilot')}
									</div>
									<div className="desc">
										{__('From your open security findings', 'vulopilot')}
									</div>
								</div>
								<span className="performance-key-insight-value">
									{sprintf('%d/100', dashboard.category_scores.security)}
								</span>
							</li>
							<li>
								<i className="adminfont-ai performance-key-insight-icon" />
								<div className="performance-key-insight-body">
									<div className="performance-key-insight-label">
										{sprintf(
											/* translators: %d: real number of days the crawler-traffic total below covers. */
											__('AI crawler traffic (%d days)', 'vulopilot'),
											30
										)}
									</div>
									<div className="desc">
										{__('Real bot visits over the last 30 days', 'vulopilot')}
									</div>
								</div>
								<span className="performance-key-insight-value">{crawlerTotal}</span>
							</li>
							<li className="performance-key-insight-cwv">
								<i className="adminfont-analytics performance-key-insight-icon" />
								<div className="performance-key-insight-body">
									<div className="performance-key-insight-label">
										{__('Core Web Vitals', 'vulopilot')}
									</div>
									<div className="desc">
										{__(
											'How fast and smoothly your site feels to real visitors.',
											'vulopilot'
										)}
									</div>
									{vitals.sample_count < MIN_SAMPLES || null === vitals.lcp_ms ? (
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
										<div className="performance-key-insight-cwv-detail">
											<span
												className={`performance-key-insight-cwv-value ${getVitalRating(vitals.lcp_ms, CWV_THRESHOLDS.lcp).className}`}
											>
												{(vitals.lcp_ms / 1000).toFixed(2)}
												{__('sec', 'vulopilot')}
											</span>
											<span
												className={`performance-key-insight-cwv-badge ${getVitalRating(vitals.lcp_ms, CWV_THRESHOLDS.lcp).className}`}
											>
												{getVitalRating(vitals.lcp_ms, CWV_THRESHOLDS.lcp).label}
											</span>
											<div className="desc">
												{sprintf(
													/* translators: 1: real real-visitor sample count, 2: real LCP p75 in ms. */
													__(
														'Based on %1$d real visits, LCP (p75): %2$dms',
														'vulopilot'
													),
													vitals.sample_count,
													vitals.lcp_ms
												)}
											</div>
										</div>
									)}
								</div>
							</li>
						</ul>
					)}
				</CardComponent>
			</ColumnComponent>
		</ContainerComponent>
	);
};

export default PerformanceScoreCard;
