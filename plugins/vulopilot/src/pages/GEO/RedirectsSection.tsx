/* global appLocalizer */
import { useEffect, useState } from '@wordpress/element';
import { __, _n, sprintf } from '@wordpress/i18n';
import { getApiLink, getApiResponse, sendApiResponse } from '@zyra/core';
import {
	BadgeComponent,
	CardComponent,
	ColumnComponent,
	ModuleGuardComponent,
	NoticeManager,
	PopupComponent,
	TooltipComponent,
} from '@zyra/components';
import { ButtonInput, SelectInput, TextInput } from '@zyra/inputs';
import { TableCard, TableRow } from '@zyra/table';
import MetricTile, { MetricTileGrid } from '../../components/MetricTile/MetricTile';
import TypographyComponent from '../../components/TypographyComponent';
import { formatWpDate } from '../../services/formatWpDate';
import { RowAction, RowActionsMenu } from './seoIssuesShared';
import './SeoVisibility.scss';

interface RedirectRow extends TableRow {
	id: number;
	source_path: string;
	target_url: string;
	redirect_type: 301 | 302 | 307;
	hit_count: number;
	is_active: 0 | 1;
	created_at: string;
	last_accessed_at: string | null;
}

interface RedirectHealthResult {
	broken: boolean;
	status: number | string;
}

interface RedirectHealthResponse {
	checked_at: number;
	results: Record<number, RedirectHealthResult>;
}

const nonceHeaders = { headers: { 'X-WP-Nonce': appLocalizer.nonce } };

const FETCH_PAGE_SIZE = 100;
/** Safety ceiling for the fetch-everything loop below — a real site's user-managed redirect list is small by nature (each one is manually added or converted from a 404), unlike scanner findings. */
const MAX_REDIRECTS = 1000;
const DEFAULT_PER_PAGE = 10;

/** Real HEAD-check cadence — Controllers/Redirects.php's own `HEALTH_CACHE_SECONDS` (an hour); kept in sync so the "Recheck in ~Xm" line here reflects the same real cache window the backend actually enforces, not a guess. */
const HEALTH_CACHE_SECONDS = 60 * 60;

/** Palette color per real redirect type — matches the legend swatches; 307 gets its own color rather than reusing 302's, since it's a genuinely distinct HTTP status a visitor's browser treats differently (redirect_type is real, never fabricated — Controllers/Redirects.php only ever persists 301/302/307). */
const TYPE_COLOR: Record<number, string> = {
	301: 'green',
	302: 'yellow',
	307: 'purple',
};

/**
 * `$wpdb`'s own raw row shape — every numeric column comes back as a PHP
 * string once JSON-encoded (confirmed live: `redirect_type: "307"`, not
 * `307`), so this normalizes the fields this file actually compares
 * (`===`) or does arithmetic on into real JS numbers right at the fetch
 * boundary — the one place that needs to happen, rather than every
 * comparison site remembering to `Number()` it.
 */
const normalizeRedirectRow = (row: RedirectRow): RedirectRow => ({
	...row,
	id: Number(row.id),
	redirect_type: Number(row.redirect_type) as 301 | 302 | 307,
	hit_count: Number(row.hit_count),
	is_active: Number(row.is_active) as 0 | 1,
});

const fetchAllRedirects = async (): Promise<RedirectRow[]> => {
	let page = 1;
	let all: RedirectRow[] = [];

	// eslint-disable-next-line no-constant-condition
	while (true) {
		const response = await getApiResponse<{ data: RedirectRow[]; total: number }>(
			getApiLink(appLocalizer, `redirects?per_page=${FETCH_PAGE_SIZE}&page=${page}&orderby=id&order=desc`),
			nonceHeaders
		);

		if (!response) {
			throw new Error('redirects fetch failed');
		}

		all = all.concat((response.data ?? []).map(normalizeRedirectRow));

		const gotFullPage = (response.data ?? []).length === FETCH_PAGE_SIZE;
		const moreRemain = all.length < (response.total ?? 0);

		if (!gotFullPage || !moreRemain || all.length >= MAX_REDIRECTS) {
			break;
		}

		page += 1;
	}

	return all;
};

