/* global appLocalizer */
import { useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { getApiLink, sendApiResponse } from '@zyra/core';
import {
	CardComponent,
	ModuleGuardComponent,
	NoticeManager,
	PopupComponent,
} from '@zyra/components';
import { ButtonInput } from '@zyra/inputs';
import { useApiList } from '../../services/useApiList';
import { formatWpDate } from '../../services/formatWpDate';
import './ProtectMySite.scss';

/** `id: 'backups'` (Settings/Scanning/Backups.ts) — where the real "schedule automatic backups" toggle/frequency this card's own empty state used to describe in text actually lives. */
const BACKUPS_SETTINGS_URL = '?page=vulopilot#&tab=settings&subtab=backups';

interface BackupRow {
	id: number;
	status: 'queued' | 'running' | 'completed' | 'failed';
	trigger_type: 'manual' | 'scheduled' | 'pre_restore_safety';
	has_file: boolean;
	file_size: number | null;
	/** 'local' (the default — every backup always saves here) or the remote destination active when this backup finished (Services\BackupStorageManager). */
	destination: 'local' | 's3' | 'google_drive';
	/** Null for a 'local'-only row (nothing else to track) — see Install.php's own `create_backups_table()` docblock for what each real value means. */
	destination_status: 'uploading' | 'uploaded' | 'failed' | 'skipped_not_configured' | null;
	destination_error: string | null;
	started_at: string | null;
	finished_at: string | null;
	error_message: string | null;
	created_at: string;
}

const STATUS_BADGE: Record<string, { text: string; className: string }> = {
	queued: { text: __('Queued', 'vulopilot'), className: 'indigo' },
	running: { text: __('Running', 'vulopilot'), className: 'orange' },
	completed: { text: __('Completed', 'vulopilot'), className: 'green' },
	failed: { text: __('Failed', 'vulopilot'), className: 'red' },
};

const TRIGGER_LABEL: Record<string, string> = {
	manual: __('Manual', 'vulopilot'),
	scheduled: __('Scheduled', 'vulopilot'),
	pre_restore_safety: __('Pre-restore safety snapshot', 'vulopilot'),
};

const DESTINATION_PROVIDER_LABEL: Record<string, string> = {
	s3: __('Amazon S3', 'vulopilot'),
	google_drive: __('Google Drive', 'vulopilot'),
};

/**
 * A real remote destination's own upload badge — `null` for a `'local'`
 * row, rendered as plain text instead (every backup is local; a badge
 * there would just be visual noise for the common case). Reflects exactly
 * what `Services\BackupStorageManager` actually did for this row, not the
 * site's *current* `backup_storage_destination` setting (e.g. deleting the
 * S3 credentials after a real upload succeeded doesn't retroactively
 * change what already happened).
 */
const destinationBadge = (
	row: BackupRow
): { text: string; className: string } | null => {
	if ('local' === row.destination || !row.destination) {
		return null;
	}

	const provider = DESTINATION_PROVIDER_LABEL[row.destination] ?? row.destination;

	switch (row.destination_status) {
		case 'uploading':
			return {
				text: sprintf(__('Uploading to %s…', 'vulopilot'), provider),
				className: 'orange',
			};
		case 'uploaded':
			return {
				text: sprintf(__('Uploaded to %s', 'vulopilot'), provider),
				className: 'green',
			};
		case 'failed':
			return {
				text: sprintf(__('%s upload failed', 'vulopilot'), provider),
				className: 'red',
			};
		case 'skipped_not_configured':
			return {
				text: sprintf(__('%s not configured', 'vulopilot'), provider),
				className: 'yellow',
			};
		default:
			return { text: provider, className: 'indigo' };
	}
};

/** Real file size, human-scaled — same rounding convention this codebase's other byte-count displays already use. */
const formatFileSize = (bytes: number | null): string => {
	if (!bytes) {
		return '—';
	}

	const mb = bytes / (1024 * 1024);

	return mb >= 1
		? sprintf('%s MB', mb.toFixed(1))
		: sprintf('%s KB', (bytes / 1024).toFixed(0));
};

/** Typed-confirmation gate — Recovery's second safety net (the first is BackupManager::restore()'s own automatic pre-restore snapshot; the third is its real activity-log audit entry). */
const RESTORE_CONFIRM_PHRASE = 'RESTORE';

/**
 * "Backups" tab of "Protect My Site" — real backup creation, listing,
 * download, delete, and Recovery's real restore (RestAPI\Controllers\Backups,
 * Services\BackupManager). Every row is a real `vulopilot_backups` run —
 * manual, scheduled (Settings → Scanning → Backups), or a
 * `pre_restore_safety` snapshot Recovery takes automatically before every
 * real restore. Restore is real and destructive (overwrites the live
 * database + files) — gated here by a typed confirmation phrase, on top of
 * the automatic pre-restore safety snapshot the backend always takes first.
 *
 * "Destination" column — real per-row remote-upload state
 * (Services\BackupStorageManager, `destination`/`destination_status`/
 * `destination_error`), not just the site's current
 * `backup_storage_destination` setting: a `'local'` row (the default —
 * every backup always saves here regardless) renders as plain text, while
 * an `'s3'`/`'google_drive'` row shows what actually happened
 * (Uploading…/Uploaded/upload failed/not configured) via
 * `destinationBadge()`. Credentials for those 2 remote destinations live
 * in Settings → Backups' own "Cloud Storage" section
 * (BackupStoragePanel.tsx), not on this tab.
 */
const BackupsTab = () => {
	const { data, isLoading, error, refetch } = useApiList<BackupRow>(
		'backups',
		{ per_page: 20, orderby: 'id', order: 'desc' }
	);

	const [isCreating, setIsCreating] = useState(false);
	const [busyId, setBusyId] = useState<number | null>(null);
	const [restoreTarget, setRestoreTarget] = useState<BackupRow | null>(null);
	const [confirmText, setConfirmText] = useState('');
	const [isRestoring, setIsRestoring] = useState(false);

	const handleCreate = () => {
		setIsCreating(true);

		sendApiResponse<{ success: boolean }>(
			appLocalizer,
			getApiLink(appLocalizer, 'backups'),
			{}
		)
			.then((response) => {
				NoticeManager.add({
					uniqueKey: 'vulopilot-backup-create',
					type: response?.success ? 'success' : 'error',
					position: 'float',
					message: response?.success
						? __(
								'Backup started — this runs in the background and will appear below as it progresses.',
								'vulopilot'
							)
						: __(
								'Could not start the backup. Please try again.',
								'vulopilot'
							),
				});
				refetch();
			})
			.finally(() => setIsCreating(false));
	};

	const handleDownload = (row: BackupRow) => {
		// Real browser navigation, not an XHR — the nonce travels as a query
		// param instead of the X-WP-Nonce header, same pattern
		// ReportTab.tsx's own download button already established.
		const baseUrl = getApiLink(appLocalizer, `backups/${row.id}/download`);
		const separator = baseUrl.includes('?') ? '&' : '?';
		window.open(`${baseUrl}${separator}_wpnonce=${appLocalizer.nonce}`, '_blank');
	};

	const handleDelete = (row: BackupRow) => {
		if (
			!window.confirm(
				__('Delete this backup? This cannot be undone.', 'vulopilot')
			)
		) {
			return;
		}

		setBusyId(row.id);

		fetch(`${getApiLink(appLocalizer, 'backups')}/${row.id}`, {
			method: 'DELETE',
			headers: { 'X-WP-Nonce': appLocalizer.nonce },
		})
			.then((response) => {
				NoticeManager.add({
					uniqueKey: `vulopilot-backup-delete-${row.id}`,
					type: response.ok ? 'success' : 'error',
					position: 'float',
					message: response.ok
						? __('Backup deleted.', 'vulopilot')
						: __('Could not delete this backup. Please try again.', 'vulopilot'),
				});

				if (response.ok) {
					refetch();
				}
			})
			.finally(() => setBusyId(null));
	};

	const handleRestoreConfirmed = () => {
		if (!restoreTarget) {
			return;
		}

		setIsRestoring(true);

		sendApiResponse<{ success: boolean; message?: string }>(
			appLocalizer,
			getApiLink(appLocalizer, `backups/${restoreTarget.id}/restore`),
			{}
		)
			.then((response) => {
				NoticeManager.add({
					uniqueKey: `vulopilot-backup-restore-${restoreTarget.id}`,
					type: response?.success ? 'success' : 'error',
					position: 'float',
					message: response?.success
						? __(
								'Restore complete. A safety snapshot of the previous state was taken automatically before this restore ran.',
								'vulopilot'
							)
						: response?.message ||
							__(
								'Restore failed — the site was not changed. Check the error above and try again.',
								'vulopilot'
							),
				});

				if (response?.success) {
					refetch();
				}
			})
			.finally(() => {
				setIsRestoring(false);
				setRestoreTarget(null);
				setConfirmText('');
			});
	};

	if (error) {
		return (
			<CardComponent title={__('Backups', 'vulopilot')}>
				<ModuleGuardComponent
					icon="error"
					title={__('Could not load backups', 'vulopilot')}
					desc={error}
					buttonText={__('Retry', 'vulopilot')}
					onButtonClick={refetch}
				/>
			</CardComponent>
		);
	}

	return (
		<>
			<CardComponent
				title={__('Backups', 'vulopilot')}
				titleIcon="cloud-upload"
				desc={__(
					'Real database + file archives, always stored on this server — also uploaded to Amazon S3/Google Drive if you set a remote destination in Settings.',
					'vulopilot'
				)}
				action={
					<>
						<ButtonInput
							buttons={{
								text: isCreating
									? __('Starting…', 'vulopilot')
									: __('Create Backup Now', 'vulopilot'),
								icon: 'cloud-upload',
								onClick: handleCreate,
								disabled: isCreating,
							}}
						/>
						<ButtonInput
							buttons={{
								text: '',
								icon: 'setting',
								color: 'plain',
								onClick: () => {
									window.location.href = BACKUPS_SETTINGS_URL;
								},
							}}
						/>
					</>
				}
				isLoading={isLoading}
			>
				{!isLoading && 0 === data.length ? (
					<ModuleGuardComponent
						icon="cloud-upload"
						title={__('No backups yet', 'vulopilot')}
						desc={__(
							'Create one to get started.',
							'vulopilot'
						)}
					/>
				) : (
					<div className="backups-table-wrap">
						<table className="backups-table">
							<thead>
								<tr>
									<th>{__('Date', 'vulopilot')}</th>
									<th>{__('Trigger', 'vulopilot')}</th>
									<th>{__('Status', 'vulopilot')}</th>
									<th>{__('Destination', 'vulopilot')}</th>
									<th>{__('Size', 'vulopilot')}</th>
									<th>{__('Action', 'vulopilot')}</th>
								</tr>
							</thead>
							<tbody>
								{data.map((row) => {
									const badge =
										STATUS_BADGE[row.status] ?? STATUS_BADGE.queued;
									const destBadge = destinationBadge(row);
									const isBusy = busyId === row.id;

									return (
										<tr key={row.id}>
											<td>{formatWpDate(row.created_at)}</td>
											<td>
												{TRIGGER_LABEL[row.trigger_type] ??
													row.trigger_type}
											</td>
											<td>
												<span
													className={`admin-badge ${badge.className}`}
												>
													{badge.text}
												</span>
												{'failed' === row.status &&
													row.error_message && (
														<div className="backups-error-message">
															{row.error_message}
														</div>
													)}
											</td>
											<td>
												{destBadge ? (
													<>
														<span
															className={`admin-badge ${destBadge.className}`}
														>
															{destBadge.text}
														</span>
														{'failed' === row.destination_status &&
															row.destination_error && (
																<div className="backups-error-message">
																	{row.destination_error}
																</div>
															)}
													</>
												) : (
													<span className="desc">
														{__('Local', 'vulopilot')}
													</span>
												)}
											</td>
											<td>{formatFileSize(row.file_size)}</td>
											<td>
												<div className="backups-row-actions">
													{'completed' === row.status &&
														row.has_file && (
															<>
																<span
																	className="admin-badge purple"
																	role="button"
																	tabIndex={0}
																	onClick={() =>
																		handleDownload(row)
																	}
																>
																	{__(
																		'Download',
																		'vulopilot'
																	)}
																</span>
																<span
																	className="admin-badge blue"
																	role="button"
																	tabIndex={0}
																	onClick={() =>
																		setRestoreTarget(row)
																	}
																>
																	{__(
																		'Restore',
																		'vulopilot'
																	)}
																</span>
															</>
														)}
													<span
														className="admin-badge red"
														role="button"
														tabIndex={0}
														onClick={() =>
															!isBusy && handleDelete(row)
														}
													>
														{isBusy
															? __('…', 'vulopilot')
															: __('Delete', 'vulopilot')}
													</span>
												</div>
											</td>
										</tr>
									);
								})}
							</tbody>
						</table>
					</div>
				)}
			</CardComponent>

			<PopupComponent
				open={null !== restoreTarget}
				onClose={() => {
					setRestoreTarget(null);
					setConfirmText('');
				}}
				width={28}
				height="auto"
				position="lightbox"
			>
				<div className="backups-restore-confirm">
					<h3>{__('Restore this backup?', 'vulopilot')}</h3>
					<p>
						{__(
							'This overwrites your current database and files with the state captured in this backup. A safety snapshot of your current state is taken automatically first, but this action itself cannot be undone once it starts.',
							'vulopilot'
						)}
					</p>
					<p>
						{sprintf(
							/* translators: %s is the literal confirmation phrase the admin must type. */
							__('Type %s to confirm.', 'vulopilot'),
							RESTORE_CONFIRM_PHRASE
						)}
					</p>
					<input
						type="text"
						className="backups-restore-confirm-input"
						value={confirmText}
						onChange={(event) => setConfirmText(event.target.value)}
						placeholder={RESTORE_CONFIRM_PHRASE}
					/>
					<div className="backups-restore-confirm-actions">
						<ButtonInput
							buttons={{
								text: __('Cancel', 'vulopilot'),
								color: 'border-purple',
								onClick: () => {
									setRestoreTarget(null);
									setConfirmText('');
								},
							}}
						/>
						<ButtonInput
							buttons={{
								text: isRestoring
									? __('Restoring…', 'vulopilot')
									: __('Restore', 'vulopilot'),
								onClick: handleRestoreConfirmed,
								disabled:
									isRestoring ||
									confirmText !== RESTORE_CONFIRM_PHRASE,
							}}
						/>
					</div>
				</div>
			</PopupComponent>
		</>
	);
};

export default BackupsTab;
