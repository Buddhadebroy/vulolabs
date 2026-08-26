/* global appLocalizer */
import { useEffect, useState } from 'react';
import { __ } from '@wordpress/i18n';
import { getApiLink, getApiResponse } from '@zyra/core';
import { AnalyticsComponent, CardComponent, TooltipComponent } from '@zyra/components';
import './Performance.scss';

interface RealtimeStats {
	avg_response_time_ms: number | null;
	page_views_last_5_min: number;
	samples_last_hour: number;
}

interface CoreWebVitalsSummary {
	page_load_ms: number | null;
	transfer_bytes: number | null;
	sample_count: number;
}

/** Below this many real RUM samples, a p75 isn't trustworthy enough to show — same floor PerformanceScoreCard.tsx's own Core Web Vitals ring uses. */
const MIN_SAMPLES = 10;

/** Real byte count → a human string — same MB/KB thresholds SlowPagesTab.tsx's own `formatBytes()` uses, duplicated locally rather than shared (same small-helper-duplication precedent PerformanceActions.php's own `LARGE_IMAGE_THRESHOLD_BYTES` already established in this codebase). */
const formatBytes = (bytes: number): string => {
	if (bytes >= 1024 * 1024) {
		return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	}

	if (bytes >= 1024) {
		return `${(bytes / 1024).toFixed(0)} KB`;
	}

	return `${bytes} B`;
};

/**
 * "Real-time Monitoring" — all 4 sub-metrics are now real.
 *
 * **Server Response Time** and **Page Views (Last 5 Min)** come from
 * `GET /performance-realtime` (`Services\PerformanceRequestLogger` samples
 * real front-end requests server-side, no client JS, no cookies, no IP
 * logging — see that class's own docblock). "Page Views" is honestly
 * relabeled from the mockup's "Active Users", since a real unique-visitor
 * count would require either IP hashing or a cookie-based session id, both
 * ruled out (privacy posture + page-cache compatibility risk).
 *
 * **Page Load Time** and **Bandwidth Usage** come from the same real
 * client-side RUM beacon Core Web Vitals already uses (`GET
 * /core-web-vitals`, `public/js/performance-vitals-beacon.js` reading the
 * browser's own Navigation/Resource Timing APIs) — a real p75
 * `loadEventEnd` and summed `transferSize`, gated behind the same
 * `MIN_SAMPLES` floor the Core Web Vitals ring uses, honestly showing
 * "Collecting data" below that floor rather than a single noisy sample.
 */
const RealTimeMonitoringCard = () => {
	const [stats, setStats] = useState<RealtimeStats | null>(null);
	const [vitals, setVitals] = useState<CoreWebVitalsSummary | null>(null);
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		Promise.all([
			getApiResponse<RealtimeStats>(
				getApiLink(appLocalizer, 'performance-realtime'),
				{ headers: { 'X-WP-Nonce': appLocalizer.nonce } }
			),
			getApiResponse<CoreWebVitalsSummary>(
				getApiLink(appLocalizer, 'core-web-vitals'),
				{ headers: { 'X-WP-Nonce': appLocalizer.nonce } }
			),
		])
			.then(([statsResponse, vitalsResponse]) => {
				if (statsResponse) {
					setStats(statsResponse);
				}
				if (vitalsResponse) {
					setVitals(vitalsResponse);
				}
			})
			.finally(() => setIsLoading(false));
	}, []);

	const hasEnoughSamples = (vitals?.sample_count ?? 0) >= MIN_SAMPLES;
	const pageLoadMs = vitals?.page_load_ms ?? null;
	const transferBytes = vitals?.transfer_bytes ?? null;

	return (
		<CardComponent id="performance-realtime-monitoring-card" title={__('Real-time Monitoring', 'vulopilot')} titleIcon="bar-chart" isLoading={isLoading}>
			{stats && (
				<AnalyticsComponent
					cols={2}
					variant="background-color"
					data={[
						{
							number:
								null !== stats.avg_response_time_ms
									? `${stats.avg_response_time_ms} ms`
									: '—',
							colorClass: 'admin-bg-color2',
							text: __('Server Response Time', 'vulopilot')
						},
						{
							number: stats.page_views_last_5_min,
							colorClass: 'admin-bg-color3',
							text: (
								<TooltipComponent
									text={__(
										'A raw count of real page views in the last 5 minutes — not a unique-visitor count, which this plugin deliberately doesn\'t track (no IP logging, no tracking cookies).',
										'vulopilot'
									)}
								>
									{__('Page Views (Last 5 Min)', 'vulopilot')}
								</TooltipComponent>
							),
						},
						{
							number:
								hasEnoughSamples && null !== pageLoadMs
									? `${(pageLoadMs / 1000).toFixed(1)} s`
									: '—',
							colorClass: 'admin-bg-color4',
							text: (
								<>
									{__('Page Load Time', 'vulopilot')}
									{(!hasEnoughSamples || null === pageLoadMs) && (
										<span className="realtime-monitoring-tile-untracked">
											{hasEnoughSamples
												? __('Not tracked yet', 'vulopilot')
												: __('Collecting data', 'vulopilot')}
										</span>
									)}
								</>
							),
						},
						{
							number:
								hasEnoughSamples && null !== transferBytes
									? formatBytes(transferBytes)
									: '—',
							colorClass: 'admin-bg-color6',
							text: (
								<>
									{__('Bandwidth Usage', 'vulopilot')}
									{(!hasEnoughSamples || null === transferBytes) && (
										<span className="realtime-monitoring-tile-untracked">
											{hasEnoughSamples
												? __('Not tracked yet', 'vulopilot')
												: __('Collecting data', 'vulopilot')}
										</span>
									)}
								</>
							),
						},
					]}
				/>
			)}
		</CardComponent>
	);
};

export default RealTimeMonitoringCard;
