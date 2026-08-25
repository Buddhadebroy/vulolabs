/* global appLocalizer */
import React, { useEffect, useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { getApiLink, getApiResponse } from '@zyra/core';
import {
	CardComponent,
	ListComponent,
	ModuleGuardComponent,
	TypographyComponent
} from '@zyra/components';

interface DashboardSummary {
	category_scores: {
		security: number | null;
		woocommerce: number | null;
	};
}

interface CoreWebVitalsSummary {
	lcp_ms: number | null;
	cls: number | null;
	inp_ms: number | null;
	sample_count: number;
}

interface CrawlerSummary {
	daily_volume: { date: string; total: number }[];
	bot_last_seen: { bot_name: string; last_seen_at: string }[];
}

/**
 * "Live Site Insights" card — moved here from AI Copilot Chat's
 * ChatTab.tsx (pages/AIAssistant/) per direct instruction, onto Protect
 * My Site's own Performance tab (PerformanceTab.tsx, this folder), where
 * a live snapshot of security/crawler/vitals signals fits its actual
 * subject better than the AI chat surface it used to sit under. No
 * behavior changed in the move — same 3 real endpoints below, same
 * component, same props (none).
 *
 * Previously always showed a static "not connected yet" state regardless
 * of what real data actually existed. Two of the four metrics that empty
 * state promised are, in fact, already real and wired elsewhere in this
 * plugin: real-visitor Core Web Vitals (`GET /core-web-vitals`, the same
 * data Performance/PerformanceScoreCard.tsx shows) and AI crawler traffic
 * (`GET /crawler-traffic/summary`, the same data CrawlerTraffic.tsx
 * shows) — this card just never called either endpoint. Security reuses
 * the real, already-computed `category_scores.security` from `GET
 * /dashboard` (the same score every other security surface in this
 * plugin reads). Store metrics has no real backing data source anywhere
 * in this codebase (no orders/revenue pipeline exists) — that row is
 * shown only when WooCommerce is actually active (`category_scores.woocommerce`
 * is non-null), with an honest "not available yet" rather than a
 * fabricated number, and omitted entirely otherwise.
 */
const LiveSiteInsightsCard: React.FC = () => {
	const [dashboard, setDashboard] = useState<DashboardSummary | null>(null);
	const [vitals, setVitals] = useState<CoreWebVitalsSummary | null>(null);
	const [crawler, setCrawler] = useState<CrawlerSummary | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [hasError, setHasError] = useState(false);

	useEffect(() => {
		setIsLoading(true);
		setHasError(false);

		const headers = { 'X-WP-Nonce': appLocalizer.nonce };

		Promise.all([
			getApiResponse<DashboardSummary>(
				getApiLink(appLocalizer, 'dashboard'),
				{ headers }
			),
			getApiResponse<CoreWebVitalsSummary>(
				getApiLink(appLocalizer, 'core-web-vitals'),
				{ headers }
			),
			getApiResponse<CrawlerSummary>(
				getApiLink(appLocalizer, 'crawler-traffic/summary?days=30'),
				{ headers }
			),
		])
			.then(([dashboardResponse, vitalsResponse, crawlerResponse]) => {
				if (!dashboardResponse || !vitalsResponse || !crawlerResponse) {
					setHasError(true);
					return;
				}

				setDashboard(dashboardResponse);
				setVitals(vitalsResponse);
				setCrawler(crawlerResponse);
			})
			.catch(() => setHasError(true))
			.finally(() => setIsLoading(false));
	}, []);

	if (hasError) {
		return (
			<CardComponent
				title={__('Live Site Insights', 'vulopilot')}
				titleIcon="analytics"
			>
				<ModuleGuardComponent
					icon="error"
					title={__('Could not load live insights', 'vulopilot')}
					desc={__(
						'Please refresh the page to try again.',
						'vulopilot'
					)}
				/>
			</CardComponent>
		);
	}

	const crawlerVisits30d = (crawler?.daily_volume ?? []).reduce(
		(sum, day) => sum + day.total,
		0
	);
	const distinctBots = crawler?.bot_last_seen?.length ?? 0;
	const showStoreMetrics =
		null !== (dashboard?.category_scores?.woocommerce ?? null);

	return (
		<CardComponent
			title={__('Live Site Insights', 'vulopilot')}
			titleIcon="analytics"
		>
			<ListComponent
				loading={isLoading}
				skeletonCount={showStoreMetrics ? 4 : 3}
				className="mini-card report list"
				items={[
					{
						id: 'security-score',
						icon: 'security green',
						title: __('Security score', 'vulopilot'),
						tags: (
							<>
								
								<TypographyComponent variant="h4">
									{sprintf(
									/* translators: %d: real 0-100 security score computed from open security findings */
									__('%d/100', 'vulopilot'),
									dashboard?.category_scores?.security ?? 0
								)}
								</TypographyComponent>
							</>
						),
						desc: __('From your open security findings', 'vulopilot'),
					},
					{
						id: 'ai-crawler-traffic',
						icon: 'search-discovery',
						title: __('AI crawler traffic (30 days)', 'vulopilot'),
						tags: (
							<TypographyComponent variant="h4">
								{crawlerVisits30d}
							</TypographyComponent>
						),
						desc:
							crawlerVisits30d > 0
								? sprintf(
									/* translators: %d: number of distinct AI crawler bots that have visited */
									__('Across %d bot(s)', 'vulopilot'),
									distinctBots
								)
								: __('No AI crawlers have visited yet', 'vulopilot'),
					},
					{
						id: 'core-web-vitals',
						icon: 'bar-chart',
						title: __('Core Web Vitals', 'vulopilot'),
						tags: (
							<TypographyComponent variant="h4">
								{vitals && vitals.sample_count > 0 && null !== vitals.lcp_ms
									? sprintf(
										/* translators: %d: real p75 Largest Contentful Paint, in milliseconds, from actual visitors */
										__('%dms LCP (p75)', 'vulopilot'),
										vitals.lcp_ms
									)
									: __('Collecting data', 'vulopilot')}
							</TypographyComponent>
						),
						desc:
							vitals && vitals.sample_count > 0
								? sprintf(
									/* translators: %d: real number of visitor samples this p75 was computed from */
									__('From %d real visits', 'vulopilot'),
									vitals.sample_count
								)
								: __(
									'Visit your live site to start collecting real data',
									'vulopilot'
								),
					},
					...(showStoreMetrics
						? [
							{
								id: 'store-metrics',
								icon: 'woocommerce',
								title: __('Store metrics', 'vulopilot'),
								tags: (
									<TypographyComponent variant="desc" color="red">
										{__('Not available yet', 'vulopilot')}
									</TypographyComponent>
								),
								desc: __(
									"Orders, revenue, and conversion data aren't connected in this version.",
									'vulopilot'
								),
							},
						]
						: []),
				]}
			/>
		</CardComponent>
	);
};

export default LiveSiteInsightsCard;
