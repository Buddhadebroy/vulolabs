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

/**
 * "Real-time Monitoring" — 2 of the mockup's 4 sub-metrics are now real,
 * from `GET /performance-realtime` (`Services\PerformanceRequestLogger`
 * samples real front-end requests server-side, no client JS, no cookies,
 * no IP logging — see that class's own docblock): **Server Response
 * Time** (real average over the last hour) and **Page Views (Last 5
 * Min)** — honestly relabeled from the mockup's "Active Users", since a
 * real unique-visitor count would require either IP hashing or a
 * cookie-based session id, both ruled out (privacy posture + page-cache
 * compatibility risk). **Page Load Time** (full browser paint time) and
 * **Bandwidth Usage** (full-site response bytes) stay "Not tracked yet" —
 * both genuinely require either client-side RUM JavaScript or intrusive
 * output-buffering on every response, neither of which exists here. Same
 * "2 real + 2 honest placeholder" shape ContentStatsCard.tsx's own Content
 * Stats redesign already established.
 */
const RealTimeMonitoringCard = () => {
	const [stats, setStats] = useState<RealtimeStats | null>(null);
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		getApiResponse<RealtimeStats>(
			getApiLink(appLocalizer, 'performance-realtime'),
			{ headers: { 'X-WP-Nonce': appLocalizer.nonce } }
		)
			.then((response) => {
				if (response) {
					setStats(response);
				}
			})
			.finally(() => setIsLoading(false));
	}, []);

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
							number: '—',
							colorClass: 'admin-bg-color4',
							text: (
								<>
									{__('Page Load Time', 'vulopilot')}
									<span className="realtime-monitoring-tile-untracked">
										{__('Not tracked yet', 'vulopilot')}
									</span>
								</>
							),
						},
						{
							number: '—',
							colorClass: 'admin-bg-color6',
							text: (
								<>
									{__('Bandwidth Usage', 'vulopilot')}
									<span className="realtime-monitoring-tile-untracked">
										{__('Not tracked yet', 'vulopilot')}
									</span>
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
