/* global vulopilotAppLocalizer */
import { useEffect, useState } from 'react';
import { __ } from '@wordpress/i18n';
import { getApiLink, getApiResponse } from '@zyra/core';
import { AnalyticsComponent } from '@zyra/components';
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

/** Below this many real RUM samples, a p75 isn't trustworthy enough to show. */
const MIN_SAMPLES = 10;

/** Real byte count → a human string - same MB/KB thresholds SlowPagesTab.tsx's own `formatBytes()` uses, duplicated locally. */
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
 * "Real-time Monitoring": server response time, from `GET /performance-realtime`, and the other
 * live sub-metrics.
 */
const RealTimeMonitoringCard = () => {
	const [stats, setStats] = useState<RealtimeStats | null>(null);
	const [vitals, setVitals] = useState<CoreWebVitalsSummary | null>(null);

	useEffect(() => {
		Promise.all([
			getApiResponse<RealtimeStats>(
				getApiLink(vulopilotAppLocalizer, 'performance-realtime'),
				{ headers: { 'X-WP-Nonce': vulopilotAppLocalizer.nonce } }
			),
			getApiResponse<CoreWebVitalsSummary>(
				getApiLink(vulopilotAppLocalizer, 'core-web-vitals'),
				{ headers: { 'X-WP-Nonce': vulopilotAppLocalizer.nonce } }
			),
		]).then(([statsResponse, vitalsResponse]) => {
			if (statsResponse) {
				setStats(statsResponse);
			}
			if (vitalsResponse) {
				setVitals(vitalsResponse);
			}
		});
	}, []);

	const hasEnoughSamples = (vitals?.sample_count ?? 0) >= MIN_SAMPLES;
	const pageLoadMs = vitals?.page_load_ms ?? null;
	const transferBytes = vitals?.transfer_bytes ?? null;

	return (
		<>
			{stats && (
				<AnalyticsComponent
					cols={3}
					variant="small"
					data={[
						{
							number:
								null !== stats.avg_response_time_ms
									? `${stats.avg_response_time_ms} ms`
									: '-',
							// icon: 'global-community green',
							text: __('Server Response Time', 'vulopilot'),
						},
						{
							number:
								hasEnoughSamples && null !== pageLoadMs
									? `${(pageLoadMs / 1000).toFixed(1)} s`
									: '-',
							// icon: 'global-community blue',
							text: __('Page Load Time', 'vulopilot'),
						},
						{
							number:
								hasEnoughSamples && null !== transferBytes
									? formatBytes(transferBytes)
									: '-',
							// icon: 'global-community red',
							text: __('Bandwidth Usage', 'vulopilot'),
						},
					]}
				/>
			)}
		</>
	);
};

export default RealTimeMonitoringCard;