/**
 * A redirect's `target_url` resolved down to a real, comparable path —
 * same-origin check as BrokenLinksSection.tsx's own `deriveSourcePath()` —
 * null for a target pointing at a different site entirely, which can
 * never chain into another row of THIS site's own redirect table.
 */
const resolveTargetPath = (targetUrl: string): string | null => {
	try {
		const target = new URL(targetUrl, appLocalizer.site_url);
		const site = new URL(appLocalizer.site_url);

		if (target.origin !== site.origin) {
			return null;
		}

		const path = target.pathname || '/';
		return '/' !== path ? path.replace(/\/$/, '') : path;
	} catch {
		return null;
	}
};

/**
 * Real chain detection over the actual `vulopilot_redirects` rows — a
 * redirect "chains" when its own `target_url` resolves to a path that is
 * itself another redirect's `source_path`: a visitor following it hits a
 * SECOND redirect before reaching a final destination. Nothing here is
 * simulated/estimated — it's a plain lookup across the same rows the
 * table already renders. Returns a `Map<redirectId, nextHopRow>` for
 * every redirect that chains into another one.
 */
const detectChains = (rows: RedirectRow[]): Map<number, RedirectRow> => {
	const bySourcePath = new Map<string, RedirectRow>();
	rows.forEach((row) => bySourcePath.set(row.source_path, row));

	const chains = new Map<number, RedirectRow>();

	rows.forEach((row) => {
		const targetPath = resolveTargetPath(row.target_url);

		if (!targetPath || targetPath === row.source_path) {
			return;
		}

		const nextHop = bySourcePath.get(targetPath);

		if (nextHop) {
			chains.set(row.id, nextHop);
		}
	});

	return chains;
};

type TypeFilter = 'all' | 301 | 302 | 307;
type StatusFilter = 'all' | 'active' | 'inactive' | 'broken';

/**
 * "Redirects" inner section of the "Crawl & URLs" tab. Real 301/302/307
 * redirect manager (`vulopilot_redirects`) — rebuilt to match the
 * reference mockup wherever the data genuinely supports it:
 *   - 5 real stat tiles: Total/Active (existing `is_active_counts`-shaped
 *     data), Redirect Chains (detectChains() above, a real computation
 *     over the actual rows — no scanner needed), Broken Redirects (a new
 *     real `GET /redirects/health` HEAD-check of each active redirect's
 *     own `target_url`, added alongside this pass since nothing
 *     previously checked that), and Last Checked (that same endpoint's
 *     real `checked_at`, plus the real cache-expiry time as an honest
 *     "next automatic check" — not a fabricated schedule).
 *   - A real 301/302/307 legend and type filter. A 4th "Meta Refresh"
 *     legend entry from the mockup is deliberately NOT reproduced: that's
 *     an HTML-level `<meta http-equiv="refresh">` mechanism, unrelated to
 *     this HTTP-redirect table, and nothing in this codebase implements
 *     it — adding a legend entry with no real rows behind it would be a
 *     decoration, not a filter.
 *   - No "All groups" filter: there is no group/category/label concept
 *     anywhere on a redirect row (confirmed against `Install.php`'s own
 *     schema and `RedirectRepository`) — the mockup's grouping has no
 *     real data behind it here.
 *   - Flat table, one row per redirect, matching the mockup's own
 *     From/To/Type/Hits/Created/Last Accessed/Status/Actions columns.
 */
