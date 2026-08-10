/* global appLocalizer */
import { useEffect, useState } from 'react';
import { __ } from '@wordpress/i18n';
import { applyFilters } from '@wordpress/hooks';
import type { ComponentType } from 'react';
import { getApiLink, getApiResponse } from '@zyra/core';
import {
	CardComponent,
	ColumnComponent,
	ModuleGuardComponent,
	PopupComponent,
} from '@zyra/components';
import { ButtonInput } from '@zyra/inputs';
import ShowProPopup from '../../components/Popup/Popup';
import HistoryDetailPanel from './HistoryDetailPanel';
import {
	FILTER_TABS,
	groupByDay,
	HistoryFilter,
	HistoryRow,
	rowBadge,
	rowIcon,
	rowTitle,
} from './historyTypes';
import './AICopilot.scss';

interface HistoryResponse {
	data: HistoryRow[];
	total: number;
	type_counts: Record<HistoryFilter, number>;
}

type DateRangePreset = 'all' | 'today' | '7d' | '30d';

const DATE_RANGE_OPTIONS: { value: DateRangePreset; label: string }[] = [
	{ value: 'all', label: __('All time', 'vulopilot') },
	{ value: 'today', label: __('Today', 'vulopilot') },
	{ value: '7d', label: __('Last 7 days', 'vulopilot') },
	{ value: '30d', label: __('Last 30 days', 'vulopilot') },
];

/**
 * Real `date_from` (Y-m-d), computed client-side from a preset — 'today'
 * also needs a `date_to` of today since the backend's own `date_to` filter
 * is otherwise unbounded going forward, but a MySQL datetime `created_at`
 * is never in the future anyway, so only 'today' actually needs it set.
 */
const resolveDateFrom = (preset: DateRangePreset): string | undefined => {
	if ('all' === preset) {
		return undefined;
	}

	const days = { today: 0, '7d': 6, '30d': 29 }[preset];
	const date = new Date();
	date.setDate(date.getDate() - days);

	return date.toISOString().slice(0, 10);
};

/**
 * Slot for vulopilot-pro's AdvancedReports module — a per-provider cost/
 * token/success-rate breakdown of this same history table. History logging
 * itself stays free (Free's own 9 built-in AI actions write here too, via
 * UsageTrackingProvider, regardless of Pro), so only this extra analytics
 * panel is Pro-gated, not the table above it. Same "register a source,
 * don't modify the host" pattern already used for
 * `vulopilot_reports_advanced_panel`. Shows a locked placeholder (below,
 * `AiAnalyticsLockedCard`) that opens the Pro popup on click when Pro/that
 * module isn't active, rather than rendering nothing.
 */
const AiAnalyticsPanel = applyFilters(
	'vulopilot_ai_assistant_pro_panel',
	null
) as ComponentType | null;

/**
 * Visible teaser for the analytics panel above — shown instead of it when
 * `AiAnalyticsPanel` isn't registered, so the feature is discoverable
 * rather than simply absent.
 */
const AiAnalyticsLockedCard = () => {
	const [isProPopupOpen, setIsProPopupOpen] = useState(false);

	return (
		<>
			<CardComponent
				title={__('AI cost & provider breakdown', 'vulopilot')}
				desc={__(
					'A per-provider cost, token, and success-rate breakdown of the history above.',
					'vulopilot'
				)}
			>
				<ButtonInput
					buttons={{
						text: __('Unlock with Pro', 'vulopilot'),
						icon: 'lock',
						onClick: () => setIsProPopupOpen(true),
					}}
				/>
			</CardComponent>
			<PopupComponent
				open={isProPopupOpen}
				onClose={() => setIsProPopupOpen(false)}
				width={31.25}
				height="auto"
				position="lightbox"
			>
				{appLocalizer.khali_dabba ? (
					// Pro is active — this specific module just isn't
					// toggled on yet, so point at Modules rather than
					// pitching an upgrade the user already has.
					<ShowProPopup moduleName="advanced-reports" />
				) : (
					<ShowProPopup />
				)}
			</PopupComponent>
		</>
	);
};

const EMPTY_TYPE_COUNTS: Record<HistoryFilter, number> = {
	all: 0,
	conversation: 0,
	scan: 0,
	change: 0,
	automation: 0,
};

/**
 * AI Copilot's History tab — a real, day-grouped activity timeline built
 * from `GET /history` (Controllers/History.php), which scopes
 * `vulopilot_activity_logs` to only real scan/AI-action events and joins
 * each row back to its source table for real detail (a scan's real
 * per-severity finding counts, an AI action's real before/after text —
 * see that controller's own docblock for why `message` alone isn't
 * enough). "Conversations"/"Automations" are real filter pills with an
 * honest empty state today: chat has no backend yet, and no automation
 * execution engine exists in this codebase (Automations.php's own
 * `run_item()` is a hard 501) — see historyTypes.ts.
 */
