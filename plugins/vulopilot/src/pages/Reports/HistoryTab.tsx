/* global vulopilotAppLocalizer */
import { useEffect, useRef, useState } from 'react';
import { __ } from '@wordpress/i18n';
import { getApiLink, getApiResponse, scrollToId } from '@zyra/core';
import {
	CardComponent,
	ColumnComponent,
	ModuleGuardComponent,
	ContainerComponent,
} from '@zyra/components';
import { ButtonInput, TextInput, SelectInput } from '@zyra/inputs';
import HistoryDetailPanel from './HistoryDetailPanel';
import HistoryTimeline from './HistoryTimeline';
import {
	FILTER_TABS,
	HistoryFilter,
	HistoryRow,
	rowTitle,
} from '../../services/historyTypes';
// Reports' own page moved here from AI Copilot (History is a general activity timeline, not
// specific to that page's own conversational surface).
import '../AIAssistant/AICopilot.scss';
import '../../components/common.scss';
import './Reports.scss';

interface HistoryResponse {
	data: HistoryRow[];
	total: number;
	type_counts: Record<HistoryFilter, number>;
	/** How many pages of `per_page` rows this response actually covers. */
	pages_loaded?: number;
}

type DateRangePreset = 'all' | 'today' | '7d' | '30d';

const DATE_RANGE_OPTIONS = [
	{ value: 'all', label: __('All time', 'vulopilot') },
	{ value: 'today', label: __('Today', 'vulopilot') },
	{ value: '7d', label: __('7D', 'vulopilot') },
	{ value: '30d', label: __('30D', 'vulopilot') },
];

/**
 * Real `date_from` (Y-m-d), computed client-side from a preset.
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
 * RecentActivityWidget.tsx's (Dashboard tab) own "Recent activity" arrow lands here with a real
 * `?vulopilot_history_id=`.
 */
const getDeepLinkHistoryId = (): number | null => {
	const params = new URLSearchParams(
		window.location.hash.split('?')[1] || window.location.hash.substring(1)
	);
	const idParam = params.get('vulopilot_history_id');
	const parsed = idParam ? Number(idParam) : NaN;

	return Number.isFinite(parsed) ? parsed : null;
};

const EMPTY_TYPE_COUNTS: Record<HistoryFilter, number> = {
	all: 0,
	conversation: 0,
	scan: 0,
	change: 0,
	automations: 0,
};

/**
 * Reports' History tab - a real, day-grouped activity timeline built from `GET /history`
 * (Controllers/History.php).
 */
