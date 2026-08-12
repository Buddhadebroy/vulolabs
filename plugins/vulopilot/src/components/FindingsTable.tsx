/* global appLocalizer */
import React, { useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { applyFilters } from '@wordpress/hooks';
import { getApiLink, sendApiResponse } from '@zyra/core';
import {
	CardComponent,
	InformationItemComponent,
	ModuleGuardComponent,
	NoticeManager,
	PopupComponent,
} from '@zyra/components';
import { TableCard, TableRow } from '@zyra/table';
import { useApiList } from '../services/useApiList';
import { formatWpDate } from '../services/formatWpDate';
import ShowProPopup from './Popup/Popup';

export interface Finding extends TableRow {
	id: number;
	title: string;
	severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
	category: string;
	status: 'open' | 'resolved' | 'ignored' | 'snoozed';
	created_at: string;
	/**
	 * Resolved page path (e.g. '/pricing') for a per-post finding, or
	 * 'Site-wide' for a sitewide check — added server-side by
	 * Controllers/Findings.php's `add_page_field()` from the row's raw
	 * `object_type`/`object_ref` columns. Only used by `layout="compact"`'s
	 * name-column description line.
	 */
	page?: string;
	/**
	 * Which AI action can fix this finding, e.g. 'generate-alt' — null/
	 * undefined when this finding's scanner has no mapped fix, or when
	 * vulopilot-pro's OneClickFix module isn't active (in which case this
	 * field is never added to the response at all). Read by the fix
	 * handler vulopilot-pro's OneClickFix module registers (see the
	 * `getFindingFixHandler` docblock below) — Free never inspects it itself.
	 * See VuloPilotPro\OneClickFix\ScannerFixMap.
	 */
	fix_action_id?: string | null;
}

/**
 * What a registered fix handler resolves to — Free displays this itself
 * (see getFindingFixHandler's own docblock for why the handler can't just
 * show its own notice) rather than caring what actually happened.
 */
interface FixOutcome {
	success: boolean;
	message: string;
}

/**
 * The "Fix" row action's actual behavior — registered by vulopilot-pro's
 * OneClickFix module (modules/OneClickFix/src/index.tsx) via this filter,
 * replacing the `null` default with a function that calls
 * `POST /findings/{id}/fix` and resolves what happened. Free never contains
 * that REST call or any AI-action-to-scanner mapping itself: the "Fix"
 * action below is always visible (register a source, don't modify the
 * host — same pattern as vulopilot_woocommerce_ai_panel/
 * vulopilot_pro_dashboard_component), but its onClick only ever does one of
 * two things — call this handler, or open the Pro popup when it's null
 * (Pro not installed/active, or Pro's OneClickFix module specifically
 * isn't enabled — this module's own JS entry is itself gated on
 * appLocalizer.active_modules, so a null handler covers both cases without
 * Free needing to know which).
 *
 * The handler resolves a { success, message } outcome rather than showing
 * its own notice: @multivendorx/zyra isn't in webpack's `externals` (only
 * react/react-dom/@wordpress/* are — tools/webpack/create-config.js), so
 * it's bundled separately per plugin. Free's and Pro's NoticeManager are
 * two different in-memory singletons — a notice added from Pro's bundle is
 * invisible to the NoticeReceiverComponent Free's own HeaderComponent
 * mounted from Free's bundle. Free's onClick below shows the notice itself
 * using ITS OWN NoticeManager, which the receiver actually subscribes to.
 *
 * Read fresh on every click rather than cached in a module-level constant:
 * Pro's own script (vulopilot-pro-admin-script) is a separate, later
 * <script> tag that depends on this one (it reads the `appLocalizer` global
 * this script localizes), so it hasn't registered its addFilter() callback
 * yet at the moment this module first evaluates — caching the result here
 * would permanently capture `null` and always show the popup, active
 * module or not. By click time both scripts have long finished running.
 */
const getFindingFixHandler = () =>
	applyFilters('vulopilot_finding_fix_handler', null);

/**
 * "Bulk Fixes" (AI-VISIBILITY-MODULE.md) — same registration pattern as
 * getFindingFixHandler() above, one level up: vulopilot-pro's OneClickFix
 * module replaces this `null` default with a function that calls
 * `POST /findings/bulk-fix` for a whole selected batch at once and
 * resolves a summary outcome, rather than Free looping the single-row
 * handler itself (a real batch REST call, not N sequential requests).
 *
 * @return unknown A function(ids: number[]): Promise<FixOutcome>, or null when Pro's OneClickFix isn't active.
 */
const getFindingBulkFixHandler = () =>
	applyFilters('vulopilot_finding_bulk_fix_handler', null);

interface FindingsTableProps {
	title: string;
	description?: string;
	/** Restricts the list to one finding category (e.g. 'seo', 'geo', 'woocommerce'). Omit to show every category (Health). */
	category?: string;
	/**
	 * Further restricts the list to a specific set of scanner ids within
	 * `category` — what SEO.tsx's per-section tables (e.g. "Titles & meta"
	 * vs. "Images") use to split one category's findings into several
	 * independent tables without duplicating this component's fetch/filter/
	 * bulk-action/fix-action wiring per section. Omit to show every scanner
	 * in `category` (every other page's single-table usage).
	 */
	scannerIds?: string[];
	/**
	 * 'compact' renders each row as a single InformationItemComponent
	 * (title + "$page · Detected $date" description line, same shape as
	 * zyra's own TableCard "Transparent" story) with inline admin-badge
	 * row actions, instead of the default multi-column table — GEO.tsx's
	 * per-section tables opt into this; every other page keeps the default.
	 */
	layout?: 'default' | 'compact';
}

/**
 * Shared findings list — the Health, SEO, GEO, and WooCommerce pages are
 * all "vulopilot_scan_findings filtered to a category" (DATABASE.md), so
 * this one component serves all four rather than duplicating the same
 * table/filter/state wiring four times. SEO.tsx additionally scopes several
 * instances of this same component to one `scannerIds` group each, for its
 * per-section tables.
 */
const FindingsTable: React.FC<FindingsTableProps> = ({
	title,
	description,
	category,
	scannerIds,
	layout = 'default',
}) => {
	const [isProPopupOpen, setIsProPopupOpen] = useState(false);

	/** Every finding status, in display order — reused for both the status-count pill bar and (previously) the status dropdown filter it now replaces. */
	const statusOptions = [
		{ label: __('Open', 'vulopilot'), value: 'open' },
		{ label: __('Resolved', 'vulopilot'), value: 'resolved' },
		{ label: __('Ignored', 'vulopilot'), value: 'ignored' },
		{ label: __('Snoozed', 'vulopilot'), value: 'snoozed' },
	];

	const {
		data,
		total,
		categoryCounts,
		isLoading,
		error,
		refetch,
		onQueryUpdate,
	} = useApiList<Finding>(
		'findings',
		{
			category,
			// Comma-joined, not an array — useApiList's params are plain
			// string|number values (see its own JSDoc); Findings::get_items()
			// on the backend splits this back into a scanner_id list
			// (see parse_scanner_ids()).
			scanner_id: scannerIds?.length ? scannerIds.join(',') : undefined,
		},
		{ key: 'status', options: statusOptions }
	);

	/**
	 * Whether the user currently has a search term typed in — tracked so
	 * the `search` box below can hide itself when there's nothing to
	 * search (`total === 0`), without also hiding it out from under
	 * someone whose own search just happens to match nothing: `total`
	 * reflects the *current* (possibly search-filtered) result count, not
	 * "has this table ever had any rows," so gating on `total === 0` alone
	 * would make the box vanish mid-search with no way left to clear it.
	 */
	const [hasSearchTerm, setHasSearchTerm] = useState(false);

	const handleQueryUpdate: typeof onQueryUpdate = (query) => {
		setHasSearchTerm(Boolean(query.searchValue));
		onQueryUpdate(query);
	};

	const handleSetStatus = (
		row: Record<string, unknown> | undefined,
		status: 'resolved' | 'ignored' | 'open',
		successMessage: string
	) => {
		if (!row) {
			return;
		}

		sendApiResponse(
			appLocalizer,
			getApiLink(appLocalizer, `findings/${row.id}`),
			{ status }
		).then((response) => {
			if (response) {
				NoticeManager.add({
					uniqueKey: `finding-${status}-${row.id}`,
					type: 'success',
					position: 'float',
					message: successMessage,
				});
				refetch();
			} else {
				NoticeManager.add({
					uniqueKey: `finding-${status}-failed-${row.id}`,
					type: 'error',
					position: 'float',
					message: __(
						'Could not update this finding. Please try again.',
						'vulopilot'
					),
				});
			}
		});
	};

	const handleResolve = (row?: Record<string, unknown>) =>
		handleSetStatus(
			row,
			'resolved',
			__('Finding marked as resolved.', 'vulopilot')
		);

	const handleIgnore = (row?: Record<string, unknown>) =>
		handleSetStatus(row, 'ignored', __('Finding ignored.', 'vulopilot'));

	const handleReopen = (row?: Record<string, unknown>) =>
		handleSetStatus(row, 'open', __('Finding reopened.', 'vulopilot'));

	/**
	 * "Manual Actions Only" (readme.txt) — goes through the
	 * Automation\ActionRegistry/ManualActionRunner abstraction
	 * (`POST /findings/{id}/actions/snooze-finding`) rather than a plain
	 * `PATCH /findings/{id} {status: 'snoozed'}`, unlike handleResolve/
	 * handleIgnore/handleReopen above — those predate this feature and set
	 * status directly; this is Free's one built-in manual action.
	 */
	const handleSnooze = (row?: Record<string, unknown>) => {
		if (!row) {
			return;
		}

		sendApiResponse(
			appLocalizer,
			getApiLink(appLocalizer, `findings/${row.id}/actions/snooze-finding`),
			{}
		).then((response: { success?: boolean; message?: string } | undefined) => {
			NoticeManager.add({
				uniqueKey: `finding-snooze-${row.id}`,
				type: response?.success ? 'success' : 'error',
				position: 'float',
				message:
					response?.message ||
					__('Could not snooze this finding. Please try again.', 'vulopilot'),
			});

			if (response?.success) {
				refetch();
			}
		});
	};

	/**
	 * "Fix" — always visible (register a source, don't modify the host —
	 * see getFindingFixHandler's own docblock above); shared by both the
	 * default table's row action and compact layout's inline badge.
	 */
	const handleFix = (row?: Record<string, unknown>) => {
		const findingFixHandler = getFindingFixHandler();

		if (typeof findingFixHandler === 'function') {
			Promise.resolve(
				findingFixHandler(row) as Promise<FixOutcome> | undefined
			).then((outcome) => {
				if (outcome?.message) {
					NoticeManager.add({
						uniqueKey: `finding-fix-${row?.id}`,
						type: outcome.success ? 'success' : 'error',
						position: 'float',
						message: outcome.message,
					});
				}

				refetch();
			});
			return;
		}

		setIsProPopupOpen(true);
	};

	if (error) {
		return (
			<CardComponent title={title}>
				<ModuleGuardComponent
					icon="error"
					title={__('Could not load findings', 'vulopilot')}
					desc={error}
					buttonText={__('Retry', 'vulopilot')}
					onButtonClick={refetch}
				/>
			</CardComponent>
		);
	}

	const defaultHeaders: Record<string, any> = {
		title: {
			label: __('Finding', 'vulopilot'),
			isSortable: true,
		},
		...(category
			? {}
			: {
					category: {
						label: __('Category', 'vulopilot'),
					},
				}),
		severity: {
			label: __('Severity', 'vulopilot'),
			type: 'status',
			statusClass: (row) =>row.severity,
		},
		status: {
			label: __('Status', 'vulopilot'),
			type: 'status',
			statusClass: (row) =>row.status,
		},
		created_at: {
			label: __('Detected', 'vulopilot'),
			type: 'date',
			isSortable: true,
			defaultSort: true,
			defaultOrder: 'desc',
		},
		actions: {
			label: __('Actions', 'vulopilot'),
			type: 'action',
			actions: [
				{
					label: (row?: Record<string, unknown>) =>
						row?.status === 'open'
							? __('Mark resolved', 'vulopilot')
							: __('Resolved', 'vulopilot'),
					icon: 'check',
					onClick: handleResolve,
				},
				{
					label: (row?: Record<string, unknown>) =>
						row?.status === 'ignored'
							? __('Ignored', 'vulopilot')
							: __('Ignore', 'vulopilot'),
					icon: 'eye-blocked',
					onClick: handleIgnore,
				},
				{
					label: __('Reopen', 'vulopilot'),
					icon: 'toggle',
					onClick: handleReopen,
				},
				{
					label: (row?: Record<string, unknown>) =>
						row?.status === 'snoozed'
							? __('Snoozed', 'vulopilot')
							: __('Snooze', 'vulopilot'),
					icon: 'clock',
					onClick: handleSnooze,
				},
				// Always visible — Free itself has no AI-action-to-scanner
				// mapping or fix REST call (see getFindingFixHandler's own
				// docblock above); this is only ever the entry point + gate.
				{
					label: __('Fix', 'vulopilot'),
					icon: 'tools',
					onClick: handleFix,
				},
			] as any[],
		},
	};

	/**
	 * "Transparent" TableCard story shape (zyra Storybook, `table-tablecard
	 * --transparent`) — one InformationItemComponent per row (title, then a
	 * "$page · Detected $date" description line) with inline admin-badge row
	 * actions on the right, instead of separate category/severity/status/
	 * date columns. GEO.tsx's per-section tables use this.
	 */
	const compactHeaders: Record<string, any> = {
		title: {
			label: __('issue', 'vulopilot'),
			render: (row: Finding) => (
				<InformationItemComponent
					title={row.title}
					badges={[
						{
							text: row.severity,
							className: `badge-${row.severity}`,
						}
					]}
					descriptions={[
						{
							value: sprintf(
								/* translators: 1: page path or "Site-wide", 2: formatted date */
								__('%1$s · Detected %2$s', 'vulopilot'),
								row.page || __('Site-wide', 'vulopilot'),
								formatWpDate(row.created_at)
							),
						},
					]}
				/>
			),
		},
		action: {
			label: __('Action', 'vulopilot'),
			render: (row: Finding) => {
				const asRecord = row as unknown as Record<string, unknown>;

				return (
					<div className="buttons-wrapper">
						{row.status === 'open' ? (
							<>
								<span
									className="admin-badge purple"
									role="button"
									tabIndex={0}
									onClick={() => handleFix(asRecord)}
								>
									{__('Fix', 'vulopilot')}
								</span>
								<span
									className="admin-badge green"
									role="button"
									tabIndex={0}
									onClick={() => handleResolve(asRecord)}
								>
									{__('Resolve', 'vulopilot')}
								</span>
								<span
									className="admin-badge red"
									role="button"
									tabIndex={0}
									onClick={() => handleIgnore(asRecord)}
								>
									{__('Ignore', 'vulopilot')}
								</span>
							</>
						) : (
							<span
								className="admin-badge blue"
								role="button"
								tabIndex={0}
								onClick={() => handleReopen(asRecord)}
							>
								{__('Reopen', 'vulopilot')}
							</span>
						)}
					</div>
				);
			},
		},
	};

	const headers = layout === 'compact' ? compactHeaders : defaultHeaders;

	return (
		<>
			<TableCard
				headers={headers}
				format={appLocalizer.date_format_js}
				showMenu={false}
				// className= 'transparent-table'
				rows={data}
				ids={data.map((row) => row.id)}
				totalRows={total}
				categoryCounts={categoryCounts}
				isLoading={isLoading}
				onQueryUpdate={handleQueryUpdate}
				search={
					total > 0 || hasSearchTerm
						? { placeholder: __('Search findings…', 'vulopilot') }
						: undefined
				}
				bulkActions={[
					{
						label: __('Mark resolved', 'vulopilot'),
						value: 'resolved',
					},
					{ label: __('Ignore', 'vulopilot'), value: 'ignored' },
					// Always visible, same "register a source, don't modify
					// the host" reasoning as the per-row "Fix" action above —
					// its onClick below only ever calls the Pro-registered
					// handler or opens the Pro popup.
					{ label: __('Fix selected', 'vulopilot'), value: '__fix__' },
				]}
				onBulkActionApply={(action: string, ids: number[]) => {
					if ('__fix__' === action) {
						const bulkFixHandler = getFindingBulkFixHandler();

						if (typeof bulkFixHandler === 'function') {
							Promise.resolve(
								bulkFixHandler(ids) as
									| Promise<FixOutcome>
									| undefined
							).then((outcome) => {
								if (outcome?.message) {
									NoticeManager.add({
										uniqueKey: 'findings-bulk-fix',
										type: outcome.success
											? 'success'
											: 'error',
										position: 'float',
										message: outcome.message,
									});
								}

								refetch();
							});
							return;
						}

						setIsProPopupOpen(true);
						return;
					}

					sendApiResponse(
						appLocalizer,
						getApiLink(appLocalizer, 'findings/bulk'),
						{ ids, status: action }
					).then((response: unknown) => {
						if (response) {
							NoticeManager.add({
								uniqueKey: 'findings-bulk-update',
								type: 'success',
								position: 'float',
								message: __(
									'Selected findings updated.',
									'vulopilot'
								),
							});
							refetch();
						} else {
							NoticeManager.add({
								uniqueKey: 'findings-bulk-update-failed',
								type: 'error',
								position: 'float',
								message: __(
									'Could not update the selected findings. Please try again.',
									'vulopilot'
								),
							});
						}
					});
				}}
				emptyMessage={
					description ||
					__('No findings here yet — nothing to report.', 'vulopilot')
				}
				filters={[
					{
						key: 'severity',
						label: __('Severity', 'vulopilot'),
						type: 'select',
						size: 10,
						options: [
							{ label: __('Critical', 'vulopilot'), value: 'critical' },
							{ label: __('High', 'vulopilot'), value: 'high' },
							{ label: __('Medium', 'vulopilot'), value: 'medium' },
							{ label: __('Low', 'vulopilot'), value: 'low' },
							{ label: __('Info', 'vulopilot'), value: 'info' },
						],
					},
				]}
			/>
			<PopupComponent
				open={isProPopupOpen}
				onClose={() => setIsProPopupOpen(false)}
				width={31.25}
				height="auto"
				position="lightbox"
			>
				{appLocalizer.khali_dabba ? (
					// Pro is active — OneClickFix specifically isn't
					// enabled, so point at Modules rather than pitching
					// an upgrade the user already has.
					<ShowProPopup moduleName="one-click-fix" />
				) : (
					<ShowProPopup />
				)}
			</PopupComponent>
		</>
	);
};

export default FindingsTable;
