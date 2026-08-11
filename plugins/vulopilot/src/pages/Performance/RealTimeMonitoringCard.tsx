/* global appLocalizer */
import { useEffect, useState } from 'react';
import { __ } from '@wordpress/i18n';
import { getApiLink, getApiResponse } from '@zyra/core';
import { CardComponent, TooltipComponent } from '@zyra/components';
import './ImproveSpeed.scss';

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
		<CardComponent title={__('Real-time Monitoring', 'vulopilot')} isLoading={isLoading}>
			{stats && (
				<div className="realtime-monitoring-grid">
					<div className="realtime-monitoring-tile">
						<div className="realtime-monitoring-tile-label">
							{__('Server Response Time', 'vulopilot')}
						</div>
						<div className="realtime-monitoring-tile-value">
							{null !== stats.avg_response_time_ms
								? `${stats.avg_response_time_ms} ms`
								: '—'}
						</div>
					</div>
					<div className="realtime-monitoring-tile">
						<TooltipComponent
							text={__(
								'A raw count of real page views in the last 5 minutes — not a unique-visitor count, which this plugin deliberately doesn\'t track (no IP logging, no tracking cookies).',
								'vulopilot'
							)}
						>
							<div className="realtime-monitoring-tile-label">
								{__('Page Views (Last 5 Min)', 'vulopilot')}
							</div>
						</TooltipComponent>
						<div className="realtime-monitoring-tile-value">
							{stats.page_views_last_5_min}
						</div>
					</div>
					<div className="realtime-monitoring-tile is-untracked">
						<div className="realtime-monitoring-tile-label">
							{__('Page Load Time', 'vulopilot')}
						</div>
						<div className="realtime-monitoring-tile-value">—</div>
						<span className="realtime-monitoring-tile-untracked">
							{__('Not tracked yet', 'vulopilot')}
						</span>
					</div>
					<div className="realtime-monitoring-tile is-untracked">
						<div className="realtime-monitoring-tile-label">
							{__('Bandwidth Usage', 'vulopilot')}
						</div>
						<div className="realtime-monitoring-tile-value">—</div>
						<span className="realtime-monitoring-tile-untracked">
							{__('Not tracked yet', 'vulopilot')}
						</span>
					</div>
				</div>
			)}
		</CardComponent>
	);
};

export default RealTimeMonitoringCard;