const HistoryTab = () => {
	const [activeFilter, setActiveFilter] = useState<HistoryFilter>('all');
	const [rawSearch, setRawSearch] = useState('');
	const [search, setSearch] = useState('');
	const [dateRange, setDateRange] = useState<DateRangePreset>('all');

	const [rows, setRows] = useState<HistoryRow[]>([]);
	const [total, setTotal] = useState(0);
	const [typeCounts, setTypeCounts] =
		useState<Record<HistoryFilter, number>>(EMPTY_TYPE_COUNTS);
	const [page, setPage] = useState(1);
	const [isLoading, setIsLoading] = useState(true);
	const [isLoadingMore, setIsLoadingMore] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [selectedRow, setSelectedRow] = useState<HistoryRow | null>(null);

	// Debounced so typing doesn't fire one request per keystroke.
	useEffect(() => {
		const timeout = window.setTimeout(() => setSearch(rawSearch), 400);

		return () => window.clearTimeout(timeout);
	}, [rawSearch]);

	const fetchPage = (targetPage: number, append: boolean) => {
		(append ? setIsLoadingMore : setIsLoading)(true);
		setError(null);

		const params = new URLSearchParams();
		params.set('page', String(targetPage));
		params.set('per_page', '20');

		if ('all' !== activeFilter) {
			params.set('type', activeFilter);
		}

		if (search) {
			params.set('search', search);
		}

		const dateFrom = resolveDateFrom(dateRange);

		if (dateFrom) {
			params.set('date_from', dateFrom);

			if ('today' === dateRange) {
				params.set('date_to', dateFrom);
			}
		}

		const baseUrl = getApiLink(appLocalizer, 'history');
		const separator = baseUrl.includes('?') ? '&' : '?';
		const url = `${baseUrl}${separator}${params.toString()}`;

		getApiResponse<HistoryResponse>(url, {
			headers: { 'X-WP-Nonce': appLocalizer.nonce },
		})
			.then((response) => {
				if (!response) {
					setError(
						__(
							'Something went wrong while loading history.',
							'vulopilot'
						)
					);
					return;
				}

				const nextRows = append
					? [...rows, ...(response.data ?? [])]
					: (response.data ?? []);

				setRows(nextRows);
				setTotal(response.total ?? 0);
				setTypeCounts({
					...EMPTY_TYPE_COUNTS,
					...response.type_counts,
				});

				if (!append) {
					setSelectedRow(nextRows[0] ?? null);
				}
			})
			.finally(() => {
				setIsLoading(false);
				setIsLoadingMore(false);
			});
	};

	useEffect(() => {
		setPage(1);
		fetchPage(1, false);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [activeFilter, search, dateRange]);

	const handleLoadMore = () => {
		const nextPage = page + 1;
		setPage(nextPage);
		fetchPage(nextPage, true);
	};

	const handleDelete = (row: HistoryRow) => {
		setRows((current) => current.filter((r) => r.id !== row.id));
		setTotal((current) => Math.max(0, current - 1));

		if (selectedRow?.id === row.id) {
			setSelectedRow(null);
		}
	};

	/**
	 * Every field here is already real (loaded, not re-fetched) — this is
	 * a real client-side export of what's currently on screen, not a
	 * fabricated "full export" the backend has no route for.
	 */
	const handleExport = () => {
		const header = ['Date', 'Type', 'Title', 'Details'];
		const csvRows = rows.map((row) => [
			row.created_at,
			row.category,
			rowTitle(row),
			row.message,
		]);

		const csv = [header, ...csvRows]
			.map((line) =>
				line
					.map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
					.join(',')
			)
			.join('\n');

		const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
		const url = URL.createObjectURL(blob);
		const link = document.createElement('a');
		link.href = url;
		link.download = 'vulopilot-history.csv';
		link.click();
		URL.revokeObjectURL(url);
	};

	const dayGroups = groupByDay(rows);

	return (
		<>
			<ColumnComponent grid={8}>
				<div className="history-page-header">
					<h2 className="history-page-title">
						{__('History', 'vulopilot')}
					</h2>
					<p className="history-page-desc">
						{__(
							'Everything VuloPilot has scanned, changed, or applied. Use filters to find exactly what you need.',
							'vulopilot'
						)}
					</p>
				</div>

				<div className="issues-category-tabs history-filter-tabs">
					{FILTER_TABS.map((tab) => (
						<span
							key={tab.id}
							className={`issues-category-tab ${tab.id === activeFilter ? 'active' : ''}`}
							onClick={() => setActiveFilter(tab.id)}
						>
							{tab.label}
							{typeCounts[tab.id] > 0 && (
								<span className="issues-category-tab-count">
									{typeCounts[tab.id]}
								</span>
							)}
						</span>
					))}
				</div>

				<div className="history-toolbar">
					<input
						type="search"
						className="history-search-input"
						placeholder={__('Search history…', 'vulopilot')}
						value={rawSearch}
						onChange={(event) =>
							setRawSearch(event.target.value)
						}
					/>
					{/* A plain native <select>, not zyra's SelectInput —
					that component is a react-select wrapper built for
					searchable/multi/creatable pickers (isMulti,
					isClearable, formatCreateLabel), which is the wrong
					tool for 4 fixed date-range options. */}
					<select
						className="history-date-range-select"
						aria-label={__('Date range', 'vulopilot')}
						value={dateRange}
						onChange={(event) =>
							setDateRange(
								event.target.value as DateRangePreset
							)
						}
					>
						{DATE_RANGE_OPTIONS.map((option) => (
							<option key={option.value} value={option.value}>
								{option.label}
							</option>
						))}
					</select>
					<ButtonInput
						buttons={{
							text: __('Export', 'vulopilot'),
							icon: 'download',
							color: 'secondary',
							onClick: handleExport,
							disabled: 0 === rows.length,
						}}
					/>
				</div>

				{error ? (
					<ModuleGuardComponent
						icon="error"
						title={__('Could not load history', 'vulopilot')}
						desc={error}
						buttonText={__('Retry', 'vulopilot')}
						onButtonClick={() => fetchPage(1, false)}
					/>
				) : !isLoading && rows.length === 0 ? (
					<ModuleGuardComponent
						icon="check"
						title={
							'conversation' === activeFilter
								? __(
										'No conversations yet',
										'vulopilot'
									)
								: 'automation' === activeFilter
									? __(
											'No automation history yet',
											'vulopilot'
										)
									: __('Nothing here yet', 'vulopilot')
						}
						desc={
							'conversation' === activeFilter
								? __(
										"AI chat isn't connected yet — once it is, your conversations will show up here.",
										'vulopilot'
									)
								: 'automation' === activeFilter
									? __(
											"No automation has run yet — automated workflows will show up here once they do.",
											'vulopilot'
										)
									: __(
											'Scans and AI changes will show up here as VuloPilot works.',
											'vulopilot'
										)
						}
					/>
				) : (
					<div className="history-timeline">
						{dayGroups.map((group) => (
							<div
								className="history-day-group"
								// Real data is always ordered `created_at
								// DESC`, so same-day rows are always
								// contiguous and `group.label` alone would
								// never collide — keyed on the group's own
								// first row id anyway, since that's true
								// regardless of ordering, not just true
								// today.
								key={group.rows[0]?.id ?? group.label}
							>
								<div className="history-day-heading">
									{group.label}
								</div>
								{group.rows.map((row) => {
									const badge = rowBadge(row);

									return (
										<div
											key={row.id}
											className={`history-row ${selectedRow?.id === row.id ? 'selected' : ''}`}
											role="button"
											tabIndex={0}
											onClick={() =>
												setSelectedRow(row)
											}
										>
											<i
												className={`history-row-icon adminfont-${rowIcon(row)}`}
											/>
											<div className="history-row-text">
												<div className="history-row-title">
													{rowTitle(row)}
												</div>
												<div className="history-row-desc">
													{row.message}
												</div>
												<span
													className={`admin-badge ${badge.className}`}
												>
													{badge.text}
												</span>
											</div>
											<i
												className="adminfont-arrow-right history-row-arrow"
												role="button"
												tabIndex={0}
												onClick={(event) => {
													event.stopPropagation();
													setSelectedRow(row);
												}}
											/>
										</div>
									);
								})}
							</div>
						))}

						{rows.length < total && (
							<div className="history-load-more">
								<ButtonInput
									buttons={{
										text: isLoadingMore
											? __('Loading…', 'vulopilot')
											: __('Load more', 'vulopilot'),
										color: 'secondary',
										onClick: handleLoadMore,
										disabled: isLoadingMore,
									}}
								/>
							</div>
						)}
					</div>
				)}

				{AiAnalyticsPanel ? (
					<AiAnalyticsPanel />
				) : (
					<AiAnalyticsLockedCard />
				)}
			</ColumnComponent>

			<ColumnComponent grid={4}>
				<HistoryDetailPanel
					row={selectedRow}
					onClose={() => setSelectedRow(null)}
					onDeleted={handleDelete}
				/>
			</ColumnComponent>
		</>
	);
};

export default HistoryTab;