const RedirectsSection = () => {
	const [allRedirects, setAllRedirects] = useState<RedirectRow[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [health, setHealth] = useState<RedirectHealthResponse | null>(null);
	const [isCheckingHealth, setIsCheckingHealth] = useState(false);

	const [searchTerm, setSearchTerm] = useState('');
	const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
	const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
	const [paged, setPaged] = useState(1);
	const [perPage, setPerPage] = useState(DEFAULT_PER_PAGE);

	const [isFormOpen, setIsFormOpen] = useState(false);
	const [editingId, setEditingId] = useState<number | null>(null);
	const [sourcePath, setSourcePath] = useState('');
	const [targetUrl, setTargetUrl] = useState('');
	const [redirectType, setRedirectType] = useState<string>('301');
	const [isSaving, setIsSaving] = useState(false);

	const loadRedirects = () => {
		setIsLoading(true);

		fetchAllRedirects()
			.then((rows) => {
				setAllRedirects(rows);
				setError(null);
			})
			.catch(() =>
				setError(
					__(
						'Something went wrong fetching this data. Please try again.',
						'vulopilot'
					)
				)
			)
			.finally(() => setIsLoading(false));
	};

	const loadHealth = (force = false) => {
		setIsCheckingHealth(true);

		getApiResponse<RedirectHealthResponse>(
			getApiLink(appLocalizer, `redirects/health${force ? '?force=1' : ''}`),
			nonceHeaders
		)
			.then((response) => response && setHealth(response))
			.finally(() => setIsCheckingHealth(false));
	};

	useEffect(() => {
		loadRedirects();
		loadHealth();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	useEffect(() => {
		setPaged(1);
	}, [searchTerm, typeFilter, statusFilter]);

	const chains = detectChains(allRedirects);

	const isBroken = (row: RedirectRow): boolean =>
		!!health?.results?.[row.id]?.broken;

	const totalCount = allRedirects.length;
	const activeCount = allRedirects.filter((row) => 1 === row.is_active).length;
	const brokenCount = allRedirects.filter(isBroken).length;
	const chainCount = chains.size;

	const resetForm = () => {
		setEditingId(null);
		setSourcePath('');
		setTargetUrl('');
		setRedirectType('301');
	};

	const openAddForm = () => {
		resetForm();
		setIsFormOpen(true);
	};

	const openEditForm = (row: RedirectRow) => {
		setEditingId(row.id);
		setSourcePath(row.source_path);
		setTargetUrl(row.target_url);
		setRedirectType(String(row.redirect_type));
		setIsFormOpen(true);
	};

	const handleSaveRedirect = () => {
		setIsSaving(true);

		const endpoint = editingId ? `redirects/${editingId}` : 'redirects';

		sendApiResponse(appLocalizer, getApiLink(appLocalizer, endpoint), {
			...(editingId ? {} : { source_path: sourcePath }),
			target_url: targetUrl,
			redirect_type: Number(redirectType),
		})
			.then((response) => {
				NoticeManager.add({
					uniqueKey: 'vulopilot-redirect-save',
					type: response ? 'success' : 'error',
					position: 'float',
					message: response
						? __('Redirect saved.', 'vulopilot')
						: __(
							'Could not save this redirect — check the path and URL and try again.',
							'vulopilot'
						),
				});

				if (response) {
					setIsFormOpen(false);
					resetForm();
					loadRedirects();
				}
			})
			.finally(() => setIsSaving(false));
	};

	const handleToggleActive = (row: RedirectRow) => {
		sendApiResponse(
			appLocalizer,
			getApiLink(appLocalizer, `redirects/${row.id}`),
			{ is_active: row.is_active ? 0 : 1 }
		).then((response) => {
			if (response) {
				loadRedirects();
			}
		});
	};

	const handleDeleteRedirect = (row: RedirectRow) => {
		if (
			!window.confirm(
				__('Delete this redirect? This cannot be undone.', 'vulopilot')
			)
		) {
			return;
		}

		sendApiResponse(
			appLocalizer,
			getApiLink(appLocalizer, `redirects/${row.id}/delete`),
			{}
		).then((response) => {
			NoticeManager.add({
				uniqueKey: 'vulopilot-redirect-delete',
				type: response ? 'success' : 'error',
				position: 'float',
				message: response
					? __('Redirect deleted.', 'vulopilot')
					: __('Could not delete this redirect.', 'vulopilot'),
			});

			if (response) {
				loadRedirects();
			}
		});
	};

	const visibleRedirects = allRedirects
		.filter((row) => 'all' === typeFilter || row.redirect_type === typeFilter)
		.filter((row) => {
			if ('all' === statusFilter) {
				return true;
			}
			if ('broken' === statusFilter) {
				return isBroken(row);
			}
			return 'active' === statusFilter ? 1 === row.is_active : 0 === row.is_active;
		})
		.filter((row) => {
			if ('' === searchTerm.trim()) {
				return true;
			}
			const term = searchTerm.trim().toLowerCase();
			return (
				row.source_path.toLowerCase().includes(term) ||
				row.target_url.toLowerCase().includes(term)
			);
		});

	const pageRows = visibleRedirects.slice(
		(paged - 1) * perPage,
		paged * perPage
	);

	const handleExportCsv = () => {
		if (!visibleRedirects.length) {
			NoticeManager.add({
				uniqueKey: 'redirect-export-empty',
				type: 'error',
				position: 'float',
				message: __('Nothing to export.', 'vulopilot'),
			});
			return;
		}

		const header = [
			__('From', 'vulopilot'),
			__('To', 'vulopilot'),
			__('Type', 'vulopilot'),
			__('Hits', 'vulopilot'),
			__('Created', 'vulopilot'),
			__('Last accessed', 'vulopilot'),
			__('Status', 'vulopilot'),
		];
		const lines = visibleRedirects.map((row) =>
			[
				row.source_path,
				row.target_url,
				row.redirect_type,
				row.hit_count,
				row.created_at,
				row.last_accessed_at ?? '',
				row.is_active ? __('Active', 'vulopilot') : __('Inactive', 'vulopilot'),
			]
				.map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`)
				.join(',')
		);
		const csv = [header.join(','), ...lines].join('\n');
		const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
		const url = URL.createObjectURL(blob);
		const link = document.createElement('a');

		link.href = url;
		link.download = 'redirects.csv';
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
		URL.revokeObjectURL(url);
	};

	const buildMoreActions = (row: RedirectRow): RowAction[] => [
		{
			label: row.is_active
				? __('Deactivate', 'vulopilot')
				: __('Activate', 'vulopilot'),
			icon: 'toggle',
			onClick: () => handleToggleActive(row),
		},
	];

	const headers = {
		source_path: {
			label: __('From (Old URL)', 'vulopilot'),
			render: (row: RedirectRow) => {
				const pageUrl = `${appLocalizer.site_url}${row.source_path}`;
				return (
					<div className="redirect-url-cell">
						<a href={pageUrl} target="_blank" rel="noreferrer">
							{row.source_path}
						</a>
						<span className="typography-body-xs redirect-url-sub">{pageUrl}</span>
					</div>
				);
			},
		},
		target_url: {
			label: __('To (New URL)', 'vulopilot'),
			render: (row: RedirectRow) => {
				const nextHop = chains.get(row.id);
				return (
					<div className="redirect-url-cell">
						<a href={row.target_url} target="_blank" rel="noreferrer" title={row.target_url}>
							{row.target_url}
						</a>
						{nextHop && (
							<TooltipComponent
								text={sprintf(
									/* translators: %s: the path this redirect chains into. */
									__('Chains into another redirect: %s', 'vulopilot'),
									nextHop.source_path
								)}
							>
								<span className="redirect-chain-flag">
									<i className="adminfont-link" />
									{__('Chains further', 'vulopilot')}
								</span>
							</TooltipComponent>
						)}
					</div>
				);
			},
		},
		redirect_type: {
			label: __('Type', 'vulopilot'),
			render: (row: RedirectRow) => (
				<BadgeComponent
					color={TYPE_COLOR[row.redirect_type] ?? 'grey'}
					text={String(row.redirect_type)}
				/>
			),
		},
		hit_count: {
			label: __('Hits', 'vulopilot'),
			render: (row: RedirectRow) => (
				<span className="redirect-hits-cell">
					{row.hit_count}
					<TooltipComponent
						text={__(
							'How many times a real visitor has actually been sent through this redirect.',
							'vulopilot'
						)}
					>
						<i className="adminfont-info redirect-hits-info" />
					</TooltipComponent>
				</span>
			),
		},
		created_at: {
			label: __('Created', 'vulopilot'),
			render: (row: RedirectRow) => (
				<span className="typography-body-xs">{formatWpDate(row.created_at)}</span>
			),
		},
		last_accessed_at: {
			label: __('Last Accessed', 'vulopilot'),
			render: (row: RedirectRow) => (
				<span className="typography-body-xs">
					{row.last_accessed_at ? formatWpDate(row.last_accessed_at) : __('Never', 'vulopilot')}
				</span>
			),
		},
		status: {
			label: __('Status', 'vulopilot'),
			render: (row: RedirectRow) =>
				isBroken(row) ? (
					<BadgeComponent color="red" text={__('Broken', 'vulopilot')} />
				) : (
					<BadgeComponent
						color={row.is_active ? 'green' : 'grey'}
						text={row.is_active ? __('Active', 'vulopilot') : __('Inactive', 'vulopilot')}
					/>
				),
		},
		actions: {
			label: __('Actions', 'vulopilot'),
			render: (row: RedirectRow) => (
				<div className="redirect-row-actions">
					<TooltipComponent text={__('Edit', 'vulopilot')}>
						<button
							type="button"
							className="redirect-icon-btn"
							onClick={() => openEditForm(row)}
						>
							<i className="adminfont-edit" />
						</button>
					</TooltipComponent>
					<TooltipComponent text={__('Delete', 'vulopilot')}>
						<button
							type="button"
							className="redirect-icon-btn"
							onClick={() => handleDeleteRedirect(row)}
						>
							<i className="adminfont-delete" />
						</button>
					</TooltipComponent>
					<RowActionsMenu actions={buildMoreActions(row)} />
				</div>
			),
		},
	};

	const headerAction = (
		<ButtonInput
			buttons={{
				text: __('Add redirect', 'vulopilot'),
				icon: 'plus',
				onClick: openAddForm,
			}}
		/>
	);

	if (error) {
		return (
			<ColumnComponent>
				<CardComponent title={__('Redirects', 'vulopilot')} action={headerAction}>
					<ModuleGuardComponent
						icon="error"
						title={__('Could not load redirects', 'vulopilot')}
						desc={error}
						buttonText={__('Retry', 'vulopilot')}
						onButtonClick={loadRedirects}
					/>
				</CardComponent>
			</ColumnComponent>
		);
	}

	const nextCheckLabel = health
		? formatWpDate(
			new Date((health.checked_at + HEALTH_CACHE_SECONDS) * 1000).toISOString()
		)
		: null;

	return (
		<ColumnComponent>
			<MetricTileGrid variant="broken-links" className="redirect-stat-grid">
				<MetricTile variant="broken-links" icon="update" title={__('Total Redirects', 'vulopilot')} isLoading={isLoading}>
					<TypographyComponent as="span" variant="h3" className="redirect-stat-value">
						{totalCount}
					</TypographyComponent>
					<p className="desc">{__('All redirects found', 'vulopilot')}</p>
				</MetricTile>
				<MetricTile variant="broken-links" icon="check" iconColor="#16a34a" title={__('Active', 'vulopilot')} isLoading={isLoading}>
					<TypographyComponent as="span" variant="h3" className="redirect-stat-value is-good">
						{activeCount}
					</TypographyComponent>
					<p className="desc">
						{sprintf(
							/* translators: %d: percentage of redirects that are active. */
							__('Working correctly · %d%% of total', 'vulopilot'),
							totalCount ? Math.round((activeCount / totalCount) * 100) : 0
						)}
					</p>
				</MetricTile>
				<MetricTile variant="broken-links" icon="link" iconColor="#b45309" title={__('Redirect Chains', 'vulopilot')} isLoading={isLoading}>
					<TypographyComponent as="span" variant="h3" className="redirect-stat-value is-attention">
						{chainCount}
					</TypographyComponent>
					<p className="desc">
						{chainCount
							? sprintf(
								/* translators: %d: number of chains detected. */
								_n('%d chain detected — needs review', '%d chains detected — needs review', chainCount, 'vulopilot'),
								chainCount
							)
							: __('No chains detected', 'vulopilot')}
					</p>
				</MetricTile>
				<MetricTile variant="broken-links" icon="error" title={__('Broken Redirects', 'vulopilot')} isLoading={isCheckingHealth}>
					<TypographyComponent as="span" variant="h3" className="redirect-stat-value">
						{brokenCount}
					</TypographyComponent>
					<p className="desc">
						{sprintf(
							/* translators: %d: percentage of redirects that are broken. */
							__('Needs attention · %d%% of total', 'vulopilot'),
							totalCount ? Math.round((brokenCount / totalCount) * 100) : 0
						)}
					</p>
				</MetricTile>
				<MetricTile variant="broken-links" icon="calendar" title={__('Last Checked', 'vulopilot')} isLoading={isCheckingHealth}>
					<TypographyComponent as="span" variant="h3" className="redirect-stat-value is-muted">
						{health ? formatWpDate(new Date(health.checked_at * 1000).toISOString()) : __('Never', 'vulopilot')}
					</TypographyComponent>
					<p className="desc">
						{nextCheckLabel
							? sprintf(
								/* translators: %s: formatted date/time of the next automatic health check. */
								__('Next automatic check: %s', 'vulopilot'),
								nextCheckLabel
							)
							: __('Broken-redirect check has not run yet.', 'vulopilot')}
					</p>
				</MetricTile>
			</MetricTileGrid>

			<CardComponent title={__('Redirects', 'vulopilot')} titleIcon="link">
				<div className="redirect-toolbar">
					<TextInput
						name="redirect_search"
						placeholder={__('Search by URL or redirect…', 'vulopilot')}
						value={searchTerm}
						onChange={(value) => setSearchTerm(value as string)}
					/>
					<SelectInput
						name="redirect_type_filter"
						value={String(typeFilter)}
						options={[
							{ label: __('All types', 'vulopilot'), value: 'all' },
							{ label: '301', value: '301' },
							{ label: '302', value: '302' },
							{ label: '307', value: '307' },
						]}
						onChange={(value) =>
							setTypeFilter('all' === value ? 'all' : (Number(value) as TypeFilter))
						}
						size="9rem"
					/>
					<SelectInput
						name="redirect_status_filter"
						value={statusFilter}
						options={[
							{ label: __('All status', 'vulopilot'), value: 'all' },
							{ label: __('Active', 'vulopilot'), value: 'active' },
							{ label: __('Inactive', 'vulopilot'), value: 'inactive' },
							{ label: __('Broken', 'vulopilot'), value: 'broken' },
						]}
						onChange={(value) => setStatusFilter(value as StatusFilter)}
						size="9rem"
					/>
					<ButtonInput
						buttons={[
							{
								text: __('Add redirect', 'vulopilot'),
								icon: 'plus',
								onClick: openAddForm,
							},
							{
								text: __('Export CSV', 'vulopilot'),
								icon: 'export',
								color: 'plain',
								onClick: handleExportCsv,
							},
						]}
					/>
				</div>

				<TableCard
					showMenu={false}
					className="transparent-table redirect-table"
					headers={headers}
					rows={pageRows}
					ids={pageRows.map((row) => row.id)}
					totalRows={visibleRedirects.length}
					isLoading={isLoading}
					onQueryUpdate={(query: { paged?: number | string; per_page?: number | string }) => {
						setPaged(Number(query.paged) || 1);
						setPerPage(Number(query.per_page) || DEFAULT_PER_PAGE);
					}}
					emptyMessage={__(
						'No redirects yet — add one, or convert an entry from the 404s tab.',
						'vulopilot'
					)}
				/>
			</CardComponent>

			<PopupComponent
				open={isFormOpen}
				onClose={() => {
					setIsFormOpen(false);
					resetForm();
				}}
				width={28}
				height="auto"
				position="lightbox"
				header={{
					title: editingId
						? __('Edit redirect', 'vulopilot')
						: __('Add redirect', 'vulopilot'),
				}}
			>
				<div className="vulopilot-redirect-form">
					<TextInput
						name="source_path"
						inputLabel={__('From (path)', 'vulopilot')}
						placeholder={__('/old-page/', 'vulopilot')}
						value={sourcePath}
						disabled={!!editingId}
						onChange={(newValue) => setSourcePath(newValue as string)}
					/>
					<TextInput
						name="target_url"
						inputLabel={__('To', 'vulopilot')}
						placeholder={__('https://example.com/new-page/', 'vulopilot')}
						value={targetUrl}
						onChange={(newValue) => setTargetUrl(newValue as string)}
					/>
					<SelectInput
						name="redirect_type"
						inputLabel={__('Type', 'vulopilot')}
						value={redirectType}
						options={[
							{ label: '301 (Permanent)', value: '301' },
							{ label: '302 (Temporary)', value: '302' },
							{ label: '307 (Temporary, method-preserving)', value: '307' },
						]}
						onChange={(newValue) => setRedirectType(newValue as string)}
						size="16rem"
					/>
					<ButtonInput
						buttons={{
							text: isSaving ? __('Saving…', 'vulopilot') : __('Save', 'vulopilot'),
							onClick: handleSaveRedirect,
							disabled: isSaving,
						}}
					/>
				</div>
			</PopupComponent>
		</ColumnComponent>
	);
};

export default RedirectsSection;
