/* global appLocalizer */
import { useEffect, useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { CardComponent } from '@zyra/components';
import { getApiLink, getApiResponse } from '@zyra/core';
import { useSectionStatus } from '../../services/useSectionStatus';
import './ImproveSpeed.scss';

interface MetricTile {
	id: string;
	icon: string;
	title: string;
	desc: string;
}

const METRIC_TILES: MetricTile[] = [
	{
		id: 'core-web-vitals',
		icon: 'analytics',
		title: __('Core Web Vitals', 'vulopilot'),
		desc: __('LCP, INP, CLS, and FCP — see the Performance Score card above.', 'vulopilot'),
	},
	{
		id: 'caching',
		icon: 'refresh-bold',
		title: __('Caching', 'vulopilot'),
		desc: __('Page caching effectiveness.', 'vulopilot'),
	},
	{
		id: 'css-optimization',
		icon: 'coding',
		title: __('CSS Optimization', 'vulopilot'),
		desc: __('Unused or render-blocking CSS.', 'vulopilot'),
	},
	{
		id: 'javascript',
		icon: 'shortcode',
		title: __('JavaScript', 'vulopilot'),
		desc: __('Unused or blocking JavaScript.', 'vulopilot'),
	},
	{
		id: 'images',
		icon: 'image',
		title: __('Images', 'vulopilot'),
		desc: __('Oversized or unoptimized images.', 'vulopilot'),
	},
	{
		id: 'fonts',
		icon: 'text-fields',
		title: __('Fonts', 'vulopilot'),
		desc: __('Web font loading performance.', 'vulopilot'),
	},
	{
		id: 'database-cleanup',
		icon: 'database',
		title: __('Database Cleanup', 'vulopilot'),
		desc: __('Post revisions, transients, and other bloat.', 'vulopilot'),
	},
	{
		id: 'lazy-loading',
		icon: 'eye',
		title: __('Lazy Loading', 'vulopilot'),
		desc: __('Deferred loading for below-the-fold content.', 'vulopilot'),
	},
	{
		id: 'cdn',
		icon: 'global-community',
		title: __('CDN', 'vulopilot'),
		desc: __('Content delivery network coverage.', 'vulopilot'),
	},
	{
		id: 'performance-monitor',
		icon: 'analytics',
		title: __('Performance Monitor', 'vulopilot'),
		desc: __('Ongoing real-time performance tracking.', 'vulopilot'),
	},
];

const NOT_TRACKED_BADGE = { text: __('Not tracked yet', 'vulopilot'), color: 'indigo' };
const OPEN_FALLBACK_BADGE = { text: __('No open findings', 'vulopilot'), color: 'green' };

interface RealtimeStats {
	samples_last_hour: number;
}

interface CoreWebVitalsSummary {
	sample_count: number;
}

const MIN_CWV_SAMPLES = 10;

/**
 * The mockup's 10-tile metrics grid. 8 of 10 tiles now map to a real
 * category-'performance' scanner via `useSectionStatus()` (the same real
 * "No open findings"/"N Open" badge `TechnicalVisibilityCard.tsx` already
 * produces): Caching (`cache-detection`), Images (`large-images`), CSS
 * Optimization (`css-optimization`), JavaScript (`javascript-optimization`),
 * Fonts (`fonts`), Lazy Loading (`lazy-loading`), CDN (`cdn`), Database
 * Cleanup (`database-cleanup`) — see each scanner's own file in
 * `classes/Scanners/Basic/`. "Performance Monitor" is real too, but isn't
 * scanner-backed — it reads `GET /performance-realtime` (populated by
 * `Services\PerformanceRequestLogger`) and shows "Active" once any request
 * has been logged in the last hour. "Core Web Vitals" is real too — it
 * reads the same `GET /core-web-vitals` real-visitor RUM summary
 * PerformanceScoreCard's own Core Web Vitals card reads, showing "Tracking"
 * once past that card's own `MIN_SAMPLES` floor, or a real "Collecting
 * data (N/10)" count below it — never a static "Not tracked yet" now that
 * a real collection pipeline exists (Services\CoreWebVitalsBeacon).
 */
const MetricsGrid = () => {
	const caching = useSectionStatus('performance', ['cache-detection']);
	const images = useSectionStatus('performance', ['large-images']);
	const cssOptimization = useSectionStatus('performance', ['css-optimization']);
	const javascript = useSectionStatus('performance', ['javascript-optimization']);
	const fonts = useSectionStatus('performance', ['fonts']);
	const lazyLoading = useSectionStatus('performance', ['lazy-loading']);
	const cdn = useSectionStatus('performance', ['cdn']);
	const databaseCleanup = useSectionStatus('performance', ['database-cleanup']);

	const [realtimeStats, setRealtimeStats] = useState<RealtimeStats | null>(null);
	const [vitalsSummary, setVitalsSummary] = useState<CoreWebVitalsSummary | null>(null);

	useEffect(() => {
		getApiResponse<RealtimeStats>(
			getApiLink(appLocalizer, 'performance-realtime'),
			{ headers: { 'X-WP-Nonce': appLocalizer.nonce } }
		).then((response) => {
			if (response) {
				setRealtimeStats(response);
			}
		});

		getApiResponse<CoreWebVitalsSummary>(
			getApiLink(appLocalizer, 'core-web-vitals'),
			{ headers: { 'X-WP-Nonce': appLocalizer.nonce } }
		).then((response) => {
			if (response) {
				setVitalsSummary(response);
			}
		});
	}, []);

	const SECTION_STATUS_BY_TILE: Record<string, ReturnType<typeof useSectionStatus>> = {
		caching,
		images,
		'css-optimization': cssOptimization,
		javascript,
		fonts,
		'lazy-loading': lazyLoading,
		cdn,
		'database-cleanup': databaseCleanup,
	};

	const badgeFor = (id: string) => {
		if (id === 'core-web-vitals') {
			if (!vitalsSummary) {
				return NOT_TRACKED_BADGE;
			}

			return vitalsSummary.sample_count >= MIN_CWV_SAMPLES
				? { text: __('Tracking', 'vulopilot'), color: 'green' }
				: {
						text: sprintf(
							/* translators: %d is how many real visitor samples have been collected so far. */
							__('Collecting data (%d)', 'vulopilot'),
							vitalsSummary.sample_count
						),
						color: 'indigo',
					};
		}

		if (id === 'performance-monitor') {
			return realtimeStats && realtimeStats.samples_last_hour > 0
				? { text: __('Active', 'vulopilot'), color: 'green' }
				: { text: __('Not collecting data yet', 'vulopilot'), color: 'indigo' };
		}

		return SECTION_STATUS_BY_TILE[id]?.badge ?? OPEN_FALLBACK_BADGE;
	};

	return (
		<div className="performance-metrics-grid">
			{METRIC_TILES.map((tile) => {
				const badge = badgeFor(tile.id);
				return (
					<CardComponent key={tile.id} className="performance-metric-tile">
						<i className={`performance-metric-icon adminfont-${tile.icon}`} />
						<div className="performance-metric-title">{tile.title}</div>
						<span className={`admin-badge ${badge.color}`}>{badge.text}</span>
						<div className="desc">{tile.desc}</div>
					</CardComponent>
				);
			})}
		</div>
	);
};

export default MetricsGrid;
