/* global appLocalizer */
import { useEffect, useMemo, useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { getApiLink, getApiResponse, sendApiResponse } from '@zyra/core';
import {
	CardComponent,
	ColumnComponent,
	ContainerComponent,
	ModuleGuardComponent,
	NoticeManager,
	PopupComponent,
} from '@zyra/components';
import { SelectInput, TextInput } from '@zyra/inputs';
import './ImproveSpeed.scss';

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
	scanned_at: string;
}

interface PageSpeedSummary {
	total: number;
	slow: number;
	needs_improvement: number;
	good: number;
	avg_mobile_score: number | null;
	last_scanned_at: string | null;
}

interface PageSpeedResponse {
	summary: PageSpeedSummary;
	status_counts: Record<string, number>;
	data: PageSpeedRow[];
	total: number;
}

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

const csvEscape = ( value: string ): string => `"${ value.replace( /"/g, '""' ) }"`;

/**
 * "Slow Pages" tab of "Improve Speed" — real per-page speed data from
 * `GET /page-speed` (Repositories\PageSpeedRepository, populated in the
 * background by Services\PageSpeedScanner). Fetched once per mount/scan
 * (this plugin's own page counts are bounded — see PageSpeedScanner's own
 * MAX_PER_TYPE — so client-side filter/search/sort is simpler than wiring
 * up TableCard, whose fixed header `type`s (text/currency/date/badge/
 * action/id/content/status) can't render this mockup's colored score pill
 * + mini threshold bar per cell).
 *
 * Mobile/Desktop columns only appear once at least one real row has a
 * `mobile_score` — i.e. once a `psi_api_key` is configured and the
 * background scan has reached that row — otherwise a single real "Score"
 * column is shown, same PSI-key-gated fallback PerformanceScoreCard.tsx's
 * own Overall Speed Score card already uses; never a fabricated split.
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

	const statusCounts = response?.status_counts ?? {};
	const summary = response?.summary ?? null;

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
		const headerRow = hasDeviceScores
			? ['Page', 'URL', 'Type', 'Mobile Score', 'Desktop Score', 'Load Time (ms)', 'Main Issue']
			: ['Page', 'URL', 'Type', 'Score', 'Load Time (ms)', 'Main Issue'];

		const lines = [headerRow.map(csvEscape).join(',')];

		filteredRows.forEach((row) => {
			const cells = hasDeviceScores
				? [
						row.title,
						row.url,
						PAGE_TYPE_LABELS[row.page_type] ?? row.page_type,
						row.mobile_score ?? '',
						row.desktop_score ?? '',
						row.load_time_ms ?? '',
						row.main_issue ?? '',
					]
				: [
						row.title,
						row.url,
						PAGE_TYPE_LABELS[row.page_type] ?? row.page_type,
						row.score ?? '',
						row.load_time_ms ?? '',
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
				<p className="page-speed-intro">
					{__(
						'These pages are loading slowly and need your attention.',
						'vulopilot'
					)}
				</p>

				<div className="page-speed-summary-tiles">
					<CardComponent className="page-speed-summary-tile" isLoading={isLoading}>
						<i className="page-speed-summary-icon adminfont-document" />
						<div className="page-speed-summary-value">{summary?.total ?? 0}</div>
						<div className="page-speed-summary-label">{__( 'Total Pages Scanned', 'vulopilot' )}</div>
					</CardComponent>
					<CardComponent className="page-speed-summary-tile" isLoading={isLoading}>
						<i className="page-speed-summary-icon adminfont-error" />
						<div className="page-speed-summary-value poor">{summary?.slow ?? 0}</div>
						<div className="page-speed-summary-label">{__( 'Slow Pages', 'vulopilot' )}</div>
					</CardComponent>
					<CardComponent className="page-speed-summary-tile" isLoading={isLoading}>
						<i className="page-speed-summary-icon adminfont-check" />
						<div className="page-speed-summary-value good">{summary?.good ?? 0}</div>
						<div className="page-speed-summary-label">{__( 'Good Pages', 'vulopilot' )}</div>
					</CardComponent>
					<CardComponent className="page-speed-summary-tile" isLoading={isLoading}>
						<i className="page-speed-summary-icon adminfont-form-phone" />
						<div className="page-speed-summary-value">
							{null !== summary?.avg_mobile_score ? summary?.avg_mobile_score : '—'}
						</div>
						<div className="page-speed-summary-label">
							{hasDeviceScores
								? __( 'Average Mobile Score', 'vulopilot' )
								: __( 'Average Score', 'vulopilot' )}
						</div>
					</CardComponent>
				</div>

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
					</div>
					<div className="page-speed-toolbar-actions">
						<SelectInput
							name="page_type_filter"
							value={pageTypeFilter}
							options={pageTypeOptions}
							onChange={(value) => setPageTypeFilter(value as string)}
							size="12rem"
						/>
						<TextInput
							name="page_speed_search"
							placeholder={__( 'Search pages…', 'vulopilot' )}
							value={searchTerm}
							onChange={(value) => setSearchTerm(value as string)}
						/>
						<button type="button" className="page-speed-export-button" onClick={handleExport}>
							<i className="adminfont-export" />
							{__( 'Export', 'vulopilot' )}
						</button>
						<button
							type="button"
							className="page-speed-scan-button"
							onClick={handleScan}
							disabled={isScanning}
						>
							<i className={`adminfont-refresh ${isScanning ? 'is-spinning' : ''}`} />
							{isScanning ? __( 'Starting…', 'vulopilot' ) : __( 'Scan Again', 'vulopilot' )}
						</button>
					</div>
				</div>

				<CardComponent isLoading={isLoading}>
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
						<div className="page-speed-table-wrap">
							<table className="page-speed-table">
								<thead>
									<tr>
										<th>{__( 'Page', 'vulopilot' )}</th>
										<th>{__( 'Type', 'vulopilot' )}</th>
										{hasDeviceScores ? (
											<>
												<th>{__( 'Mobile Score', 'vulopilot' )}</th>
												<th>{__( 'Desktop Score', 'vulopilot' )}</th>
											</>
										) : (
											<th>{__( 'Score', 'vulopilot' )}</th>
										)}
										<th>{__( 'Load Time', 'vulopilot' )}</th>
										<th>{__( 'Main Issue', 'vulopilot' )}</th>
										<th>{__( 'Action', 'vulopilot' )}</th>
									</tr>
								</thead>
								<tbody>
									{filteredRows.map((row) => (
										<tr key={row.id}>
											<td>
												<a href={row.url} target="_blank" rel="noopener noreferrer" className="page-speed-page-link">
													<i className={`adminfont-${PAGE_TYPE_ICONS[row.page_type] ?? 'document'}`} />
													{row.title}
												</a>
											</td>
											<td>{PAGE_TYPE_LABELS[row.page_type] ?? row.page_type}</td>
											{hasDeviceScores ? (
												<>
													<td><ScorePill score={row.mobile_score} /></td>
													<td><ScorePill score={row.desktop_score} /></td>
												</>
											) : (
												<td><ScorePill score={row.score} /></td>
											)}
											<td>
												{null !== row.load_time_ms
													? sprintf( __( '%s s', 'vulopilot' ), (row.load_time_ms / 1000).toFixed(1) )
													: '—'}
											</td>
											<td className="page-speed-main-issue">{row.main_issue ?? '—'}</td>
											<td>
												<button
													type="button"
													className="page-speed-view-details"
													onClick={() => setDetailRow(row)}
												>
													{__( 'View Details', 'vulopilot' )}
												</button>
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					)}
				</CardComponent>
			</ColumnComponent>

			<ColumnComponent grid={4}>
				<CardComponent title={__( 'Why these pages matter', 'vulopilot' )} titleIcon="info">
					<p className="page-speed-sidebar-desc">
						{__(
							'Slower pages can frustrate visitors and affect your search rankings.',
							'vulopilot'
						)}
					</p>
					<ul className="page-speed-sidebar-list">
						<li>
							<strong>{__( 'Poor user experience', 'vulopilot' )}</strong>
							<span>{__( 'Visitors may leave your site.', 'vulopilot' )}</span>
						</li>
						<li>
							<strong>{__( 'Lower conversions', 'vulopilot' )}</strong>
							<span>{__( 'Slow pages reduce sales and signups.', 'vulopilot' )}</span>
						</li>
						<li>
							<strong>{__( 'Search ranking impact', 'vulopilot' )}</strong>
							<span>{__( 'Speed is a ranking factor for Google.', 'vulopilot' )}</span>
						</li>
					</ul>
				</CardComponent>

				<CardComponent title={__( "What's considered slow?", 'vulopilot' )}>
					<ul className="page-speed-legend">
						<li>
							<span className="page-speed-legend-dot poor" />
							{__( 'Poor', 'vulopilot' )} <span className="page-speed-legend-range">0 – 49</span>
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

				<CardComponent>
					<p className="page-speed-disclaimer">
						{hasDeviceScores
							? __(
									'Scores are real per-page Google PageSpeed Insights results.',
									'vulopilot'
								)
							: __(
									'Scores are derived from real measured page response times. Configure a Google PageSpeed Insights API key in Settings → Scanning → Performance for real Mobile/Desktop scores instead.',
									'vulopilot'
								)}
					</p>
				</CardComponent>
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
					<div className="page-speed-detail">
						<a href={detailRow.url} target="_blank" rel="noopener noreferrer">
							{detailRow.url}
						</a>
						<div className="page-speed-detail-row">
							<span>{__( 'Type', 'vulopilot' )}</span>
							<span>{PAGE_TYPE_LABELS[detailRow.page_type] ?? detailRow.page_type}</span>
						</div>
						<div className="page-speed-detail-row">
							<span>{__( 'Load Time', 'vulopilot' )}</span>
							<span>
								{null !== detailRow.load_time_ms
									? sprintf( __( '%s s', 'vulopilot' ), (detailRow.load_time_ms / 1000).toFixed(2) )
									: '—'}
							</span>
						</div>
						{hasDeviceScores ? (
							<>
								<div className="page-speed-detail-row">
									<span>{__( 'Mobile Score', 'vulopilot' )}</span>
									<span><ScorePill score={detailRow.mobile_score} /></span>
								</div>
								<div className="page-speed-detail-row">
									<span>{__( 'Desktop Score', 'vulopilot' )}</span>
									<span><ScorePill score={detailRow.desktop_score} /></span>
								</div>
							</>
						) : (
							<div className="page-speed-detail-row">
								<span>{__( 'Score', 'vulopilot' )}</span>
								<span><ScorePill score={detailRow.score} /></span>
							</div>
						)}
						<div className="page-speed-detail-row">
							<span>{__( 'Main Issue', 'vulopilot' )}</span>
							<span>{detailRow.main_issue ?? __( 'None detected', 'vulopilot' )}</span>
						</div>
						<div className="page-speed-detail-row">
							<span>{__( 'Last Scanned', 'vulopilot' )}</span>
							<span>{detailRow.scanned_at}</span>
						</div>
					</div>
				)}
			</PopupComponent>
		</>
	);
};

export default SlowPagesTab;
