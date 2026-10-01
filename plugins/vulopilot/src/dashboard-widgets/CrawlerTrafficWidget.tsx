/* global vulopilotAppLocalizer */
import React, { useEffect, useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { getApiLink, getApiResponse } from '@zyra/core';
import { BadgeComponent, ListComponent } from '@zyra/components';
import DashboardWidget from './DashboardWidget';
import { formatWpDate } from '../services/formatWpDate';
import { WidgetProps } from './types';

const DAY_MS = 86400000;

/** Fabricated example rows shown only while there are zero real crawler visits. */
const DUMMY_TOTAL_VISITS = 128;
const buildDummyBots = (): BotLastSeen[] => [
	{ bot_name: 'GPTBot', last_seen_at: new Date(Date.now() - DAY_MS).toISOString() },
	{ bot_name: 'ClaudeBot', last_seen_at: new Date(Date.now() - 2 * DAY_MS).toISOString() },
	{ bot_name: 'PerplexityBot', last_seen_at: new Date(Date.now() - 4 * DAY_MS).toISOString() },
];

interface BotLastSeen {
	bot_name: string;
	last_seen_at: string;
}

interface CrawlerSummaryResponse {
	bot_last_seen: BotLastSeen[];
	most_crawled_pages: { requested_url: string; total: number }[];
	daily_volume: { date: string; total: number }[];
}

/**
 * A Dashboard-level teaser for the Crawler Traffic page.
 */
const CrawlerTrafficWidget: React.FC<WidgetProps> = ({
	onHide,
	isCustomizing,
}) => {
	const [summary, setSummary] = useState<CrawlerSummaryResponse | null>(
		null
	);
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		getApiResponse<CrawlerSummaryResponse>(
			getApiLink(vulopilotAppLocalizer, 'crawler-traffic/summary'),
			{ headers: { 'X-WP-Nonce': vulopilotAppLocalizer.nonce } }
		)
			.then((response) => {
				if (response) {
					setSummary(response);
				}
			})
			.finally(() => setIsLoading(false));
	}, []);

	const realVisits =
		summary?.daily_volume?.reduce((sum, day) => sum + day.total, 0) ?? 0;
	const realBots = (summary?.bot_last_seen ?? []).slice(0, 3);
	const isDummy = !isLoading && realBots.length === 0;
	const totalVisits = isDummy ? DUMMY_TOTAL_VISITS : realVisits;
	const topBots = isDummy ? buildDummyBots() : realBots;

	return (
		<DashboardWidget
			title={
				<>
					{__('AI crawler traffic', 'vulopilot')}
					<BadgeComponent
						color="purple"
						text={sprintf(
							/* translators: %d: AI crawler visit count. */
							__('%d visits', 'vulopilot'),
							totalVisits
						)}
					/>
				</>
			}
			desc={__('Visits from GPTBot, ClaudeBot, PerplexityBot, and other AI crawlers.', 'vulopilot')}
			icon="global-community"
			isLoading={isLoading}
			onHide={onHide}
			isCustomizing={isCustomizing}
		>
			<>
				<ListComponent
					className="mini-card report"
					items={topBots.map((bot) => ({
						id: bot.bot_name,
						title: bot.bot_name,
						tags: (
							<span className="desc">
								{formatWpDate(bot.last_seen_at)}
							</span>
						),
					}))}
				/>
			</>
		</DashboardWidget>
	);
};

export default CrawlerTrafficWidget;
