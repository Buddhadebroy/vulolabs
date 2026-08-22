/* global appLocalizer */
import React, { useState } from 'react';
import { __, _n, sprintf } from '@wordpress/i18n';
import { getApiLink, sendApiResponse } from '@zyra/core';
import { CardComponent, ModuleGuardComponent, NoticeManager, FormGroupWrapperComponent, FormGroupComponent, BadgeComponent } from '@zyra/components';
import { ButtonInput } from '@zyra/inputs';
import { formatWpDate } from '../../services/formatWpDate';
import {
	HistoryRow,
	rowTitle,
	rowTime,
	humanizeConversationExcerpt,
} from '../AIAssistant/historyTypes';

const SEVERITY_LABEL: Record<string, string> = {
	critical: __('Critical', 'vulopilot'),
	high: __('High', 'vulopilot'),
	medium: __('Medium', 'vulopilot'),
	low: __('Low', 'vulopilot'),
	info: __('Info', 'vulopilot'),
};

/**
 * Plain-English "what does this actually check" copy, one per
 * `scanner_id` — added because a site-wide scanner (nothing per-post to
 * check, e.g. Cron/Database/Server) previously left this panel with
 * nothing beyond "Status"/"Findings: No issues found." once
 * `affected_pages` and `scanned_pages` were both empty (see the render
 * logic below): a page-scoped scanner's own "Pages & posts scanned"
 * section already explains itself, but a site-wide one had no equivalent
 * at all. Not exhaustive — every scanner in SCANNERS.md would be a lot to
 * hand-maintain here and keep in sync — just the scanners a user is
 * actually likely to click into from History with no other detail to
 * show (every site-wide, non-page-scoped check). Anything else falls
 * back to a generic, still-honest note below rather than showing nothing.
 */
const SCAN_DESCRIPTIONS: Record<string, string> = {
	cron: __(
		'Checks whether WordPress’s own scheduled tasks (WP-Cron) are running on time, or stuck/overdue.',
		'vulopilot'
	),
	database: __(
		'Checks for database bloat — excess post revisions and other buildup that can slow queries down.',
		'vulopilot'
	),
	'database-cleanup': __(
		'Checks for expired transients and other safe-to-clear database clutter.',
		'vulopilot'
	),
	'server-health': __(
		"Checks your hosting environment against WordPress's own recommended server requirements.",
		'vulopilot'
	),
	'wordpress-health': __(
		'Checks WordPress core’s own Site Health status — the same checks under Tools → Site Health.',
		'vulopilot'
	),
	updates: __(
		'Checks for pending WordPress core, plugin, and theme updates.',
		'vulopilot'
	),
	plugins: __(
		'Checks for installed-but-inactive plugins, which still carry any known vulnerabilities on disk.',
		'vulopilot'
	),
	themes: __('Checks for installed-but-inactive themes.', 'vulopilot'),
	'php-warnings': __(
		"Checks your site's debug log for recent PHP warnings, notices, and fatal errors.",
		'vulopilot'
	),
	'weak-passwords': __(
		'Checks every administrator’s password against a list of commonly used, easily guessed passwords.',
		'vulopilot'
	),
	'basic-vulnerabilities': __(
		'Checks for common WordPress hardening gaps that make a known vulnerability easier to exploit.',
		'vulopilot'
	),
	'core-file-integrity': __(
		'Compares WordPress core files against their official checksums to detect unauthorized changes.',
		'vulopilot'
	),
	malware: __(
		'Checks for signs of malicious code hidden in your files.',
		'vulopilot'
	),
	'login-protection': __(
		'Checks recent login attempts for signs of a brute-force attack.',
		'vulopilot'
	),
	firewall: __(
		'Checks recent firewall activity for blocked malicious requests.',
		'vulopilot'
	),
	'backup-health': __(
		'Checks whether your automatic backups are running on schedule.',
		'vulopilot'
	),
	'ssl-monitoring': __(
		'Checks whether your site is served over HTTPS, and whether your SSL certificate is close to expiring.',
		'vulopilot'
	),
	'site-availability': __(
		'Checks whether your homepage is reachable and responding normally.',
		'vulopilot'
	),
	'not-found': __(
		'Checks whether your own published posts and pages still resolve correctly.',
		'vulopilot'
	),
	'redirect-analysis': __(
		'Checks your homepage’s own redirect chain for unnecessary or broken hops.',
		'vulopilot'
	),
};

/** Fallback for any `scanner_id` not in SCAN_DESCRIPTIONS above — still honest (doesn't fabricate what the scan does), just generic. */
const GENERIC_SCAN_DESCRIPTION = __(
	'A site-wide check — not tied to individual pages or posts.',
	'vulopilot'
);

