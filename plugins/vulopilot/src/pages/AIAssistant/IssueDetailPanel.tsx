/* global appLocalizer */
import React, { useEffect, useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { applyFilters } from '@wordpress/hooks';
import { getApiLink, getApiResponse, sendApiResponse } from '@zyra/core';
import {
	CardComponent,
	ListComponent,
	ModuleGuardComponent,
	NoticeManager,
	PopupComponent,
	FormGroupWrapperComponent,
	FormGroupComponent,
	ClipboardComponent,
	BadgeComponent
} from '@zyra/components';
import { ButtonInput } from '@zyra/inputs';
import ShowProPopup from '../../components/Popup/Popup';
import { formatWpDate } from '../../services/formatWpDate';
import { getSeverityClass } from '../../services/getSeverityClass';
import {
	CATEGORY_ICONS,
	CATEGORY_LABELS,
	formatAffected,
	FindingGroup,
} from './issuesTypes';

interface FixOutcome {
	success: boolean;
	message: string;
}

interface FindingRow {
	id: number;
	title: string;
	object_type: string | null;
	object_ref: string | null;
	created_at: string;
	page?: string;
}

/**
 * How many individual findings to actually list under "Affected accounts"/
 * "Affected pages"/etc. — the group's own real `count` (shown right above
 * this list) is always the true total; this only bounds how many rows the
 * panel renders so a group with hundreds of open findings doesn't dump an
 * unbounded list into a fixed-width side panel. A "+N more" line covers
 * the remainder.
 */
const MAX_AFFECTED_ITEMS_SHOWN = 20;

/**
 * Section label per real `object_type` — same noun set formatAffected()
 * already uses for the bare count line, just as a section heading instead
 * of "N {noun}". Falls back to "Affected items" for any object_type this
 * map doesn't know about, same fallback formatAffected() uses.
 */
const AFFECTED_ITEMS_LABEL: Record<string, string> = {
	user: __('Affected accounts', 'vulopilot'),
	post: __('Affected pages', 'vulopilot'),
	attachment: __('Affected images', 'vulopilot'),
	product: __('Affected products', 'vulopilot'),
	url: __('Affected endpoints', 'vulopilot'),
	plugin: __('Affected plugins', 'vulopilot'),
	theme: __('Affected themes', 'vulopilot'),
	table: __('Affected tables', 'vulopilot'),
	file: __('Affected files', 'vulopilot'),
	site: __('Affected checks', 'vulopilot'),
};

/**
 * Same registration FindingsTable.tsx's own bulk "Fix selected" reads —
 * see that file's own getFindingBulkFixHandler docblock for why it's read
 * fresh on every click rather than cached.
 */
const getFindingBulkFixHandler = () =>
	applyFilters('vulopilot_finding_bulk_fix_handler', null);

const SEVERITY_LABEL: Record<string, string> = {
	critical: __('Critical Priority', 'vulopilot'),
	high: __('High Priority', 'vulopilot'),
	medium: __('Medium Priority', 'vulopilot'),
	low: __('Low Priority', 'vulopilot'),
	info: __('Low Priority', 'vulopilot'),
};

interface IssueDetailPanelProps {
	group: FindingGroup | null;
	onActionComplete: () => void;
	onClose: () => void;
}

/**
 * The Issues table's right-side detail panel — mockup shows "Why it
 * matters"/"What VuloPilot recommends"/"How to fix" sections, but no
 * scanner anywhere writes that copy (ScannerInterface only ever produces
 * title/severity/category/description — see FindingRepository::get_finding_groups()'s
 * own docblock), so this only ever shows real fields: the group's real
 * severity/category/count, one real representative finding's own title/
 * description/page ("Example finding" — clearly framed as one instance,
 * not a fabricated summary of the whole group), and real bulk actions
 * (Fix/Resolve all/Ignore all) scoped to every open finding in the group,
 * not just the one example shown.
 */
const IssueDetailPanel: React.FC<IssueDetailPanelProps> = ({
	group,
	onActionComplete,
	onClose,
}) => {
	const [isBusy, setIsBusy] = useState(false);
	const [isProPopupOpen, setIsProPopupOpen] = useState(false);
	const [affectedItems, setAffectedItems] = useState<FindingRow[] | null>(
		null
	);
	const [isLoadingAffected, setIsLoadingAffected] = useState(false);

	/**
	 * The group response only ever carries a `count` + one sample — this
	 * fetches the real, current individual findings in the group (the same
	 * `GET /findings` row list fetchGroupIds() below also reads, just kept
	 * as full rows here instead of only `.id`) so "Affected" can show which
	 * specific accounts/pages/etc. were actually detected, not just a bare
	 * number. Capped to MAX_AFFECTED_ITEMS_SHOWN for display — the group's
	 * own real `count` (shown above this list) stays the true total either
	 * way, and bulk actions below still act on every open finding via their
	 * own uncapped fetchGroupIds() call.
	 */
	useEffect(() => {
		if (!group) {
			setAffectedItems(null);
			return;
		}

		setIsLoadingAffected(true);
		setAffectedItems(null);

		getApiResponse<{ data?: FindingRow[] } | FindingRow[]>(
			getApiLink(
				appLocalizer,
				`findings?scanner_id=${encodeURIComponent(group.scanner_id)}&status=open&per_page=${MAX_AFFECTED_ITEMS_SHOWN}&orderby=id&order=desc`
			),
			{ headers: { 'X-WP-Nonce': appLocalizer.nonce } }
		)
			.then((response) => {
				const list = Array.isArray(response)
					? response
					: (response?.data ?? []);

				setAffectedItems(list);
			})
			.finally(() => setIsLoadingAffected(false));
	}, [group?.scanner_id]);

	if (!group) {
		return (
			<CardComponent title={__('Issue details', 'vulopilot')}>
				<ModuleGuardComponent
					icon="ai"
					title={__('Select an issue', 'vulopilot')}
					desc={__(
						'Choose a row from the table to see more detail here.',
						'vulopilot'
					)}
				/>
			</CardComponent>
		);
	}

	/**
	 * The group response only ever carries a `count` + one sample row, not
	 * every individual finding id — this fetches the real, current id list
	 * for the group's scanner_id right before a bulk action runs, so
	 * Fix/Resolve/Ignore act on every open finding in the group (not just
	 * the one example shown), using the same real `GET /findings` endpoint
	 * every other findings list already reads.
	 */
	const fetchGroupIds = (scannerId: string): Promise<number[]> =>
		getApiResponse<{ data?: { id: number }[] } | { id: number }[]>(
			getApiLink(
				appLocalizer,
				`findings?scanner_id=${encodeURIComponent(scannerId)}&status=open&per_page=100`
			),
			{ headers: { 'X-WP-Nonce': appLocalizer.nonce } }
		).then((response) => {
			const list = Array.isArray(response)
				? response
				: (response?.data ?? []);

			return list.map((row) => row.id);
		});

	const handleBulkStatus = (
		status: 'resolved' | 'ignored',
		successMessage: string
	) => {
		setIsBusy(true);
		fetchGroupIds(group.scanner_id)
			.then((ids) => {
				if (!ids.length) {
					return;
				}

				return sendApiResponse(
					appLocalizer,
					getApiLink(appLocalizer, 'findings/bulk'),
					{ ids, status }
				).then((response) => {
					NoticeManager.add({
						uniqueKey: `issue-group-${status}-${group.scanner_id}`,
						type: response ? 'success' : 'error',
						position: 'float',
						message: response
							? successMessage
							: __(
									'Could not update these findings. Please try again.',
									'vulopilot'
								),
					});

					if (response) {
						onActionComplete();
					}
				});
			})
			.finally(() => setIsBusy(false));
	};

	const handleFix = () => {
		const bulkFixHandler = getFindingBulkFixHandler();

		if ('function' !== typeof bulkFixHandler) {
			setIsProPopupOpen(true);
			return;
		}

		setIsBusy(true);
		fetchGroupIds(group.scanner_id)
			.then((ids) => {
				if (!ids.length) {
					return;
				}

				return Promise.resolve(
					bulkFixHandler(ids) as Promise<FixOutcome> | undefined
				).then((outcome) => {
					if (outcome?.message) {
						NoticeManager.add({
							uniqueKey: `issue-group-fix-${group.scanner_id}`,
							type: outcome.success ? 'success' : 'error',
							position: 'float',
							message: outcome.message,
						});
					}

					onActionComplete();
				});
			})
			.finally(() => setIsBusy(false));
	};

	return (
		<>
			<CardComponent
				className="issue-detail-panel"
				title={group.label}
				titleIcon="error"
				action={
					<i
						className="adminfont-close"
						role="button"
						tabIndex={0}
						aria-label={__('Close', 'vulopilot')}
						onClick={onClose}
						onKeyDown={(e) => {
							if ('Enter' === e.key || ' ' === e.key) {
								e.preventDefault();
								onClose();
							}
						}}
					/>
				}
			>
				<FormGroupWrapperComponent>
					<FormGroupComponent   row label={__('Priority', 'vulopilot')}>
						<BadgeComponent
							color={getSeverityClass(group.severity)}
							text={SEVERITY_LABEL[group.severity]}
						/>
					</FormGroupComponent>
					<FormGroupComponent   row label={__('Category', 'vulopilot')}>
						<BadgeComponent
							color="blue"
							text={CATEGORY_LABELS[group.category] ?? group.category}
						/>
					</FormGroupComponent>
					<FormGroupComponent   row label={__('Affected', 'vulopilot')}>
						{formatAffected(group.count, group.object_type)}
					</FormGroupComponent>
					{group.sample && (
						<FormGroupComponent   row label={__('Example finding', 'vulopilot')}>
							<span className="desc">
								{group.sample.title}
							</span>
							<span className="desc">
								{group.sample.description}
							</span>
						</FormGroupComponent>
					)}

					{group.sample && (
						<FormGroupComponent  row label={__('Where', 'vulopilot')}>
							<ClipboardComponent
								text={group.sample.page || __('Site-wide', 'vulopilot')}
								variant="code"
								copyButtonLabel={__('Copy', 'vulopilot')}
								copiedLabel={__('Copied!', 'vulopilot')}
							/>
							<div className="small desc">
								{sprintf(
									/* translators: %s: formatted date this finding was detected */
									__('Detected %s', 'vulopilot'),
									formatWpDate(group.sample.created_at)
								)}
							</div>
						</FormGroupComponent>
					)}
					{/* No `row` here unlike the fields above — this holds a
					whole list, not one short value, so squeezing it into
					the same narrow side-by-side layout as Priority/
					Category/Affected forced every row to wrap badly. The
					label sits above the list instead, full width. */}
					<FormGroupComponent
						label={
							AFFECTED_ITEMS_LABEL[group.object_type ?? ''] ??
							__('Affected items', 'vulopilot')
						}
					>
						<ListComponent
							className="mini-card report"
							loading={isLoadingAffected}
							items={(affectedItems ?? []).map((row, index) => ({
								id: row.id,
								number: index + 1,
								icon: CATEGORY_ICONS[group.category] ?? 'ai',
								title: row.title,
								desc: sprintf(
									/* translators: 1: affected page/location, 2: formatted detection date */
									__('%1$s • Detected %2$s', 'vulopilot'),
									row.page || __('Site-wide', 'vulopilot'),
									formatWpDate(row.created_at)
								),
							}))}
						/>
						{!isLoadingAffected &&
							affectedItems &&
							0 === affectedItems.length && (
								<span className="desc">
									{__(
										'No individual findings could be loaded for this group right now.',
										'vulopilot'
									)}
								</span>
							)}
						{!isLoadingAffected &&
							affectedItems &&
							group.count > affectedItems.length && (
								<span className="small desc">
									{sprintf(
										/* translators: %d: how many further open findings exist beyond the list shown above */
										__(
											'+%d more not shown here — use Resolve all/Ignore all below, or open the Issues table to see every one.',
											'vulopilot'
										),
										group.count - affectedItems.length
									)}
								</span>
							)}
					</FormGroupComponent>
				</FormGroupWrapperComponent>

				<ButtonInput
					position="full-width"
					buttons={[
						{
							text: __('Fix with AI', 'vulopilot'),
							icon: 'ai',
							onClick: handleFix,
							disabled: isBusy,
						},
						{
							text: __('Resolve all', 'vulopilot'),
							color: 'border-purple',
							onClick: () =>
								handleBulkStatus(
									'resolved',
									__(
										'All findings in this group marked resolved.',
										'vulopilot'
									)
								),
							disabled: isBusy,
						},
						{
							text: __('Ignore all', 'vulopilot'),
							color: 'border-purple',
							onClick: () =>
								handleBulkStatus(
									'ignored',
									__(
										'All findings in this group ignored.',
										'vulopilot'
									)
								),
							disabled: isBusy,
						},
					]}
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
					<ShowProPopup moduleName="one-click-fix" />
				) : (
					<ShowProPopup />
				)}
			</PopupComponent>
		</>
	);
};

export default IssueDetailPanel;
