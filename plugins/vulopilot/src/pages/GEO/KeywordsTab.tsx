/* global appLocalizer */
import { useEffect, useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { getApiLink, getApiResponse, sendApiResponse } from '@zyra/core';
import {
	CardComponent,
	ColumnComponent,
	ContainerComponent,
	ModuleGuardComponent,
	NoticeComponent,
	BadgeComponent,
	ChartComponent,
} from '@zyra/components';
import { ButtonInput } from '@zyra/inputs';
import { TableCard, TableRow } from '@zyra/table';
import TypographyComponent from '../../components/TypographyComponent';
import {
	useGoogleServicesConnection,
	GoogleServicesStatus,
} from '../../services/useGoogleServicesConnection';
import {
	useKeywordRankings,
	KeywordOpportunityRow,
	KeywordGroupRow,
} from '../../services/useKeywordRankings';
import { useApiList } from '../../services/useApiList';
import { formatWpDate } from '../../services/formatWpDate';
import './SeoVisibility.scss';

const nonceHeaders = { headers: { 'X-WP-Nonce': appLocalizer.nonce } };

interface GscSite {
	site_url: string;
	permission_level: string;
}

interface KeywordRow extends TableRow {
	id: number;
	query: string;
	page: string;
	position: number;
	previous_position: number | null;
	change: number | null;
	best_position: number;
	clicks: number;
	impressions: number;
	ctr: number;
	updated_at: string;
}

const BENEFITS = [
	__('Verify this site with Google Search Console in a single click.', 'vulopilot'),
	__('See your real, already-verified Search Console property without leaving this tab.', 'vulopilot'),
	__('Real ranking positions, impressions, and clicks — synced from Search Console, tracked over time.', 'vulopilot'),
];

const POSITION_DISTRIBUTION_COLORS = ['#7C3AED', '#2563EB', '#0D9488', '#EA580C', '#DB2777'];

const formatNumber = (value: number | null): string =>
	null === value ? '—' : value.toLocaleString();

const formatPosition = (value: number | null): string =>
	null === value ? '—' : value.toFixed(1);

const pctDelta = (current: number, previous: number | null): number | null => {
	if (null === previous || 0 === previous) {
		return null;
	}
	return Math.round(((current - previous) / previous) * 100);
};

/**
 * Same real up/down/neutral shape CrawlerAnalyticsSection.tsx's own
 * `ChangeBadge` already established (reuses its `.crawler-change` CSS as-is)
 * — generalized to take an already-computed `delta` rather than
 * current/previous, since Avg. Position's own "improvement" direction is a
 * raw point delta (lower position = better), not a percent-of-previous
 * change the way every other stat card here is.
 */
const TrendBadge = ({ delta, suffix = '%' }: { delta: number | null; suffix?: string }) => {
	if (null === delta || 0 === delta) {
		return <span className="crawler-change is-neutral">—</span>;
	}
	return (
		<span className={`crawler-change ${delta > 0 ? 'is-up' : 'is-down'}`}>
			{delta > 0 ? '↑' : '↓'} {Math.abs(delta)}
			{suffix}
		</span>
	);
};

/**
 * Ranking Keywords table's own "Change" cell — `row.previous_position` is
 * null (not zero) for a real query that has no row on the previous real
 * sync date at all (new to the top 1,000, or genuinely wasn't ranking
 * yet), so this is told apart from a real "no change" (`change === 0`)
 * rather than folded into the same "—" the generic TrendBadge above shows
 * for that case.
 */
const PositionChangeCell = ({ row }: { row: KeywordRow }) => {
	if (null === row.previous_position) {
		return <span className="keyword-change-new">{__('New', 'vulopilot')}</span>;
	}
	if (null === row.change || 0 === row.change) {
		return <span className="crawler-change is-neutral">—</span>;
	}
	const improved = row.change > 0;
	return (
		<span className={`crawler-change ${improved ? 'is-up' : 'is-down'}`}>
			{improved ? '↑' : '↓'} {Math.abs(row.change).toFixed(1)}
		</span>
	);
};

/**
 * "Keywords" tab of "SEO & Visibility" — real, synced Search Console
 * rank-tracking dashboard (Controllers\KeywordRankings /
 * KeywordRankingsSyncService), replacing this tab's former "connection
 * works, ranking keywords aren't pulled in yet" placeholder state now that
 * they are. The real inline "Connect Google Services"/pick-a-property flow
 * below is unchanged from before — same real OAuth handshake, same
 * `useGoogleServicesConnection('keywords')` shared with Settings →
 * Connections → Google Services (GoogleServicesPanel.tsx).
 *
 * Every number on this tab traces back to a real `searchAnalytics.query`
 * snapshot stored in `vulopilot_keyword_rankings` (a daily cron sync, plus
 * this tab's own "Sync now" button for an on-demand pull) — see
 * KeywordRankingsSyncService's own docblock for the real reporting-lag/
 * row-limit/retention bounds that shape what's actually captured.
 * "Estimated Traffic" is real GA4 sessions when a GA4 property is
 * connected (Settings → Connections → Google Services), real Search
 * Console clicks otherwise — both real, labeled with their own real
 * source underneath the number, never blended or guessed.
 *
 * Volume/Keyword Difficulty/Intent/SERP Features from the reference
 * mockup are deliberately NOT shown anywhere on this tab — no Google API,
 * and no third-party keyword-research integration exists anywhere in this
 * codebase to source them honestly (direct instruction: omit rather than
 * fabricate). "Keyword Groups" is real too, just repurposed to group by
 * the real ranking page Search Console itself returned for each query —
 * the one real grouping dimension actually on hand.
 */
const KeywordsTab = () => {
	const {
		status,
		setStatus,
		isLoading: isConnectionLoading,
		isConnecting,
		isDisconnecting,
		connect,
		disconnect,
	} = useGoogleServicesConnection('keywords');

	const [gscSites, setGscSites] = useState<GscSite[] | null>(null);

	const {
		summary,
		opportunities,
		groups,
		isLoading: isSummaryLoading,
		isSyncing,
		sync,
	} = useKeywordRankings();

	const keywords = useApiList<KeywordRow>('keyword-rankings');

	useEffect(() => {
		if (!status?.connected || status.search_console_site || null !== gscSites) {
			return;
		}

		getApiResponse<GscSite[]>(
			getApiLink(appLocalizer, 'google-services/search-console-sites'),
			nonceHeaders
		).then((response) => setGscSites(response ?? []));
	}, [status?.connected, status?.search_console_site, gscSites]);

	const handleSelectSite = (siteUrl: string) => {
		sendApiResponse<GoogleServicesStatus>(
			appLocalizer,
			getApiLink(appLocalizer, 'google-services/select-search-console-site'),
			{ site_url: siteUrl }
		).then((response) => {
			if (response) {
				setStatus(response);
			}
		});
	};

	const handleDisconnect = () => {
		disconnect().then(() => setGscSites(null));
	};

	const handleSync = () => {
		sync().then(() => keywords.refetch());
	};

	// --- Not connected yet, or connected but no property picked: same real
	// flow this tab has always had — unchanged from before this dashboard
	// existed. ---
	if (isConnectionLoading || !status || !status.connected || !status.search_console_site) {
		return (
			<ColumnComponent>
				<NoticeComponent
					type="success"
					position="notice"
					message={sprintf(
						'<strong>%1$s</strong> %2$s',
						__('In plain English:', 'vulopilot'),
						__(
							'This is where you’d see which real Google search queries your pages already rank for, and where.',
							'vulopilot'
						)
					)}
				/>

				<CardComponent
					title={__('Ranking Keywords', 'vulopilot')}
					titleIcon="search"
					isLoading={isConnectionLoading}
				>
					{!isConnectionLoading && status && !status.connected && (
						<>
							{!status.has_client_credentials ? (
								<ModuleGuardComponent
									icon="info"
									title={__('Google Connect isn’t available yet', 'vulopilot')}
									desc={__(
										'This build doesn’t have a Google Cloud OAuth Client configured yet — that’s a one-time setup VuloLabs does, not something you configure. Flag if you’re seeing this on a real release.',
										'vulopilot'
									)}
								/>
							) : (
								<div className="gsc-connect-hero">
									<ButtonInput
										buttons={{
											text: isConnecting
												? __('Redirecting…', 'vulopilot')
												: __('Connect Google Services', 'vulopilot'),
											icon: 'admin-links',
											onClick: connect,
											disabled: isConnecting,
										}}
									/>
									<div className="gsc-benefits-title">
										{__('Benefits of connecting your Google account', 'vulopilot')}
									</div>
									<ul className="gsc-benefits-list">
										{BENEFITS.map((benefit) => (
											<li key={benefit}>
												<i className="adminfont-check" /> {benefit}
											</li>
										))}
									</ul>
									<NoticeComponent
										displayPosition="inline"
										message={__(
											'We don’t store any of your Google account’s data on our servers — everything is processed and stored on your own site. Tokens are encrypted at rest the same way every other API key in VuloPilot is.',
											'vulopilot'
										)}
									/>
								</div>
							)}
						</>
					)}

					{!isConnectionLoading && status && status.connected && !status.search_console_site && (
						<div className="gsc-site-picker">
							<div className="desc">
								{__('Choose which verified property to use:', 'vulopilot')}
							</div>
							{null === gscSites && (
								<div className="desc">{__('Loading…', 'vulopilot')}</div>
							)}
							{gscSites && gscSites.length === 0 && (
								<div className="desc">
									{__(
										'No verified Search Console properties found on this Google account.',
										'vulopilot'
									)}
								</div>
							)}
							{gscSites?.map((site) => (
								<button
									key={site.site_url}
									type="button"
									className="gsc-site-option"
									onClick={() => handleSelectSite(site.site_url)}
								>
									{site.site_url}
								</button>
							))}
						</div>
					)}
				</CardComponent>
			</ColumnComponent>
		);
	}

	// --- Connected + property picked: real dashboard. ---
	const stats = summary?.stats;

	const statCards = stats
		? [
				{
					key: 'total_keywords',
					icon: 'search',
					label: __('Total Keywords', 'vulopilot'),
					value: formatNumber(stats.total_keywords.value),
					delta: pctDelta(stats.total_keywords.value ?? 0, stats.total_keywords.previous),
					trend: summary?.trend.total_keywords ?? [],
				},
				{
					key: 'top_3',
					icon: 'star-filled',
					label: __('Top 3 Rankings', 'vulopilot'),
					value: formatNumber(stats.top_3.value),
					delta: pctDelta(stats.top_3.value ?? 0, stats.top_3.previous),
					trend: summary?.trend.top_3 ?? [],
				},
				{
					key: 'top_10',
					icon: 'chart-bar',
					label: __('Top 10 Rankings', 'vulopilot'),
					value: formatNumber(stats.top_10.value),
					delta: pctDelta(stats.top_10.value ?? 0, stats.top_10.previous),
					trend: summary?.trend.top_10 ?? [],
				},
				{
					key: 'avg_position',
					icon: 'chart-line',
					label: __('Avg. Position', 'vulopilot'),
					value: formatPosition(stats.avg_position.value),
					// Raw point delta, already "positive = improvement" (a
					// lower position number is better) — unlike every other
					// card here, NOT a percent-of-previous change.
					delta:
						null !== stats.avg_position.value && null !== stats.avg_position.previous
							? Math.round((stats.avg_position.previous - stats.avg_position.value) * 10) / 10
							: null,
					deltaSuffix: '',
					trend: summary?.trend.avg_position ?? [],
				},
				{
					key: 'estimated_traffic',
					icon: 'car',
					label: __('Estimated Traffic', 'vulopilot'),
					value: formatNumber(stats.estimated_traffic.value),
					delta: pctDelta(stats.estimated_traffic.value ?? 0, stats.estimated_traffic.previous),
					trend: summary?.trend.estimated_traffic ?? [],
					note:
						'analytics' === stats.estimated_traffic.source
							? __('Google Analytics sessions', 'vulopilot')
							: __('Search Console clicks', 'vulopilot'),
				},
				{
					key: 'impressions',
					icon: 'visibility',
					label: __('Impressions', 'vulopilot'),
					value: formatNumber(stats.impressions.value),
					delta: pctDelta(stats.impressions.value ?? 0, stats.impressions.previous),
					trend: summary?.trend.impressions ?? [],
				},
			]
		: [];

	const keywordRows: KeywordRow[] = keywords.data.map((row, index) => ({
		...row,
		id: index,
	}));

	return (
		<ColumnComponent>
			<CardComponent title={__('Search Console', 'vulopilot')} titleIcon="search">
				<div className="keywords-connected-row">
					<BadgeComponent color="green" text={__('Connected', 'vulopilot')} />
					<TypographyComponent as="span" variant="desc">
						<i className="adminfont-search" /> {status.search_console_site}
					</TypographyComponent>
					{summary?.last_synced_at && (
						<TypographyComponent as="span" variant="desc">
							{sprintf(
								__('Last synced %s', 'vulopilot'),
								formatWpDate(summary.last_synced_at)
							)}
						</TypographyComponent>
					)}
					<ButtonInput
						buttons={{
							text: isSyncing ? __('Syncing…', 'vulopilot') : __('Sync now', 'vulopilot'),
							icon: 'update',
							onClick: handleSync,
							disabled: isSyncing,
						}}
					/>
					<button
						type="button"
						className="gsc-inline-action is-destructive"
						onClick={handleDisconnect}
						disabled={isDisconnecting}
					>
						{isDisconnecting ? __('Disconnecting…', 'vulopilot') : __('Disconnect', 'vulopilot')}
					</button>
				</div>
			</CardComponent>

			{!isSummaryLoading && summary && !summary.synced && (
				<CardComponent title={__('Ranking Keywords', 'vulopilot')} titleIcon="chart-bar">
					<ModuleGuardComponent
						icon="info"
						title={__('Not synced yet', 'vulopilot')}
						desc={__(
							'Click "Sync now" above to pull your first real snapshot of keyword rankings from Search Console. Search Console data has a real ~3 day reporting delay, so the very first sync may look sparse until a few more days of data are captured.',
							'vulopilot'
						)}
						buttonText={isSyncing ? __('Syncing…', 'vulopilot') : __('Sync now', 'vulopilot')}
						onButtonClick={handleSync}
					/>
				</CardComponent>
			)}

			{(isSummaryLoading || summary?.synced) && (
				<>
					<ContainerComponent>
						{(isSummaryLoading ? Array.from({ length: 6 }) : statCards).map((stat, index) => (
							<ColumnComponent grid={2} key={(stat as { key?: string })?.key ?? index}>
								<CardComponent isLoading={isSummaryLoading}>
									{!isSummaryLoading && stat && (
										<div className="keyword-stat-card">
											<div className="keyword-stat-header">
												<span className="keyword-stat-icon">
													<i className={`adminfont-${(stat as { icon: string }).icon}`} />
												</span>
												<span className="keyword-stat-label">
													{(stat as { label: string }).label}
												</span>
											</div>
											<div className="keyword-stat-value">
												{(stat as { value: string }).value}
											</div>
											<TrendBadge
												delta={(stat as { delta: number | null }).delta}
												suffix={(stat as { deltaSuffix?: string }).deltaSuffix ?? '%'}
											/>
											{(stat as { note?: string }).note && (
												<div className="keyword-stat-note">
													{(stat as { note?: string }).note}
												</div>
											)}
											{(stat as { trend: number[] }).trend.length > 1 && (
												<div className="keyword-stat-sparkline">
													<ChartComponent
														type="area"
														sparkline
														height={40}
														dataKey="value"
														xKey="date"
														color="primary"
														data={(summary?.trend.dates ?? []).map((date, i) => ({
															date,
															value: (stat as { trend: (number | null)[] }).trend[i] ?? null,
														}))}
													/>
												</div>
											)}
										</div>
									)}
								</CardComponent>
							</ColumnComponent>
						))}
					</ContainerComponent>

					<ContainerComponent>
						<ColumnComponent grid={5}>
							<CardComponent
								title={__('Keyword Position Distribution', 'vulopilot')}
								titleIcon="chart-bar"
								isLoading={isSummaryLoading}
							>
								{summary && (
									<ChartComponent
										type="pie"
										height={200}
										legendLabels
										data={summary.position_distribution.map((band, index) => ({
											label: band.label,
											value: band.count,
											color:
												POSITION_DISTRIBUTION_COLORS[
													index % POSITION_DISTRIBUTION_COLORS.length
												],
										}))}
									/>
								)}
							</CardComponent>
						</ColumnComponent>
						<ColumnComponent grid={7}>
							<CardComponent
								title={__('Top Opportunities', 'vulopilot')}
								titleIcon="chart-line"
								desc={__(
									'Real keywords already ranking on page 1-2 (position 4-20) with real impressions — the closest, real path to a Top 3 result.',
									'vulopilot'
								)}
								isLoading={isSummaryLoading}
							>
								{!opportunities || 0 === opportunities.length ? (
									<ModuleGuardComponent
										icon="info"
										title={__('No opportunities yet', 'vulopilot')}
										desc={__(
											'None of your real ranking keywords are currently in the 4-20 position range.',
											'vulopilot'
										)}
									/>
								) : (
									<table className="crawler-table">
										<thead>
											<tr>
												<th>{__('Keyword', 'vulopilot')}</th>
												<th>{__('Position', 'vulopilot')}</th>
												<th>{__('Impressions', 'vulopilot')}</th>
											</tr>
										</thead>
										<tbody>
											{opportunities.map((row: KeywordOpportunityRow) => (
												<tr key={row.query}>
													<td>{row.query}</td>
													<td>{formatPosition(row.position)}</td>
													<td>{row.impressions.toLocaleString()}</td>
												</tr>
											))}
										</tbody>
									</table>
								)}
							</CardComponent>
						</ColumnComponent>
					</ContainerComponent>

					<CardComponent
						title={__('Keyword Groups', 'vulopilot')}
						titleIcon="pages"
						desc={__(
							'Your real ranking keywords, grouped by the real page Search Console matched each one to — there’s no third-party keyword-topic database connected here, so this is the one real grouping dimension on hand.',
							'vulopilot'
						)}
						isLoading={isSummaryLoading}
					>
						{!groups || 0 === groups.length ? (
							<ModuleGuardComponent
								icon="info"
								title={__('No groups yet', 'vulopilot')}
								desc={__(
									'Groups will appear here once real keyword data has synced.',
									'vulopilot'
								)}
							/>
						) : (
							<table className="crawler-table">
								<thead>
									<tr>
										<th>{__('Page', 'vulopilot')}</th>
										<th>{__('Keywords', 'vulopilot')}</th>
										<th>{__('Traffic', 'vulopilot')}</th>
										<th>{__('Impressions', 'vulopilot')}</th>
										<th>{__('Avg. Position', 'vulopilot')}</th>
									</tr>
								</thead>
								<tbody>
									{groups.map((row: KeywordGroupRow) => (
										<tr key={row.page || 'unmatched'}>
											<td className="crawler-table-url">
												{row.page || __('(no matched page)', 'vulopilot')}
											</td>
											<td>{row.keyword_count.toLocaleString()}</td>
											<td>{row.total_clicks.toLocaleString()}</td>
											<td>{row.total_impressions.toLocaleString()}</td>
											<td>{formatPosition(row.avg_position)}</td>
										</tr>
									))}
								</tbody>
							</table>
						)}
					</CardComponent>

					<CardComponent title={__('Ranking Keywords', 'vulopilot')} titleIcon="search">
						<TableCard
							showMenu={false}
							search={{ placeholder: __('Search keywords…', 'vulopilot') }}
							headers={{
								query: {
									label: __('Keyword', 'vulopilot'),
									render: (row: KeywordRow) => row.query,
								},
								position: {
									label: __('Position', 'vulopilot'),
									isSortable: true,
									render: (row: KeywordRow) => formatPosition(row.position),
								},
								previous_position: {
									label: __('Previous', 'vulopilot'),
									render: (row: KeywordRow) => formatPosition(row.previous_position),
								},
								change: {
									label: __('Change', 'vulopilot'),
									render: (row: KeywordRow) => <PositionChangeCell row={row} />,
								},
								best_position: {
									label: __('Best Position', 'vulopilot'),
									render: (row: KeywordRow) => formatPosition(row.best_position),
								},
								clicks: {
									label: __('Traffic', 'vulopilot'),
									isSortable: true,
									render: (row: KeywordRow) => row.clicks.toLocaleString(),
								},
								impressions: {
									label: __('Impressions', 'vulopilot'),
									isSortable: true,
									render: (row: KeywordRow) => row.impressions.toLocaleString(),
								},
								ctr: {
									label: __('CTR', 'vulopilot'),
									render: (row: KeywordRow) => `${row.ctr}%`,
								},
								updated_at: {
									label: __('Updated', 'vulopilot'),
									render: (row: KeywordRow) => formatWpDate(row.updated_at),
								},
								action: {
									label: __('Action', 'vulopilot'),
									render: (row: KeywordRow) =>
										row.page ? (
											<a
												href={row.page}
												target="_blank"
												rel="noopener noreferrer"
												className="keyword-view-page-link"
												title={__('View ranking page', 'vulopilot')}
											>
												<i className="adminfont-link" />
											</a>
										) : (
											'—'
										),
								},
							}}
							rows={keywordRows}
							ids={keywordRows.map((row) => row.id as number)}
							totalRows={keywords.total}
							isLoading={keywords.isLoading}
							onQueryUpdate={keywords.onQueryUpdate}
							emptyMessage={__('No ranking keywords found.', 'vulopilot')}
						/>
					</CardComponent>
				</>
			)}
		</ColumnComponent>
	);
};

export default KeywordsTab;