/** `duration_ms` is real (ScanResult::get_duration_ms(), persisted on every scan row) but was never shown anywhere in this panel — under a second reads as milliseconds, at or above reads as seconds to one decimal place. */
const formatScanDuration = (durationMs: number): string =>
	durationMs < 1000
		? sprintf(
				/* translators: %d: milliseconds */
				__('%dms', 'vulopilot'),
				Math.round(durationMs)
			)
		: sprintf(
				/* translators: %s: seconds, one decimal place */
				__('%ss', 'vulopilot'),
				(durationMs / 1000).toFixed(1)
			);

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
	/** Called after a real, successful rollback so the caller can reload the timeline — a rollback also writes its own new 'ai_action.rolled_back' history row server-side (ActionRunner::rollback()'s own log() call), so a local-only status patch here would still miss that new row. */
	onRolledBack: () => void;
	/* eslint-disable-next-line no-unused-vars -- named param on a type-only call signature, same as onDeleted above. */
	onSelectRelatedAction: (id: number) => void;
}

/**
 * The History timeline's right-side detail panel — real per-type detail
 * only, no fabricated "related actions" copy: a scan row shows its real
 * per-severity finding breakdown from `vulopilot_scans.summary`; a change
 * row shows its real before/after text from `vulopilot_ai_action_runs.preview`;
 * a conversation row shows its real provider/model plus the same
 * humanized reply text (humanizeConversationExcerpt()) the timeline row's
 * own title already uses, just untruncated.
 *
 * "Undo this change" calls the already-real, already-working
 * `POST /ai-action-runs/{id}/rollback` (AIActions\ActionRunner::rollback(),
 * ActionRunRegistry's own snapshot/rollback() pair on every registered
 * action) — that backend has existed since AI-ACTIONS.md's own pass, but
 * no UI anywhere called it, so every executed AI change was permanently
 * un-revertable from the UI even though the server could already do it.
 * Only ever shown for a `row.change.status === 'executed'` run — the one
 * status ActionRunner::rollback() itself will actually accept (a
 * 'pending_approval'/'rejected'/'failed'/already-'rolled_back' run
 * correctly has no Undo control here, same "don't offer what can't
 * succeed" posture the disabled Undo stubs elsewhere in this codebase
 * already use, just made real here instead of staying disabled).
 */
