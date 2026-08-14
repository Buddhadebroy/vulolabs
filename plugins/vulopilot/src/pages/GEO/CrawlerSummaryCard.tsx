/* global appLocalizer */
import { useEffect, useState } from 'react';
import { __ } from '@wordpress/i18n';
import { getApiLink, getApiResponse } from '@zyra/core';
import { AnalyticsComponent, CardComponent } from '@zyra/components';
import { formatWpDate } from '../../services/formatWpDate';

interface BotLastSeen {
	bot_name: string;
	last_seen_at: string;
}

interface CrawlerSummaryResponse {
	bot_last_seen: BotLastSeen[];
}

/**
 * "Last seen" tiles — readme.txt's "Live Visit Logs & Last-Seen
 * Timestamps." Reuses `GET /crawler-traffic/summary`'s own
 * `bot_last_seen` field (unchanged endpoint), but no longer renders that
 * same response's `daily_volume`/`most_crawled_pages` here — CrawlerTrafficTab.tsx's
 * own restyled CrawlerAnalyticsSection.tsx now covers both with a real
 * period-over-period comparison (`crawler-traffic/analytics`), so keeping
 * a second, plainer copy of the same two things on this same tab would be
 * exactly the duplicate data the redesign was asked to avoid. This
 * component is only used by CrawlerTrafficTab.tsx now — CrawlerTrafficWidget.tsx
 * (Dashboard) fetches the summary endpoint independently rather than
 * rendering this component, so trimming it doesn't change that widget.
 */
const CrawlerSummaryCard = () => {
	const [summary, setSummary] = useState<CrawlerSummaryResponse | null>(
		null
	);

	useEffect(() => {
		getApiResponse<CrawlerSummaryResponse>(
			getApiLink(appLocalizer, 'crawler-traffic/summary'),
			{ headers: { 'X-WP-Nonce': appLocalizer.nonce } }
		).then((response) => {
			if (response) {
				setSummary(response);
			}
		});
	}, []);

	if (!summary || summary.bot_last_seen.length === 0) {
		return null;
	}

	return (
		<CardComponent title={__('Last seen', 'vulopilot')}>
			<AnalyticsComponent
				variant="dashboard"
				cols={4}
				data={summary.bot_last_seen.map((entry) => ({
					icon: 'global-community',
					number: formatWpDate(entry.last_seen_at),
					text: entry.bot_name,
				}))}
			/>
		</CardComponent>
	);
};

export default CrawlerSummaryCard;
