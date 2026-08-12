/* global appLocalizer */
import React, { useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { getApiLink, sendApiResponse } from '@zyra/core';
import { CardComponent, ModuleGuardComponent, NoticeManager, FormGroupWrapperComponent, FormGroupComponent } from '@zyra/components';
import { ButtonInput } from '@zyra/inputs';
import { formatWpDate } from '../../services/formatWpDate';
import { HistoryRow, rowTitle } from './historyTypes';

const SEVERITY_LABEL: Record<string, string> = {
	critical: __('Critical', 'vulopilot'),
	high: __('High', 'vulopilot'),
	medium: __('Medium', 'vulopilot'),
	low: __('Low', 'vulopilot'),
	info: __('Info', 'vulopilot'),
};

const CHANGE_STATUS_LABEL: Record<string, string> = {
	pending_approval: __('Pending approval', 'vulopilot'),
	executed: __('Applied', 'vulopilot'),
	failed: __('Failed', 'vulopilot'),
	rejected: __('Rejected', 'vulopilot'),
	rolled_back: __('Rolled back', 'vulopilot'),
};

interface HistoryDetailPanelProps {
	row: HistoryRow | null;
	onClose: () => void;
	/* eslint-disable-next-line no-unused-vars -- named param on a type-only call signature; base no-unused-vars doesn't recognize TS call-signature parameters, same as StatWidget.tsx's StatWidgetConfig. */
	onDeleted: (row: HistoryRow) => void;
}

/**
 * The History timeline's right-side detail panel — real per-type detail
 * only, no fabricated "what you asked"/"related actions" copy (there's no
 * real conversation concept to back that with yet, see historyTypes.ts and
 * Controllers/History.php's own docblocks): a scan row shows its real
 * per-severity finding breakdown from `vulopilot_scans.summary`; a change
 * row shows its real before/after text from `vulopilot_ai_action_runs.preview`.
 */
const HistoryDetailPanel: React.FC<HistoryDetailPanelProps> = ({
	row,
	onClose,
	onDeleted,
}) => {
	const [isDeleting, setIsDeleting] = useState(false);

	if (!row) {
		return (
			<CardComponent title={__('Selected item', 'vulopilot')}>
				<ModuleGuardComponent
					icon="ai"
					title={__('Select an item', 'vulopilot')}
					desc={__(
						'Choose an entry from the timeline to see more detail here.',
						'vulopilot'
					)}
				/>
			</CardComponent>
		);
	}

	const handleDelete = () => {
		setIsDeleting(true);

		sendApiResponse<{ success?: boolean }>(
			appLocalizer,
			getApiLink(appLocalizer, `history/${row.id}`),
			{}
		)
			.then((response) => {
				NoticeManager.add({
					uniqueKey: `history-delete-${row.id}`,
					type: response ? 'success' : 'error',
					position: 'float',
					message: response
						? __('Removed from history.', 'vulopilot')
						: __(
								'Could not delete this history entry. Please try again.',
								'vulopilot'
							),
				});

				if (response) {
					onDeleted(row);
				}
			})
			.finally(() => setIsDeleting(false));
	};

	return (
		<CardComponent
			className="issue-detail-panel history-detail-panel"
			title={__('Selected item', 'vulopilot')}
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
			<div className="title">{rowTitle(row)}</div>
			<p className="small desc">
				{sprintf(
					/* translators: %s: formatted date this event happened */
					__('%s', 'vulopilot'),
					formatWpDate(row.created_at)
				)}
			</p>
			
			<FormGroupWrapperComponent>
			{row.scan && (
				<>
				<FormGroupComponent row label={__('Status', 'vulopilot')}>
					<span className='buttons-wrapper'>
						<span className='admin-badge green'>
						{'completed' === row.scan.status
							? __('Completed', 'vulopilot')
							: row.scan.status}
						</span>
						<span className='admin-badge yellow'>
							{__('Manually triggered', 'vulopilot')}
						</span>
					</span>
				</FormGroupComponent>
				<FormGroupComponent row label={__('Findings', 'vulopilot')}>
					{row.scan.total > 0 ? (
						<ul className="history-severity-breakdown">
							{Object.entries(row.scan.by_severity).map(
								([severity, count]) => (
									<li key={severity}>
										<span
											className={`admin-badge badge-${severity}`}
										>
											{SEVERITY_LABEL[severity] ??
												severity}
										</span>
										{Number(count)}
									</li>
								)
							)}
						</ul>
					) : (
						<>{__('No issues found.', 'vulopilot')}</>
					)}
				</FormGroupComponent>
				{row.scan.total > 0 && (
					<ButtonInput
						position='full-width'
						buttons={{
							text: __('View findings', 'vulopilot'),
							icon: 'search',
							onClick: () => {
								window.location.href = `${appLocalizer.admin_url}#&tab=ai-assistant&subtab=issues&scanner_id=${encodeURIComponent(row.scan?.scanner_id ?? '')}`;
							},
						}}
					/>
				)}
				</>
			)}

			{row.change && (
				<>
					<div className="issue-detail-section">
						<h4>{__('Status', 'vulopilot')}</h4>
						<p>
							{CHANGE_STATUS_LABEL[row.change.status] ??
								row.change.status}
						</p>
					</div>

					{(null !== row.change.before ||
						null !== row.change.after) && (
						<div className="issue-detail-section">
							<h4>{__('Before', 'vulopilot')}</h4>
							<p className="issue-detail-example-desc">
								{row.change.before ||
									__('(new content)', 'vulopilot')}
							</p>
							<h4>{__('After', 'vulopilot')}</h4>
							<p className="issue-detail-example-title">
								{row.change.after}
							</p>
						</div>
					)}

					{row.change.page && (
						<div className="issue-detail-section">
							<h4>{__('Where', 'vulopilot')}</h4>
							<div className="issue-detail-where">
								<code>{row.change.page}</code>
							</div>
						</div>
					)}

					{row.change.error_message && (
						<div className="issue-detail-section">
							<h4>{__('Error', 'vulopilot')}</h4>
							<p>{row.change.error_message}</p>
						</div>
					)}
				</>
			)}
		</FormGroupWrapperComponent>
				<ButtonInput
					position='full-width'
					buttons={{
						text: __('Delete from history', 'vulopilot'),
						icon: 'delete',
						color: 'border-red',
						onClick: handleDelete,
						disabled: isDeleting,
					}}
				/>
		</CardComponent>
	);
};

export default HistoryDetailPanel;
