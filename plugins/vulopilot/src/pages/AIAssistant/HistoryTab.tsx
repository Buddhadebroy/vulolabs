/* global appLocalizer */
import { useEffect, useState } from 'react';
import { __, _n, sprintf } from '@wordpress/i18n';
import { applyFilters } from '@wordpress/hooks';
import type { ComponentType } from 'react';
import { getApiLink, getApiResponse } from '@zyra/core';
import {
	CardComponent,
	ColumnComponent,
	ModuleGuardComponent,
	PopupComponent,
	ContainerComponent
} from '@zyra/components';
import { ButtonInput, TextInput, SelectInput } from '@zyra/inputs'; 
import ShowProPopup from '../../components/Popup/Popup';
import HistoryDetailPanel from './HistoryDetailPanel';
import {
	FILTER_TABS,
	groupByDay,
	HistoryFilter,
	HistoryRow,
	rowIcon,
	rowStatusBadge,
	rowTag,
	rowTime,
	rowTitle,
} from './historyTypes';
import './AICopilot.scss';
import '../../components/common.scss';

interface HistoryResponse {
	data: HistoryRow[];
	total: number;
	type_counts: Record<HistoryFilter, number>;
}

type DateRangePreset = 'all' | 'today' | '7d' | '30d';

const DATE_RANGE_OPTIONS = [
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

	// Debounced search using useEffect
	useEffect(() => {
		const timeout = window.setTimeout(() => {
			// The search value is already in state, we just need to trigger fetch
			fetchPage(1, false);
		}, 400);

		return () => window.clearTimeout(timeout);
	}, [search]); // Search changes trigger this

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
	}, [activeFilter, dateRange]);

	// Separate effect for search to handle debouncing
	useEffect(() => {
		const timeout = window.setTimeout(() => {
			if (search !== undefined) {
				setPage(1);
				fetchPage(1, false);
			}
		}, 400);

		return () => window.clearTimeout(timeout);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [search]);

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

	// Format options for SelectInput
	const dateRangeSelectOptions = DATE_RANGE_OPTIONS.map(opt => ({
		value: opt.value,
		label: opt.label
	}));

	// Handle search change from TextInput
	const handleSearchChange = (value: string | number | FileList) => {
		// Ensure we're working with a string
		const searchValue = typeof value === 'string' ? value : String(value);
		setSearch(searchValue);
	};

	// Handle date range change from SelectInput
	const handleDateRangeChange = (value: string | string[]) => {
		// Ensure we're working with a single string value
		const newRange = Array.isArray(value) ? value[0] : value;
		if (newRange && DATE_RANGE_OPTIONS.some(opt => opt.value === newRange)) {
			setDateRange(newRange as DateRangePreset);
		}
	};

	return (
		<ContainerComponent>
			<ColumnComponent grid={8}>
			<CardComponent title={__('History', 'vulopilot')} desc={__('Everything VuloPilot has scanned, changed, or applied. Use filters to find exactly what you need.', 'vulopilot')}>
				<div className='filter-wrapper'>
					<div className="category-filter">
						{FILTER_TABS.map((tab) => (
							<span
								key={tab.id}
								className={`category-item  ${tab.id === activeFilter ? 'active' : ''}`}
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

					<TextInput
						type="text"
						name="history-search"
						placeholder={__('Search history…', 'vulopilot')}
						value={search}
						size={20}
						onChange={handleSearchChange}
						inputClass="history-search-input"
						wrapperClass="history-search-wrapper"
					/>

					<SelectInput
						type="single-select"
						options={dateRangeSelectOptions}
						size={15}
						value={dateRange}
						onChange={handleDateRangeChange}
						placeholder={__('Select date range', 'vulopilot')}
						isClearable={false}
					/>

					<ButtonInput
						buttons={{
							text: __('Export', 'vulopilot'),
							icon: 'download',
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
								key={group.rows[0]?.id ?? group.label}
							>
								<div className="history-day title">
									{group.label}
								</div>
								{group.rows.map((row) => {
									const tag = rowTag(row);
									const statusBadge = rowStatusBadge(row);
									const showBeforeAfter =
										row.change &&
										null !== row.change.after &&
										row.change.after.length <= 40 &&
										(null === row.change.before ||
											row.change.before.length <= 40);

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
											<span className="history-row-time">
												{rowTime(row.created_at)}
											</span>

											<div className='history-details'>
												<i
													className={`history-row-icon adminfont-${rowIcon(row)}`}
												/>
												<div className="history-row-text">
													<div className="history-row-title title">
														{rowTitle(row)}
														<span
															className={`admin-badge ${tag.className}`}
														>
															{tag.text}
														</span>
													</div>
													<div className="desc">
														{row.message}
													</div>
												</div>
												<div className="history-row-meta">
													{row.scan && (
														<span className="history-row-meta-value">
															{sprintf(
																_n(
																	'%d issue found',
																	'%d issues found',
																	row.scan.total,
																	'vulopilot'
																),
																row.scan.total
															)}
														</span>
													)}
													{showBeforeAfter && (
														<span className="history-row-meta-value">
															{sprintf(
																__(
																	'Before: %1$s · After: %2$s',
																	'vulopilot'
																),
																row.change?.before ||
																	__(
																		'(new content)',
																		'vulopilot'
																	),
																row.change?.after
															)}
														</span>
													)}
													{statusBadge && (
														<span
															className={`admin-badge ${statusBadge.className}`}
														>
															{statusBadge.text}
														</span>
													)}
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
										</div>
									);
								})}
							</div>
						))}

						{rows.length < total && (
							<ButtonInput
								position="center"
								buttons={{
									text: isLoadingMore
										? __('Loading…', 'vulopilot')
										: __('Load more', 'vulopilot'),
									color: 'purple-bg',
									onClick: handleLoadMore,
									disabled: isLoadingMore,
								}}
							/>
						)}
					</div>
				)}
			</CardComponent>
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
		</ContainerComponent>
	);
};

export default HistoryTab;