const HistoryTab = () => {
	const [activeFilter, setActiveFilter] = useState<HistoryFilter>('all');
	const [search, setSearch] = useState('');
	// Defaults to the last 30 days rather than 'all'.
	const [dateRange, setDateRange] = useState<DateRangePreset>(() =>
		getDeepLinkHistoryId() ? 'all' : '30d'
	);

	const [rows, setRows] = useState<HistoryRow[]>([]);
	const [total, setTotal] = useState(0);
	const [typeCounts, setTypeCounts] =
		useState<Record<HistoryFilter, number>>(EMPTY_TYPE_COUNTS);
	const [page, setPage] = useState(1);
	const [isLoading, setIsLoading] = useState(true);
	const [isLoadingMore, setIsLoadingMore] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [selectedRow, setSelectedRow] = useState<HistoryRow | null>(null);
	/** Set post-mount by handleSelectRelatedAction() below (jumping to a related "change" row from within the panel). */
	const pendingSelectId = useRef<number | null>(getDeepLinkHistoryId());
	/** The real deep-linked id itself, kept separately from `pendingSelectId` (which gets consumed/cleared by `fetchPage()`). */
	const deepLinkRowId = useRef<number | null>(getDeepLinkHistoryId());
	const hasScrolledToDeepLinkRef = useRef(false);

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

		// A deep-linked row can sit many pages down (one scan logs a row per scanner), so ask the
		// server for everything down through it.
		if (
			!append &&
			deepLinkRowId.current &&
			'all' === activeFilter &&
			'all' === dateRange &&
			!search
		) {
			params.set('around_id', String(deepLinkRowId.current));
		}

		const dateFrom = resolveDateFrom(dateRange);

		if (dateFrom) {
			params.set('date_from', dateFrom);

			if ('today' === dateRange) {
				params.set('date_to', dateFrom);
			}
		}

		const baseUrl = getApiLink(vulopilotAppLocalizer, 'history');
		const separator = baseUrl.includes('?') ? '&' : '?';
		const url = `${baseUrl}${separator}${params.toString()}`;

		getApiResponse<HistoryResponse>(url, {
			headers: { 'X-WP-Nonce': vulopilotAppLocalizer.nonce },
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
					// Keeps "Load more" paging on from where the (possibly
					// extended) first response ended.
					setPage(response.pages_loaded ?? 1);

					const wantedId = pendingSelectId.current;
					pendingSelectId.current = null;

					const wantedRow = wantedId
						? nextRows.find((row) => String(row.id) === String(wantedId))
						: undefined;

					// A refetch with nothing pending (this tab fires a few on mount - filter
					// change, then the debounced search effect) keeps whatever row is already open
					// instead of snapping back to the first one.
					setSelectedRow(
						(current) =>
							wantedRow ??
							nextRows.find((row) => row.id === current?.id) ??
							nextRows[0] ??
							null
					);
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
	}, [activeFilter, dateRange]);

	// `?vulopilot_history_id=` deep-link arrival (this file's own top docblock).
	useEffect(() => {
		if (!deepLinkRowId.current || hasScrolledToDeepLinkRef.current) {
			return;
		}

		// `GET /history` returns `id` as a string (raw DB row), the deep link's is a number - compare as strings.
		const match = rows.find(
			(row) => String(row.id) === String(deepLinkRowId.current)
		);

		if (!match) {
			return;
		}

		hasScrolledToDeepLinkRef.current = true;
		const element = document.getElementById(
			`vulopilot-history-row-${match.id}`
		);
		element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
	}, [rows]);

	// Separate effect for search to handle debouncing
	useEffect(() => {
		const timeout = window.setTimeout(() => {
			if (search !== undefined) {
				setPage(1);
				fetchPage(1, false);
			}
		}, 400);

		return () => window.clearTimeout(timeout);
	}, [search]);

	const handleLoadMore = () => {
		const nextPage = page + 1;
		setPage(nextPage);
		fetchPage(nextPage, true);
	};

	/**
	 * Same real "scroll the right-side detail panel into view" affordance SeoTitlesPanel.tsx's own
	 * `handleEditRow()`/IssuesList.tsx's row select already establish.
	 */
	const handleSelectRow = (row: HistoryRow) => {
		setSelectedRow(row);
		scrollToId('history-detail-panel');
	};

	/**
	 * "Related actions (from this conversation)" (HistoryDetailPanel.tsx) jumps to a real 'change'
	 * row elsewhere in this same timeline.
	 */
	const handleSelectRelatedAction = (id: number) => {
		pendingSelectId.current = id;
		setActiveFilter('change');
	};

	const handleDelete = (row: HistoryRow) => {
		setRows((current) => current.filter((r) => r.id !== row.id));
		setTotal((current) => Math.max(0, current - 1));

		if (selectedRow?.id === row.id) {
			setSelectedRow(null);
		}
	};

	/**
	 * Every field here is already real (loaded, not re-fetched).
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
			<CardComponent titleIcon="security" title={__('History', 'vulopilot')} desc={__('Everything VuloPilot has scanned, changed, or applied. Use filters to find exactly what you need.', 'vulopilot')}>
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
										{` (${typeCounts[tab.id]})`}
									</span>
								)}
							</span>
						))}
					</div>

					{/* Same real one-row toolbar shape RecentContentCard.tsx's own `.recent-content-toolbar` already establishes (search, filter select(s), action button, wrapped+right-aligned) - search/date range/Export used to each fall onto their own line here since `.filter-wrapper`'s own real style only applies inside a TableCard's `.table-container` (Table.scss's own nested selector), so outside that context it was an unstyled `<div>` and every child fell back to plain block-level stacking. */}
					<div className="history-toolbar">
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
				</div>
				{error ? (
					<ModuleGuardComponent
						icon="error"
						title={__('Could not load history', 'vulopilot')}
						desc={error}
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
								: 'automations' === activeFilter
									? __(
											'No automation history yet',
											'vulopilot'
										)
									: __('Nothing here yet', 'vulopilot')
						}
						desc={
							'conversation' === activeFilter
								? __(
										"AI chat isn't connected yet - once it is, your conversations will show up here.",
										'vulopilot'
									)
								: 'automations' === activeFilter
									? __(
											"No automation has run yet - automated workflows will show up here once they do.",
											'vulopilot'
										)
									: __(
											'Scans and AI changes will show up here as VuloPilot works.',
											'vulopilot'
										)
						}
					/>
				) : (
					<HistoryTimeline
						rows={rows}
						total={total}
						selectedRow={selectedRow}
						onSelectRow={handleSelectRow}
						isLoadingMore={isLoadingMore}
						onLoadMore={handleLoadMore}
					/>
				)}
			</CardComponent>
			</ColumnComponent>

			<ColumnComponent grid={4}>
				<div id="history-detail-panel">
				<HistoryDetailPanel
					row={selectedRow}
					onDeleted={handleDelete}
					onRolledBack={() => fetchPage(1, false)}
					onSelectRelatedAction={handleSelectRelatedAction}
				/>
				</div>
			</ColumnComponent>
		</ContainerComponent>
	);
};

export default HistoryTab;