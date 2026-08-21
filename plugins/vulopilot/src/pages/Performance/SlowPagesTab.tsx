/* global appLocalizer */
import { useEffect, useMemo, useState } from 'react';
import { __, _n, sprintf } from '@wordpress/i18n';
import { getApiLink, getApiResponse, sendApiResponse } from '@zyra/core';
import {
	CardComponent,
	ColumnComponent,
	ContainerComponent,
	FormGroupComponent,
	FormGroupWrapperComponent,
	ListComponent,
	ModuleGuardComponent,
	NoticeComponent,
	NoticeManager,
	PopupComponent,
	TooltipComponent,
	TrendStatComponent,
} from '@zyra/components';
import { ButtonInput, SelectInput, TextInput } from '@zyra/inputs';
import { TableCard } from '@zyra/table';
import { formatWpDate } from '../../services/formatWpDate';
import RecommendedFixesCard from './RecommendedFixesCard';
import './Performance.scss';

/** `id: 'performance'` (Settings/Scanning/Performance.ts) — where the real PageSpeed Insights API key field this notice's own "no PSI connected" message used to describe in text actually lives. */
const PERFORMANCE_SETTINGS_URL = '?page=vulopilot#&tab=settings&subtab=performance';

interface PageSpeedRow {
	id: number;
	url: string;
	title: string;
	page_type: string;
	load_time_ms: number | null;
	score: number | null;
	status: 'slow' | 'needs_improvement' | 'good' | null;
	mobile_score: number | null;
	desktop_score: number | null;
	main_issue: string | null;
	page_size_bytes: number | null;
	requests_count: number | null;
	lcp_ms: number | null;
	lcp_rating: string | null;
	inp_ms: number | null;
	inp_rating: string | null;
	cls_thousandths: number | null;
	cls_rating: string | null;
	scanned_at: string;
}

interface PageSpeedSummary {
	total: number;
	slow: number;
	very_slow: number;
	needs_improvement: number;
	good: number;
	avg_score: number | null;
	avg_mobile_score: number | null;
	avg_load_time_ms: number | null;
	last_scanned_at: string | null;
}

interface PageSpeedIssue {
	issue: string;
	affected_pages: number;
}

interface PageSpeedResponse {
	summary: PageSpeedSummary;
	status_counts: Record<string, number>;
	top_issues: PageSpeedIssue[];
	data: PageSpeedRow[];
	total: number;
}

interface ScoreSnapshot {
	snapshot_date: string;
	performance_score: number;
}

const TREND_DAY_OPTIONS = [
	{ label: __( 'Last 7 days', 'vulopilot' ), value: '7' },
	{ label: __( 'Last 30 days', 'vulopilot' ), value: '30' },
	{ label: __( 'Last 90 days', 'vulopilot' ), value: '90' },
];

const PAGE_TYPE_ICONS: Record<string, string> = {
	homepage: 'home',
	page: 'document',
	post: 'web-page-website',
	shop: 'storefront',
	cart: 'cart',
	checkout: 'credit-card',
	product: 'product',
	category: 'category',
};

const PAGE_TYPE_LABELS: Record<string, string> = {
	homepage: __( 'Homepage', 'vulopilot' ),
	page: __( 'Page', 'vulopilot' ),
	post: __( 'Post', 'vulopilot' ),
	shop: __( 'Shop Page', 'vulopilot' ),
	cart: __( 'Cart Page', 'vulopilot' ),
	checkout: __( 'Checkout Page', 'vulopilot' ),
	product: __( 'Product Page', 'vulopilot' ),
	category: __( 'Category Page', 'vulopilot' ),
};