const HistoryDetailPanel: React.FC<HistoryDetailPanelProps> = ({
	row,
	onClose,
	onDeleted,
	onRolledBack,
	onSelectRelatedAction,
}) => {
	const [isDeleting, setIsDeleting] = useState(false);
	const [isRollingBack, setIsRollingBack] = useState(false);

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

	const handleRollback = () => {
		if (!row.change) {
			return;
		}

		setIsRollingBack(true);

		sendApiResponse<{ success?: boolean }>(
			appLocalizer,
			getApiLink(appLocalizer, `ai-action-runs/${row.change.id}/rollback`),
			{}
		)
			.then((response) => {
				NoticeManager.add({
					uniqueKey: `history-rollback-${row.change?.id}`,
					type: response ? 'success' : 'error',
					position: 'float',
					message: response
						? __('Change undone.', 'vulopilot')
						: __(
								'Could not undo this change. Please try again.',
								'vulopilot'
							),
				});

				if (response) {
					onRolledBack();
				}
			})
			.finally(() => setIsRollingBack(false));
	};

	return (
		<CardComponent
			className="issue-detail-panel history-detail-panel"
			title={rowTitle(row)}
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
						<BadgeComponent
							color="green"
							text={
								'completed' === row.scan.status
									? __('Completed', 'vulopilot')
									: row.scan.status
							}
						/>
						<BadgeComponent
							color="yellow"
							text={__('Manually triggered', 'vulopilot')}
						/>
					</span>
				</FormGroupComponent>
				<FormGroupComponent row label={__('Findings', 'vulopilot')}>
					{row.scan.total > 0 ? (
						<ul className="history-severity-breakdown">
							{Object.entries(row.scan.by_severity).map(
								([severity, count]) => (
									<li key={severity}>
										<BadgeComponent
											color={`badge-${severity}`}
											text={SEVERITY_LABEL[severity] ??
												severity}
										/>
										{Number(count)}
									</li>
								)
							)}
						</ul>
					) : (
						<>{__('No issues found.', 'vulopilot')}</>
					)}
				</FormGroupComponent>
				<div className="issue-detail-section">
					<h4>{__('What this checks', 'vulopilot')}</h4>
					<p className="small desc">
						{SCAN_DESCRIPTIONS[row.scan.scanner_id] ??
							GENERIC_SCAN_DESCRIPTION}
					</p>
				</div>
				{null !== row.scan.duration_ms && (
					<FormGroupComponent row label={__('Duration', 'vulopilot')}>
						{formatScanDuration(row.scan.duration_ms)}
					</FormGroupComponent>
				)}
				{row.scan.affected_pages.length > 0 && (
					<div className="issue-detail-section">
						<h4>{__('Pages & posts', 'vulopilot')}</h4>
						<ul className="history-affected-pages">
							{row.scan.affected_pages.map((page) => (
								<li key={page.id}>
									{page.edit_link ? (
										<a
											href={page.edit_link}
											target="_blank"
											rel="noreferrer"
										>
											{page.title}
										</a>
									) : (
										<span>{page.title}</span>
									)}
									<span className="history-affected-page-count">
										{sprintf(
											_n(
												'%d issue',
												'%d issues',
												page.count,
												'vulopilot'
											),
											page.count
										)}
									</span>
								</li>
							))}
						</ul>
					</div>
				)}
				{0 === row.scan.total &&
					row.scan.scanned_pages.length > 0 && (
						<div className="issue-detail-section">
							<h4>
								{sprintf(
									/* translators: %d: number of pages/posts scanned */
									__(
										'Pages & posts scanned (%d)',
										'vulopilot'
									),
									row.scan.scanned_pages.length
								)}
							</h4>
							<ul className="history-affected-pages history-scanned-pages">
								{row.scan.scanned_pages.map((page) => (
									<li key={page.id}>
										<a
											href={page.edit_link}
											target="_blank"
											rel="noreferrer"
										>
											{page.title}
										</a>
										<span className="history-affected-page-count history-scanned-page-clean">
											{__('Clean', 'vulopilot')}
										</span>
									</li>
								))}
							</ul>
						</div>
					)}
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
							{'auto_automation' === row.change.approval_method && (
								<span className="history-auto-approved-note">
									{__(
										' — Auto-approved by automation',
										'vulopilot'
									)}
								</span>
							)}
							{'auto_unattended' === row.change.approval_method && (
								<span className="history-auto-approved-note">
									{__(
										' — Applied automatically (no approval required by Approval Settings)',
										'vulopilot'
									)}
								</span>
							)}
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
							<div className="issue-detail-example-title">
								{row.change.after}
							</div>
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

					{'executed' === row.change.status && (
						<ButtonInput
							position='full-width'
							buttons={{
								text: isRollingBack
									? __('Undoing…', 'vulopilot')
									: __('Undo this change', 'vulopilot'),
								icon: 'undo',
								color: 'border-purple',
								onClick: handleRollback,
								disabled: isRollingBack,
							}}
						/>
					)}
				</>
			)}

			{row.conversation && (
				<>
					{row.conversation.prompt_excerpt && (
						<div className="issue-detail-section">
							<h4>{__('You asked', 'vulopilot')}</h4>
							<p className="issue-detail-example-desc">
								{row.conversation.prompt_excerpt}
							</p>
						</div>
					)}
					<FormGroupComponent row label={__('Provider', 'vulopilot')}>
						{row.conversation.model
							? `${row.conversation.provider} (${row.conversation.model})`
							: row.conversation.provider}
					</FormGroupComponent>
					<div className="issue-detail-section">
						<h4>{__('Reply', 'vulopilot')}</h4>
						<p className="issue-detail-example-desc">
							{humanizeConversationExcerpt(
								row.conversation.excerpt,
								row.conversation.status
							)}
						</p>
					</div>
					{row.conversation.related_actions.length > 0 && (
						<div className="issue-detail-section">
							<h4>
								{__(
									'Related actions (from this conversation)',
									'vulopilot'
								)}
							</h4>
							<ul className="history-related-actions">
								{row.conversation.related_actions.map(
									(action) => (
										<li key={action.id}>
											<span
												className="history-related-action-link"
												role="button"
												tabIndex={0}
												onClick={() =>
													onSelectRelatedAction(
														action.id
													)
												}
												onKeyDown={(event) => {
													if (
														'Enter' ===
															event.key ||
														' ' === event.key
													) {
														event.preventDefault();
														onSelectRelatedAction(
															action.id
														);
													}
												}}
											>
												{action.label}
											</span>
											<span className="history-related-action-time">
												{rowTime(action.created_at)}
											</span>
										</li>
									)
								)}
							</ul>
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
