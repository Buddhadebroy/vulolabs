/* global appLocalizer */
import React, { useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { applyFilters } from '@wordpress/hooks';
import { getApiLink, getApiResponse, sendApiResponse } from '@zyra/core';
import {
	CardComponent,
	ModuleGuardComponent,
	NoticeManager,
	PopupComponent,
} from '@zyra/components';
import { ButtonInput } from '@zyra/inputs';
import ShowProPopup from '../../components/Popup/Popup';
import { formatWpDate } from '../../services/formatWpDate';
import { CATEGORY_LABELS, formatAffected, FindingGroup } from './issuesTypes';

interface FixOutcome {
	success: boolean;
	message: string;
}

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
				title={SEVERITY_LABEL[group.severity]}
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
				<h2 className="issue-detail-title">{group.label}</h2>
				<span className="admin-badge blue">
					{CATEGORY_LABELS[group.category] ?? group.category}
				</span>

				<div className="issue-detail-section">
					<h4>{__('Affected', 'vulopilot')}</h4>
					<p>{formatAffected(group.count, group.object_type)}</p>
				</div>

				{group.sample && (
					<div className="issue-detail-section">
						<h4>{__('Example finding', 'vulopilot')}</h4>
						<p className="issue-detail-example-title">
							{group.sample.title}
						</p>
						<p className="issue-detail-example-desc">
							{group.sample.description}
						</p>
					</div>
				)}

				{group.sample && (
					<div className="issue-detail-section">
						<h4>{__('Where', 'vulopilot')}</h4>
						<div className="issue-detail-where">
							<code>
								{group.sample.page ||
									__('Site-wide', 'vulopilot')}
							</code>
							<span
								role="button"
								className="issue-detail-copy-btn"
								onClick={() => {
									navigator.clipboard
										.writeText(group.sample?.page || '')
										.then(() => {
											NoticeManager.add({
												uniqueKey:
													'issue-detail-copy',
												type: 'success',
												position: 'float',
												message: __(
													'Copied.',
													'vulopilot'
												),
											});
										});
								}}
							>
								<i className="adminfont-coding" />
							</span>
						</div>
						<p className="small desc">
							{sprintf(
								/* translators: %s: formatted date this finding was detected */
								__('Detected %s', 'vulopilot'),
								formatWpDate(group.sample.created_at)
							)}
						</p>
					</div>
				)}

				<div className="issue-detail-actions">
					<ButtonInput
						buttons={{
							text: __('Fix with AI', 'vulopilot'),
							icon: 'ai',
							onClick: handleFix,
							disabled: isBusy,
						}}
					/>
					<ButtonInput
						buttons={{
							text: __('Resolve all', 'vulopilot'),
							color: 'secondary',
							onClick: () =>
								handleBulkStatus(
									'resolved',
									__(
										'All findings in this group marked resolved.',
										'vulopilot'
									)
								),
							disabled: isBusy,
						}}
					/>
					<ButtonInput
						buttons={{
							text: __('Ignore all', 'vulopilot'),
							color: 'secondary',
							onClick: () =>
								handleBulkStatus(
									'ignored',
									__(
										'All findings in this group ignored.',
										'vulopilot'
									)
								),
							disabled: isBusy,
						}}
					/>
				</div>
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