const ratingFor = ( score: number | null ): { label: string; className: 'good' | 'needs-improvement' | 'poor' | 'unknown' } => {
	if ( null === score ) {
		return { label: __( 'Not scored yet', 'vulopilot' ), className: 'unknown' };
	}

	if ( score >= 80 ) {
		return { label: __( 'Good', 'vulopilot' ), className: 'good' };
	}

	if ( score >= 50 ) {
		return { label: __( 'Needs Improvement', 'vulopilot' ), className: 'needs-improvement' };
	}

	return { label: __( 'Poor', 'vulopilot' ), className: 'poor' };
};

const ScorePill = ( { score }: { score: number | null } ) => {
	const rating = ratingFor( score );

	return (
		<span className={ `page-speed-score-pill ${ rating.className }` }>
			{ null === score ? '—' : score }
		</span>
	);
};

/** Real byte count → a human string, same MB/KB thresholds browser devtools use. */
const formatBytes = ( bytes: number | null ): string => {
	if ( null === bytes ) {
		return '—';
	}

	if ( bytes >= 1024 * 1024 ) {
		return `${ ( bytes / ( 1024 * 1024 ) ).toFixed( 1 ) } MB`;
	}

	if ( bytes >= 1024 ) {
		return `${ ( bytes / 1024 ).toFixed( 0 ) } KB`;
	}

	return `${ bytes } B`;
};

/**
 * Google's own real CrUX field-data category ('FAST'/'AVERAGE'/'SLOW') for
 * one Core Web Vital, passed through verbatim from PageSpeedScanner — this
 * just maps that real verdict onto this file's own good/needs-improvement/
 * poor dot palette, `unknown` (gray) when CrUX had no real field data for
 * this URL+metric (a real "not enough traffic" case, not fabricated).
 */
const CWV_DOT_CLASS: Record<string, string> = {
	FAST: 'good',
	AVERAGE: 'needs-improvement',
	SLOW: 'poor',
};

/** `ratingFor()`'s own className → the closest `admin-badge` color name — TrendStatComponent's own `Item.badge.color` contract (a real admin-badge modifier), not a raw hex, unlike the fixed `$vulopilot-rating-*` hex values the old summary tiles painted directly. No badge color exists for "very poor" specifically, so it shares 'red' with "poor". */
const RATING_BADGE_COLOR: Record<string, string> = {
	good: 'green',
	'needs-improvement': 'orange',
	poor: 'red',
	'very-poor': 'red',
	unknown: '',
};

const CWV_METRICS = [
	{ key: 'lcp', label: 'LCP', ratingKey: 'lcp_rating' as const },
	{ key: 'inp', label: 'INP', ratingKey: 'inp_rating' as const },
	{ key: 'cls', label: 'CLS', ratingKey: 'cls_rating' as const },
];

/**
 * Real Google CrUX field-data dots — one per metric, gray/"unknown" when
 * that metric has no real field data for this page (common for low-traffic
 * pages; CrUX only reports once enough real visits exist). Never a
 * fabricated color.
 */
const CoreWebVitalsDots = ( { row }: { row: PageSpeedRow } ) => (
	<div className="page-speed-cwv-dots">
		{ CWV_METRICS.map( ( metric ) => {
			const rating = row[ metric.ratingKey ];
			const dotClass = rating ? ( CWV_DOT_CLASS[ rating ] ?? 'unknown' ) : 'unknown';

			return (
				<span
					key={ metric.key }
					className="page-speed-cwv-item"
					title={
						rating
							? `${ metric.label }: ${ rating }`
							: `${ metric.label }: ${ __( 'No field data yet', 'vulopilot' ) }`
					}
				>
					<span className={ `page-speed-cwv-dot ${ dotClass }` } />
					<span className="page-speed-cwv-label">{ metric.label }</span>
				</span>
			);
		} ) }
	</div>
);

const csvEscape = ( value: string ): string => `"${ value.replace( /"/g, '""' ) }"`;

