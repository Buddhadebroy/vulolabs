/* global appLocalizer */
import { useEffect, useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { getApiLink, getApiResponse, COLOR_PALETTE } from '@zyra/core';
import { CardComponent, ChartComponent, ModuleGuardComponent, TypographyComponent } from '@zyra/components';
import { ButtonInput } from '@zyra/inputs';
import './Performance.scss';

interface CoreWebVitalsSummary {
	lcp_ms: number | null;
	cls: number | null;
	inp_ms: number | null;
	sample_count: number;
}

/** Below this many real RUM samples, a p75 isn't trustworthy enough to show. */
const MIN_SAMPLES = 10;

interface Rating {
	label: string;
	className: 'good' | 'needs-improvement' | 'poor';
}

/** Real zyra palette hex (`@zyra/core`'s `COLOR_PALETTE`) — same real colors Performance.scss's own `$vulopilot-rating-*` variables read too. `ChartComponent`'s own `type="ring"` needs a literal CSS color for its stroke, not a class name. */
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

interface VitalRowProps {
	label: string;
	displayValue: string;
	value: number;
	thresholds: { good: number; needsImprovement: number };
	goodCaption: string;
}

/** Same small "status row" ring gauge zyra's own ChartComponent Storybook `RingRow` story establishes — independent per-metric rings, custom per-item color, no shared axis. */
const VitalRow = ({ label, displayValue, value, thresholds, goodCaption }: VitalRowProps) => {
	const rating = getVitalRating(value, thresholds);
	// How far this value sits toward 1.3x the "needs improvement" ceiling,
	// capped at 100 — a real proportional read of where this value sits,
	// not a literal percentile-of-all-sites (no such dataset exists here).
	const fillPercent = Math.min(100, (value / (thresholds.needsImprovement * 1.3)) * 100);

	return (
		<div className="core-web-vital-row">
			<ChartComponent
				type="ring"
				height={90}
				color={RATING_COLOR[rating.className]}
				data={[{ value: fillPercent }]}
				centerLabel={
					<span className={`core-web-vital-row-value ${rating.className}`}>
						{displayValue}
					</span>
				}
			/>
			<TypographyComponent variant="body-sm" className="core-web-vital-row-label">
				{label}
			</TypographyComponent>
			<TypographyComponent
				variant="body-sm"
				weight="semibold"
				className={`core-web-vital-row-rating ${rating.className}`}
			>
				<span className="core-web-vital-row-dot" />
				{rating.label}
			</TypographyComponent>
			<TypographyComponent variant="desc" className="core-web-vital-row-caption">
				{goodCaption}
			</TypographyComponent>
		</div>
	);
};

/**
 * "Core Web Vitals" — extracted out of PerformanceScoreCard.tsx's own
 * former 1st-fold row (moved down here per direct instruction, so that
 * row's own 3rd slot could become the new, compact "Key Insights" card
 * instead) into its own self-contained card with its own real
 * `GET /core-web-vitals` fetch — same "each card fetches its own slice"
 * precedent RealTimeMonitoringCard.tsx already established for this exact
 * same real endpoint (a genuine p75 of LCP/INP/CLS collected from actual
 * visitors by `public/js/performance-vitals-beacon.js`
 * (Services\CoreWebVitalsBeacon), not a 2nd, different data source).
 */
const CoreWebVitalsCard = () => {
	const [vitals, setVitals] = useState<CoreWebVitalsSummary | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [hasError, setHasError] = useState(false);

	useEffect(() => {
		getApiResponse<CoreWebVitalsSummary>(getApiLink(appLocalizer, 'core-web-vitals'), {
			headers: { 'X-WP-Nonce': appLocalizer.nonce },
		})
			.then((response: CoreWebVitalsSummary | undefined) => {
				if (response) {
					setVitals(response);
				} else {
					setHasError(true);
				}
			})
			.catch(() => setHasError(true))
			.finally(() => setIsLoading(false));
	}, []);

	return (
		<CardComponent
			id="performance-core-web-vitals-card"
			title={__('Core Web Vitals', 'vulopilot')}
			titleIcon="analytics"
			desc={__('Real Google Core Web Vitals for this site.', 'vulopilot')}
			isLoading={isLoading}
		>
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
						<div className="core-web-vitals-ring-row">
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
						</div>
					)}
					<ButtonInput
						position='full-width'
						buttons={{
							text: `${__('About Core Web Vitals', 'vulopilot')}`,
							rightIcon: 'external',
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
	);
};

export default CoreWebVitalsCard;
