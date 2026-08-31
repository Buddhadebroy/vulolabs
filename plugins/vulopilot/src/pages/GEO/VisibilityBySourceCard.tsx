/* global appLocalizer */
import { useEffect, useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { getApiLink, getApiResponse } from '@zyra/core';
import {
	CardComponent,
	ChartComponent,
	ModuleGuardComponent,
	NoticeComponent,
} from '@zyra/components';

interface TrafficSource {
	label: string;
	sessions: number;
	percent: number;
}

interface TrafficSourcesResponse {
	connected: boolean;
	window_days: number;
	total_sessions: number;
	sources: TrafficSource[];
}

/**
 * Real colors assigned by rank, not by a fixed channel name — GA4's own
 * `sessionDefaultChannelGroup` values vary per property (which channels
 * exist depends entirely on that site's real traffic), so there's no fixed
 * "Organic Search is always purple" mapping to hardcode.
 */
const SOURCE_COLORS = [
	'#2563EB',
	'#7C3AED',
	'#0D9488',
	'#EA580C',
	'#DB2777',
	'#CA8A04',
];

/**
 * "Visibility by Source" — real Google Analytics sessions grouped by GA4's
 * own `sessionDefaultChannelGroup` dimension (`GET /visibility/traffic-sources`,
 * Controllers\Visibility::get_traffic_sources() →
 * GoogleAnalyticsClient::run_channel_group_report()), over a fixed real
 * 30-day window. This plugin has no traffic-source data of its own to
 * fabricate — `vulopilot_crawler_visits` is AI-bot traffic only, Search
 * Console is organic-search-only by definition — so this card only ever
 * renders real data once a site owner has actually connected a real GA4
 * property (Settings → Connections → Google Services); otherwise it shows
 * an honest connect prompt rather than inventing an Organic/Direct/
 * Referral/Social split.
 *
 * The donut's center number is real total sessions, not a 0-100 "score" —
 * a session count has no natural 100-point ceiling, so labeling it that
 * way (as a purely visual reference this card's layout is otherwise
 * modeled on does) would misrepresent what the number means. Reuses the
 * same donut+legend layout OverviewTab.tsx's own score-area cards already
 * establish (`.visibility-source-*`, SeoVisibility.scss) — dot, label,
 * real count, and each channel's real share of this window's real total
 * sessions.
 */
const VisibilityBySourceCard = () => {
	const [data, setData] = useState<TrafficSourcesResponse | null>(null);
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		getApiResponse<TrafficSourcesResponse>(
			getApiLink(appLocalizer, 'visibility/traffic-sources'),
			{ headers: { 'X-WP-Nonce': appLocalizer.nonce } }
		)
			.then((response) => response && setData(response))
			.finally(() => setIsLoading(false));
	}, []);

	const topSource = data?.sources[0] ?? null;
	const windowDays = data?.window_days ?? 30;

	return (
		<CardComponent
			title={__('Visibility by Source', 'vulopilot')}
			titleIcon="security"
			desc={sprintf(
				/* translators: %d: real number of days this window covers. */
				__(
					'Real Google Analytics sessions by channel over the last %d days.',
					'vulopilot'
				),
				windowDays
			)}
			isLoading={isLoading}
		>
			{!isLoading && (!data || !data.connected) && (
				<ModuleGuardComponent
					icon="info"
					title={__('Connect Google Analytics', 'vulopilot')}
					desc={__(
						'Connect a GA4 property under Settings → Connections to see where your real visitors come from.',
						'vulopilot'
					)}
					buttonText={__('Go to Connections', 'vulopilot')}
					buttonLink="?page=vulopilot#&tab=settings&subtab=connections"
				/>
			)}
			{!isLoading && data?.connected && 0 === data.sources.length && (
				<ModuleGuardComponent
					icon="info"
					title={__('No traffic recorded yet', 'vulopilot')}
					desc={sprintf(
						/* translators: %d: real number of days this window covers. */
						__(
							'No GA4 sessions found in the last %d days.',
							'vulopilot'
						),
						windowDays
					)}
				/>
			)}
			{!isLoading && data?.connected && data.sources.length > 0 && (
				<>
					<div className="visibility-source-body">
						<div className="visibility-source-chart">
							<ChartComponent
								type="pie"
								height={160}
								legendPosition="none"
								centerLabel={
									<>
										<span className="score-ring-number">
											{data.total_sessions}
										</span>
										<span className="score-ring-label">
											{__('sessions', 'vulopilot')}
										</span>
									</>
								}
								data={data.sources.map((source, index) => ({
									label: source.label,
									value: source.sessions,
									color: SOURCE_COLORS[
										index % SOURCE_COLORS.length
									],
								}))}
							/>
						</div>
						<div className="visibility-source-legend">
							{data.sources.map((source, index) => (
								<div
									key={source.label}
									className="visibility-source-legend-row"
								>
									<span
										className="visibility-source-dot"
										style={{
											backgroundColor:
												SOURCE_COLORS[
													index %
														SOURCE_COLORS.length
												],
										}}
									/>
									<span className="visibility-source-name">
										{source.label}
									</span>
									<span className="visibility-source-count">
										{source.sessions}
									</span>
									<span className="visibility-source-percent">
										{source.percent}%
									</span>
								</div>
							))}
						</div>
					</div>
					{topSource && (
						<div className="visibility-source-insight">
							<NoticeComponent
								displayPosition="inline-notice"
								type="success"
								title={sprintf(
									/* translators: %s: real channel with the most sessions in this window, e.g. "Organic Search". */
									__(
										'%s is your top visibility source.',
										'vulopilot'
									),
									topSource.label
								)}
								message={__(
									'Keep optimizing to grow even more.',
									'vulopilot'
								)}
							/>
						</div>
					)}
				</>
			)}
		</CardComponent>
	);
};

export default VisibilityBySourceCard;