/**
 * "Slow Pages" tab of "Performance" — real per-page speed data from
 * `GET /page-speed` (Repositories\PageSpeedRepository, populated in the
 * background by Services\PageSpeedScanner). Fetched once per mount/scan
 * (this plugin's own page counts are bounded — see PageSpeedScanner's own
 * MAX_PER_TYPE — so client-side filter/search/sort is simpler than wiring
 * up TableCard, whose fixed header `type`s (text/currency/date/badge/
 * action/id/content/status) can't render this page's colored score pill +
 * Core Web Vitals dots per cell).
 *
 * Mobile/Desktop score columns, Page Size/Requests, and the Core Web
 * Vitals dots all only appear once at least one real row has that data —
 * i.e. once a `psi_api_key` is configured (Settings → Scanning →
 * Performance) and the background scan has reached that row — otherwise a
 * single real "Score" column is shown and the PSI-only columns are
 * dropped entirely, same PSI-key-gated fallback PerformanceScoreCard.tsx's
 * own Overall Speed Score card already uses; never a fabricated split or
 * placeholder numbers.
 *
 * The "Performance Trend" tile + sparkline reuses the real, already-dated
 * `GET /performance-score-snapshots` history (SpeedHistoryCard.tsx's own
 * data source, one row per real day) rather than inventing a per-page
 * load-time trend — this table itself has none (`replace_for_url()` keeps
 * only each page's latest scan, never a history). That snapshot is a
 * sitewide 0-100 performance score, not a Slow-Pages-specific or literal
 * seconds figure, so the tile is honestly labeled "pts" and "Performance
 * trend", not a fabricated "-1.4s" claim.
 */
