/* global vulopilotAppLocalizer */
import { useEffect, useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { getApiLink, getApiResponse } from '@zyra/core';
import { Kpi, KpiGrid, Segmented } from '../../components/ui';

interface StatMetric {
	current: number;
	previous: number;
	change_percent: number | null;
}

interface StatsResponse {
	content_created: StatMetric;
	words_generated: StatMetric;
}

interface GroupRow {
	count: number;
}

/** The scanners that flag per-page content quality (the same three the pages list below uses). */
export const CONTENT_SCANNER_IDS = ['thin-content', 'readability', 'heading-structure'];

const PERIODS = [
	{ value: '7', label: __('7D', 'vulopilot') },
	{ value: '30', label: __('30D', 'vulopilot') },
	{ value: '90', label: __('90D', 'vulopilot') },
];

const toYmd = (date: Date): string => date.toISOString().slice(0, 10);

const short = (count: number): string => (count >= 1000 ? `${(count / 1000).toFixed(1)}K` : count.toLocaleString());

const nonce = () => ({ headers: { 'X-WP-Nonce': vulopilotAppLocalizer.nonce } });

/**
 * The Content page's figures: what was created and written with VuloPilot in the period
 * (`GET /content-intelligence/stats`), and the content issues the last audit left open (`GET /findings/groups`).
 */
const ContentStatsCard = () => {
	const [period, setPeriod] = useState('30');
	const [stats, setStats] = useState<StatsResponse | null>(null);
	const [issues, setIssues] = useState<number | null>(null);

	useEffect(() => {
		const to = new Date();
		const from = new Date();
		from.setDate(from.getDate() - (Number(period) - 1));

		setStats(null);
		getApiResponse<StatsResponse>(
			getApiLink(vulopilotAppLocalizer, `content-intelligence/stats?date_from=${toYmd(from)}&date_to=${toYmd(to)}`),
			nonce()
		).then((response) => setStats(response ?? null));
	}, [period]);

	useEffect(() => {
		getApiResponse<{ data?: GroupRow[] }>(
			`${getApiLink(vulopilotAppLocalizer, 'findings/groups')}?per_page=50&scanner_id=${CONTENT_SCANNER_IDS.join(',')}`,
			nonce()
		).then((response) => setIssues((response?.data ?? []).reduce((sum, group) => sum + group.count, 0)));
	}, []);

	const periodHint = sprintf(
		/* translators: %s: number of days. */
		__('vs the previous %s days', 'vulopilot'),
		period
	);

	return (
		<div className="vp-content-stats">
			<div className="vp-section-head">
				<h2>{__('Your content', 'vulopilot')}</h2>
				<Segmented size="sm" label={__('Period', 'vulopilot')} value={period} onChange={setPeriod} options={PERIODS} />
			</div>
			<KpiGrid label={__('Content figures', 'vulopilot')} cols={3}>
				<Kpi
					icon="document"
					tone="violet"
					label={__('Created with AI', 'vulopilot')}
					value={stats ? stats.content_created.current.toLocaleString() : '–'}
					change={stats?.content_created.change_percent ?? null}
					hint={periodHint}
				/>
				<Kpi
					icon="edit"
					tone="blue"
					label={__('Words written', 'vulopilot')}
					value={stats ? short(stats.words_generated.current) : '–'}
					change={stats?.words_generated.change_percent ?? null}
					hint={periodHint}
				/>
				<Kpi
					icon={issues ? 'error' : 'check'}
					tone={issues ? 'amber' : 'green'}
					label={__('Content issues', 'vulopilot')}
					value={null === issues ? '–' : issues}
					hint={issues ? __('Thin, hard to read or poorly structured pages', 'vulopilot') : __('Nothing open from the last audit', 'vulopilot')}
				/>
			</KpiGrid>
		</div>
	);
};

export default ContentStatsCard;