const SlowPagesTab = () => {
	const [response, setResponse] = useState<PageSpeedResponse | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [isScanning, setIsScanning] = useState(false);
	const [statusFilter, setStatusFilter] = useState('all');
	const [pageTypeFilter, setPageTypeFilter] = useState('');
	const [searchTerm, setSearchTerm] = useState('');
	const [detailRow, setDetailRow] = useState<PageSpeedRow | null>(null);
	const [trendDays, setTrendDays] = useState('30');
	const [trend, setTrend] = useState<ScoreSnapshot[]>([]);
	const [isTrendLoading, setIsTrendLoading] = useState(true);
	// This table's own rows are all fetched once (per_page=200) and
	// filtered/searched entirely client-side (see this file's own docblock)
	// — TableCard itself never slices `rows` server-side, it just displays
	// whatever page-worth it's handed and hands page changes back via
	// `onQueryUpdate`, so this table now does that same slicing locally.
	const [paged, setPaged] = useState(1);
	const [perPage, setPerPage] = useState(10);

	const load = () => {
		setIsLoading(true);
		setError(null);

		getApiResponse<PageSpeedResponse>(
			getApiLink(appLocalizer, 'page-speed') + '?per_page=200',
			{ headers: { 'X-WP-Nonce': appLocalizer.nonce } }
		)
			.then((data) => {
				if (data) {
					setResponse(data);
				} else {
					setError(
						__(
							'Could not load Slow Pages.',
							'vulopilot'
						)
					);
				}
			})
			.finally(() => setIsLoading(false));
	};

	useEffect(() => {
		load();
	}, []);

	useEffect(() => {
		let cancelled = false;
		setIsTrendLoading(true);

		getApiResponse<ScoreSnapshot[]>(
			`${getApiLink(appLocalizer, 'performance-score-snapshots')}?days=${trendDays}`,
			{ headers: { 'X-WP-Nonce': appLocalizer.nonce } }
		)
			.then((data) => {
				if (!cancelled) {
					setTrend(
						(data ?? []).map((row) => ({
							snapshot_date: row.snapshot_date,
							performance_score: Number(row.performance_score),
						}))
					);
				}
			})
			.finally(() => {
				if (!cancelled) {
					setIsTrendLoading(false);
				}
			});

		return () => {
			cancelled = true;
		};
	}, [trendDays]);

	const handleScan = () => {
		setIsScanning(true);

		sendApiResponse(appLocalizer, getApiLink(appLocalizer, 'page-speed'), {}).then(
			(result) => {
				if (result) {
					NoticeManager.add({
						uniqueKey: 'vulopilot-page-speed-scan',
						type: 'success',
						position: 'float',
						message: __(
							'Scan started — checking your pages in the background. Results will appear here as each page finishes.',
							'vulopilot'
						),
					});
				} else {
					NoticeManager.add({
						uniqueKey: 'vulopilot-page-speed-scan-failed',
						type: 'error',
						position: 'float',
						message: __( 'Could not start the scan. Please try again.', 'vulopilot' ),
					});
				}
			}
		).finally(() => setIsScanning(false));
	};

	const rows = response?.data ?? [];
	const hasDeviceScores = rows.some((row) => null !== row.mobile_score);
	const hasPsiDetail = rows.some((row) => null !== row.page_size_bytes);
	// Real average — `avg_mobile_score` only when a PSI key is configured
	// (per-device split available), `avg_score` otherwise (PageSpeedRepository::get_summary()
	// always computes both from the same real rows; this tile just needs to
	// read the one that matches what the rest of this page is showing).
	// Was previously hardcoded to `avg_mobile_score` alone, so this tile
	// showed "—" even with real, non-empty scanned scores whenever no PSI
	// key was configured — the common case.
	const avgScore = response?.summary
		? (hasDeviceScores
				? response.summary.avg_mobile_score
				: response.summary.avg_score)
		: null;
	const avgScoreRating = ratingFor(avgScore);
	const avgLoadTimeMs = response?.summary?.avg_load_time_ms ?? null;

	const trendDelta =
		trend.length >= 2
			? trend[trend.length - 1].performance_score - trend[0].performance_score
			: null;
	const isTrendImproving = null !== trendDelta && trendDelta >= 0;

	const pageTypeOptions = useMemo(() => {
		const present = Array.from(new Set(rows.map((row) => row.page_type)));
		return [
			{ label: __( 'All Page Types', 'vulopilot' ), value: '' },
			...present.map((type) => ({
				label: PAGE_TYPE_LABELS[type] ?? type,
				value: type,
			})),
		];
	}, [rows]);

	const filteredRows = useMemo(() => {
		return rows.filter((row) => {
			if ('all' !== statusFilter && row.status !== statusFilter) {
				return false;
			}

			if (pageTypeFilter && row.page_type !== pageTypeFilter) {
				return false;
			}

			if (
				searchTerm &&
				!row.title.toLowerCase().includes(searchTerm.toLowerCase()) &&
				!row.url.toLowerCase().includes(searchTerm.toLowerCase())
			) {
				return false;
			}

			return true;
		});
	}, [rows, statusFilter, pageTypeFilter, searchTerm]);

	// A stale page 3 left over from a previous filter could otherwise show
	// an empty page once a new filter/search narrows the real result set.
	useEffect(() => {
		setPaged(1);
	}, [statusFilter, pageTypeFilter, searchTerm]);

	const pageRows = filteredRows.slice((paged - 1) * perPage, paged * perPage);

	const statusCounts = response?.status_counts ?? {};
	const summary = response?.summary ?? null;
	const topIssues = response?.top_issues ?? [];

	const filterPills: { value: string; label: string; count: number }[] = [
		{ value: 'all', label: __( 'All', 'vulopilot' ), count: summary?.total ?? 0 },
		{ value: 'slow', label: __( 'Slow', 'vulopilot' ), count: statusCounts.slow ?? 0 },
		{
			value: 'needs_improvement',
			label: __( 'Needs Improvement', 'vulopilot' ),
			count: statusCounts.needs_improvement ?? 0,
		},
		{ value: 'good', label: __( 'Good', 'vulopilot' ), count: statusCounts.good ?? 0 },
	];

	const handleExport = () => {
		const headerRow = [
			'Page',
			'URL',
			'Type',
			...(hasDeviceScores ? ['Mobile Score', 'Desktop Score'] : ['Score']),
			'Load Time (ms)',
			...(hasPsiDetail ? ['Page Size (bytes)', 'Requests', 'LCP (ms)', 'LCP Rating', 'INP (ms)', 'INP Rating', 'CLS (thousandths)', 'CLS Rating'] : []),
			'Main Issue',
		];

		const lines = [headerRow.map(csvEscape).join(',')];

		filteredRows.forEach((row) => {
			const cells = [
				row.title,
				row.url,
				PAGE_TYPE_LABELS[row.page_type] ?? row.page_type,
				...(hasDeviceScores ? [row.mobile_score ?? '', row.desktop_score ?? ''] : [row.score ?? '']),
				row.load_time_ms ?? '',
				...(hasPsiDetail
					? [
							row.page_size_bytes ?? '',
							row.requests_count ?? '',
							row.lcp_ms ?? '',
							row.lcp_rating ?? '',
							row.inp_ms ?? '',
							row.inp_rating ?? '',
							row.cls_thousandths ?? '',
							row.cls_rating ?? '',
						]
					: []),
				row.main_issue ?? '',
			];

			lines.push(cells.map((cell) => csvEscape(String(cell))).join(','));
		});

		const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
		const url = URL.createObjectURL(blob);
		const anchor = document.createElement('a');
		anchor.href = url;
		anchor.download = 'slow-pages.csv';
		anchor.click();
		URL.revokeObjectURL(url);
	};

	if (error) {
		return (
			<ContainerComponent general>
				<ColumnComponent>
					<CardComponent title={__( 'Slow Pages', 'vulopilot' )}>
						<ModuleGuardComponent
							icon="error"
							title={__( 'Could not load Slow Pages', 'vulopilot' )}
							desc={error}
							buttonText={__( 'Retry', 'vulopilot' )}
							onButtonClick={load}
						/>
					</CardComponent>
				</ColumnComponent>
			</ContainerComponent>
		);
	}

	return (
		<>
			<ColumnComponent grid={8}>
				{/* <p className="page-speed-intro">
					{__(
						'These pages are loading slowly and need your attention.',
						'vulopilot'
					)}
				</p> */}

				<TrendStatComponent
					cols={4}
					isLoading={isLoading || isTrendLoading}
					items={[
						{
							icon: 'error',
							label: __( 'Slow Pages', 'vulopilot' ),
							value: summary?.slow ?? 0,
							badge: {
								text: __( 'Needs Improvement', 'vulopilot' ),
								color: 'orange',
							},
						},
						{
							icon: 'error',
							label: __( 'Very Slow Pages', 'vulopilot' ),
							value: summary?.very_slow ?? 0,
							badge: { text: __( 'Poor', 'vulopilot' ), color: 'red' },
						},
						{
							icon: 'form-phone',
							label: __( 'Average Load Time', 'vulopilot' ),
							value:
								avgLoadTimeMs !== null
									? sprintf( __( '%s s', 'vulopilot' ), (avgLoadTimeMs / 1000).toFixed(1) )
									: '—',
							badge: {
								text:
									null !== avgScore
										? sprintf(
												/* translators: %s is a rating word like "Good"/"Poor". */
												__( '%s score', 'vulopilot' ),
												avgScoreRating.label
											)
										: __( 'Not scored yet', 'vulopilot' ),
								color: RATING_BADGE_COLOR[avgScoreRating.className],
							},
						},
						{
							icon: 'check',
							label:
								null !== trendDelta
									? __( 'Performance Trend', 'vulopilot' )
									: __( 'Not enough trend data yet', 'vulopilot' ),
							value:
								null !== trendDelta
									? `${trendDelta >= 0 ? '+' : ''}${trendDelta} ${__( 'pts', 'vulopilot' )}`
									: '—',
							color: isTrendImproving ? '#16a34a' : '#dc2626',
							chartData: trend.length >= 2 ? trend : undefined,
							chartDataKey: 'performance_score',
						},
					]}
				/>

				<NoticeComponent
					type="info"
					displayPosition="inline-notice"
					message={__(
						'Slow pages can hurt user experience and search rankings. Focus on the pages with the lowest scores first for the biggest impact.',
						'vulopilot'
					)}
					actionLabel={`${__( 'Learn more', 'vulopilot' )} ↗`}
					onAction={() =>
						window.open(
							'https://web.dev/articles/vitals',
							'_blank',
							'noopener,noreferrer'
						)
					}
				/>

				<div className="page-speed-toolbar">
					<div className="page-speed-filter-pills">
						{filterPills.map((pill) => (
							<button
								key={pill.value}
								type="button"
								className={`page-speed-filter-pill ${statusFilter === pill.value ? 'is-active' : ''}`}
								onClick={() => setStatusFilter(pill.value)}
							>
								{pill.label} ({pill.count})
							</button>
						))}
						<SelectInput
							name="page_speed_trend_days"
							value={trendDays}
							options={TREND_DAY_OPTIONS}
							onChange={(value) => setTrendDays(value as string)}
							size="9rem"
						/>
						<SelectInput
							name="page_type_filter"
							value={pageTypeFilter}
							options={pageTypeOptions}
							onChange={(value) => setPageTypeFilter(value as string)}
							size="12rem"
						/>
					</div>
					{summary?.last_scanned_at && (
						<span className="page-speed-last-scanned">
							{sprintf(
								/* translators: %s is a formatted date/time. */
								__( 'Last scan: %s', 'vulopilot' ),
								formatWpDate(summary.last_scanned_at)
							)}
						</span>
					)}
					<TextInput
						name="page_speed_search"
						placeholder={__( 'Search pages…', 'vulopilot' )}
						value={searchTerm}
						onChange={(value) => setSearchTerm(value as string)}
						wrapperClass="table-search"
					/>
					<ButtonInput
						buttons={[
							{
								text: __( 'Export', 'vulopilot' ),
								icon: 'export',
								color: 'border-purple',
								onClick: handleExport,
							},
							{
								text: isScanning
									? __( 'Starting…', 'vulopilot' )
									: __( 'Scan Again', 'vulopilot' ),
								icon: 'refresh',
								onClick: handleScan,
								disabled: isScanning,
							},
						]}
					/>
				</div>

					{0 === filteredRows.length ? (
						<ModuleGuardComponent
							icon="document"
							title={__( 'No pages found', 'vulopilot' )}
							desc={
								0 === rows.length
									? __(
											'No pages scanned yet — click "Scan Again" to check your real pages\' load times.',
											'vulopilot'
										)
									: __(
											'No pages match this filter.',
											'vulopilot'
										)
							}
						/>
					) : (
						<TableCard
							showMenu={false}
							headers={{
								title: {
									label: __( 'Page', 'vulopilot' ),
									render: (row: PageSpeedRow) => (
										<a href={row.url} target="_blank" rel="noopener noreferrer" className="page-speed-page-link">
											<i className={`adminfont-${PAGE_TYPE_ICONS[row.page_type] ?? 'document'}`} />
											{row.title}
										</a>
									),
								},
								page_type: {
									label: __( 'Type', 'vulopilot' ),
									render: (row: PageSpeedRow) => PAGE_TYPE_LABELS[row.page_type] ?? row.page_type,
								},
								...(hasDeviceScores
									? {
											mobile_score: {
												label: __( 'Mobile Score', 'vulopilot' ),
												render: (row: PageSpeedRow) => <ScorePill score={row.mobile_score} />,
											},
											desktop_score: {
												label: __( 'Desktop Score', 'vulopilot' ),
												render: (row: PageSpeedRow) => <ScorePill score={row.desktop_score} />,
											},
										}
									: {
											score: {
												label: __( 'Score', 'vulopilot' ),
												render: (row: PageSpeedRow) => <ScorePill score={row.score} />,
											},
										}),
								load_time_ms: {
									label: __( 'Load Time', 'vulopilot' ),
									render: (row: PageSpeedRow) =>
										null !== row.load_time_ms
											? sprintf( __( '%s s', 'vulopilot' ), (row.load_time_ms / 1000).toFixed(1) )
											: '—',
								},
								...(hasPsiDetail
									? {
											page_size_bytes: {
												label: (
													<TooltipComponent
														text={__( 'Total real page weight (Lighthouse total-byte-weight audit)', 'vulopilot' )}
													>
														{__( 'Page Size', 'vulopilot' )}
													</TooltipComponent>
												),
												render: (row: PageSpeedRow) => formatBytes(row.page_size_bytes),
											},
											requests_count: {
												label: (
													<TooltipComponent
														text={__( 'Real network requests observed (Lighthouse network-requests audit)', 'vulopilot' )}
													>
														{__( 'Requests', 'vulopilot' )}
													</TooltipComponent>
												),
												render: (row: PageSpeedRow) =>
													null !== row.requests_count ? row.requests_count : '—',
											},
											core_web_vitals: {
												label: (
													<TooltipComponent
														text={__( 'Real Chrome UX Report field data: Largest Contentful Paint / Interaction to Next Paint / Cumulative Layout Shift', 'vulopilot' )}
													>
														{__( 'Core Web Vitals', 'vulopilot' )}
													</TooltipComponent>
												),
												render: (row: PageSpeedRow) => <CoreWebVitalsDots row={row} />,
											},
										}
									: {}),
								main_issue: {
									label: __( 'Main Issue', 'vulopilot' ),
									cellClassName: 'page-speed-main-issue',
									render: (row: PageSpeedRow) => row.main_issue ?? '—',
								},
								action: {
									type: 'action',
									label: __( 'Action', 'vulopilot' ),
									actions: [
										{
											label: __( 'View Details', 'vulopilot' ),
											icon: 'eye',
											onClick: (row: PageSpeedRow) => setDetailRow(row),
										},
									],
								},
							}}
							rows={pageRows}
							ids={pageRows.map((row) => row.id)}
							totalRows={filteredRows.length}
							onQueryUpdate={(query: { paged?: number | string; per_page?: number | string }) => {
								setPaged(Number(query.paged) || 1);
								setPerPage(Number(query.per_page) || 10);
							}}
						/>
					)}
			</ColumnComponent>

			<ColumnComponent grid={4}>
				<CardComponent title={__( 'Why these pages are slow?', 'vulopilot' )} titleIcon="info">
					{0 === topIssues.length ? (
						<ModuleGuardComponent
							icon="check"
							title={__( 'No issues detected', 'vulopilot' )}
							desc={__(
								'Run a scan to check your real pages for common slowdown causes.',
								'vulopilot'
							)}
						/>
					) : (
						<ListComponent
							className="mini-card report"
							items={topIssues.slice(0, 5).map((item) => ({
								id: item.issue,
								title: item.issue,
								desc: sprintf(
									/* translators: %d is the number of real pages this real issue affects. */
									_n(
										'%d page affected',
										'%d pages affected',
										item.affected_pages,
										'vulopilot'
									),
									item.affected_pages
								),
							}))}
						/>
					)}
				</CardComponent>

				<RecommendedFixesCard topIssues={topIssues} />

				<CardComponent title={__( "What's considered slow?", 'vulopilot' )}>
					<ul className="page-speed-legend">
						<li>
							<span className="page-speed-legend-dot very-poor" />
							{__( 'Very Slow', 'vulopilot' )} <span className="page-speed-legend-range">0 – 24</span>
						</li>
						<li>
							<span className="page-speed-legend-dot poor" />
							{__( 'Slow', 'vulopilot' )} <span className="page-speed-legend-range">25 – 49</span>
						</li>
						<li>
							<span className="page-speed-legend-dot needs-improvement" />
							{__( 'Needs Improvement', 'vulopilot' )} <span className="page-speed-legend-range">50 – 79</span>
						</li>
						<li>
							<span className="page-speed-legend-dot good" />
							{__( 'Good', 'vulopilot' )} <span className="page-speed-legend-range">80 – 100</span>
						</li>
					</ul>
				</CardComponent>

				<NoticeComponent
					type="info"
					displayPosition="inline-notice"
					message={
						hasDeviceScores
							? __(
									'Scores are real per-page Google PageSpeed Insights results. Page size, requests, and Core Web Vitals are real Lighthouse/Chrome UX Report data from that same response.',
									'vulopilot'
								)
							: __(
									'Scores are derived from real measured page response times. Configure a Google PageSpeed Insights API key for real Mobile/Desktop scores, page size, requests, and Core Web Vitals instead.',
									'vulopilot'
								)
					}
					actionLabel={
						hasDeviceScores
							? undefined
							: __('Go to Settings', 'vulopilot')
					}
					onAction={
						hasDeviceScores
							? undefined
							: () => {
									window.location.href = PERFORMANCE_SETTINGS_URL;
								}
					}
				/>
			</ColumnComponent>

			<PopupComponent
				open={null !== detailRow}
				onClose={() => setDetailRow(null)}
				width={28}
				height="auto"
				position="lightbox"
				header={{ title: detailRow?.title ?? '' }}
			>
				{detailRow && (
					<FormGroupWrapperComponent>
						<FormGroupComponent row label={__( 'URL', 'vulopilot' )}>
							<a href={detailRow.url} target="_blank" rel="noopener noreferrer">
								{detailRow.url}
							</a>
						</FormGroupComponent>
						<FormGroupComponent row label={__( 'Type', 'vulopilot' )}>
							{PAGE_TYPE_LABELS[detailRow.page_type] ?? detailRow.page_type}
						</FormGroupComponent>
						<FormGroupComponent row label={__( 'Load Time', 'vulopilot' )}>
							{null !== detailRow.load_time_ms
								? sprintf( __( '%s s', 'vulopilot' ), (detailRow.load_time_ms / 1000).toFixed(2) )
								: '—'}
						</FormGroupComponent>
						{hasDeviceScores ? (
							<>
								<FormGroupComponent row label={__( 'Mobile Score', 'vulopilot' )}>
									<ScorePill score={detailRow.mobile_score} />
								</FormGroupComponent>
								<FormGroupComponent row label={__( 'Desktop Score', 'vulopilot' )}>
									<ScorePill score={detailRow.desktop_score} />
								</FormGroupComponent>
							</>
						) : (
							<FormGroupComponent row label={__( 'Score', 'vulopilot' )}>
								<ScorePill score={detailRow.score} />
							</FormGroupComponent>
						)}
						{hasPsiDetail && (
							<>
								<FormGroupComponent row label={__( 'Page Size', 'vulopilot' )}>
									{formatBytes(detailRow.page_size_bytes)}
								</FormGroupComponent>
								<FormGroupComponent row label={__( 'Requests', 'vulopilot' )}>
									{null !== detailRow.requests_count ? detailRow.requests_count : '—'}
								</FormGroupComponent>
								<FormGroupComponent row label={__( 'Core Web Vitals', 'vulopilot' )}>
									<CoreWebVitalsDots row={detailRow} />
								</FormGroupComponent>
							</>
						)}
						<FormGroupComponent row label={__( 'Main Issue', 'vulopilot' )}>
							{detailRow.main_issue ?? __( 'None detected', 'vulopilot' )}
						</FormGroupComponent>
						<FormGroupComponent row label={__( 'Last Scanned', 'vulopilot' )}>
							{formatWpDate(detailRow.scanned_at)}
						</FormGroupComponent>
					</FormGroupWrapperComponent>
				)}
			</PopupComponent>
		</>
	);
};

export default SlowPagesTab;
