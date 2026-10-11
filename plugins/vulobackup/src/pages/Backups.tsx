/* global vulobackupAppLocalizer */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { __, sprintf } from '@wordpress/i18n';
import { BadgeComponent, CardComponent, ColumnComponent, ContainerComponent, ModuleGuardComponent, NavigatorHeaderComponent, NoticeComponent, PopupComponent } from '@zyra/components';
import { ButtonInput } from '@zyra/inputs';
import { TableCard } from '@zyra/table';
import { getApiLink } from '@zyra/core';
import CreateBackup from '../components/CreateBackup';
import JobBanner from '../components/JobBanner';
import { apiDelete, apiGet, apiPost } from '../services/api';
import { errorMessage, notify } from '../services/notify';
import { useJob } from '../services/JobContext';
import { AREA_LABELS, STATUS, TRIGGER_LABELS, TYPE_LABELS } from '../services/types';
import type { Job, LogLine } from '../services/types';

interface BackupList {
	data: Job[];
	total: number;
	counts: { all: number; completed: number; failed: number; running: number };
}

interface TableQuery {
	paged?: number | string;
	per_page?: number | string;
	searchValue?: string;
	categoryFilter?: string;
}

interface Detail extends Job {
	log: LogLine[];
	manifest: {
		site: { home: string; wp_version: string; php: string; prefix: string };
		plugin_version: string;
		database: { tables: number; rows: number } | null;
		files: { count: number; bytes_display: string; by_area: Record<string, { files: number; bytes: number }>; skipped: Record<string, number> } | null;
		parts: { name: string; bytes_display: string; sha256: string }[];
	} | null;
}

const statusBadges = (row: Job) => {
	const status = STATUS[row.status] ?? { text: row.status, color: 'blue' };

	return (
		<div className="vulobackup-badges">
			<BadgeComponent color={status.color} text={status.text} />
			{'completed' === row.status &&
				(row.verified ? <BadgeComponent color="green" text={__('Verified', 'vulobackup')} /> : <BadgeComponent color="yellow" text={__('Not verified', 'vulobackup')} />)}
			{'completed' === row.status && row.warnings.length > 0 && <BadgeComponent color="yellow" text={__('Warnings', 'vulobackup')} />}
		</div>
	);
};

const stored = (row: Job) => (
	<div className="vulobackup-badges">
		{row.local && <BadgeComponent color="blue" text={__('This server', 'vulobackup')} />}
		{(row.copies ?? [])
			.filter((copy) => 'deleted' !== copy.status)
			.map((copy) => (
				<BadgeComponent key={copy.id} color={'uploaded' === copy.status ? 'green' : 'failed' === copy.status ? 'red' : 'yellow'} text={copy.name} />
			))}
		{'completed' === row.status && !row.local && 0 === (row.copies ?? []).filter((copy) => 'uploaded' === copy.status).length && '—'}
	</div>
);

/**
 * Backups: every backup with where it is kept and whether it is verified, and the things that can
 * be done with one.
 */
const Backups = () => {
	const { finishedCount, job, kick } = useJob();
	const [query, setQuery] = useState<TableQuery>({ paged: 1, per_page: 10 });
	const [list, setList] = useState<BackupList>({ data: [], total: 0, counts: { all: 0, completed: 0, failed: 0, running: 0 } });
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState('');
	const [reload, setReload] = useState(0);
	const [detail, setDetail] = useState<Detail | null>(null);
	const [isCreating, setIsCreating] = useState(false);
	const [isImporting, setIsImporting] = useState(false);
	const [isBusy, setIsBusy] = useState(false);
	const [confirmDelete, setConfirmDelete] = useState(false);
	const [upload, setUpload] = useState<{ percent: number; name: string } | null>(null);
	const fileInput = useRef<HTMLInputElement | null>(null);

	const onQueryUpdate = useCallback((next: TableQuery) => setQuery(next), []);

	// A link such as `#&tab=backups&backup=…` opens that backup's details directly.
	const linked = new URLSearchParams(useLocation().hash.substring(1)).get('backup');

	const openDetail = useCallback((id: string) => {
		setConfirmDelete(false);

		apiGet<Detail>(`backups/${id}`)
			.then(setDetail)
			.catch((e) => notify('error', errorMessage(e)));
	}, []);

	useEffect(() => {
		if (linked) {
			openDetail(linked);
		}
	}, [linked, openDetail]);

	useEffect(() => {
		let cancelled = false;

		setIsLoading(true);

		apiGet<BackupList>('backups', {
			status: query.categoryFilter && 'all' !== query.categoryFilter ? query.categoryFilter : undefined,
			search: query.searchValue || undefined,
			page: Number(query.paged) || 1,
			per_page: Number(query.per_page) || 10,
		})
			.then((result) => {
				if (!cancelled) {
					setList(result);
					setError('');
				}
			})
			.catch((e) => !cancelled && setError(errorMessage(e)))
			.finally(() => !cancelled && setIsLoading(false));

		return () => {
			cancelled = true;
		};
		// The running job's status is in the list too, so the list follows it.
	}, [query, reload, finishedCount, job?.status]);

	const verify = async () => {
		if (!detail) {
			return;
		}

		setIsBusy(true);

		try {
			let result = await apiPost<{ done: boolean; problems?: string[]; checked?: string[]; job: Job }>(`backups/${detail.id}/verify`, { restart: true });

			// Large archives are hashed a slice at a time.
			while (!result.done) {
				result = await apiPost(`backups/${detail.id}/verify`);
			}

			if ((result.problems ?? []).length > 0) {
				notify('error', __('This backup failed its integrity check. See its details.', 'vulobackup'));
			} else {
				notify(
					'success',
					sprintf(
						/* translators: %s: where the backup was checked, e.g. "This server, My bucket". */
						__('Intact. Checked: %s.', 'vulobackup'),
						(result.checked ?? []).join(', ')
					)
				);
			}

			openDetail(detail.id);
			setReload((n) => n + 1);
		} catch (e) {
			notify('error', errorMessage(e));
		}

		setIsBusy(false);
	};

	const remove = (scope: string) => {
		if (!detail) {
			return;
		}

		setIsBusy(true);

		apiDelete(`backups/${detail.id}`, { scope })
			.then(() => {
				notify('success', __('Backup deleted.', 'vulobackup'));
				setDetail(null);
				setReload((n) => n + 1);
			})
			.catch((e) => notify('error', errorMessage(e)))
			.finally(() => {
				setIsBusy(false);
				setConfirmDelete(false);
			});
	};

	const download = () => {
		if (detail) {
			// A normal browser download: the nonce in the address authenticates it.
			window.location.href = `${getApiLink(vulobackupAppLocalizer, `backups/${detail.id}/download`)}?_wpnonce=${vulobackupAppLocalizer.nonce}`;
		}
	};

	// The file is sent in pieces small enough for the server's upload limit, one after another.
	const importFile = async (file: File) => {
		const size = vulobackupAppLocalizer.chunk_bytes;
		let offset = 0;
		let uploadId = '';

		setUpload({ percent: 0, name: file.name });

		try {
			do {
				const end = Math.min(file.size, offset + size);
				const form = new FormData();

				form.append('chunk', file.slice(offset, end), 'chunk');
				form.append('offset', String(offset));
				form.append('total', String(file.size));
				form.append('upload', uploadId);
				form.append('last', end >= file.size ? '1' : '0');

				const result = await apiPost<{ upload?: string; offset?: number; job?: Job }>('backups/import', form);

				if (result.job) {
					notify('success', __('Backup imported. Verify it before restoring it.', 'vulobackup'));
					setIsImporting(false);
					setReload((n) => n + 1);
					openDetail(result.job.id);
					break;
				}

				uploadId = result.upload ?? '';
				offset = result.offset ?? end;

				setUpload({ percent: Math.round((offset / Math.max(1, file.size)) * 100), name: file.name });
			} while (offset < file.size);
		} catch (e) {
			notify('error', errorMessage(e));
		}

		setUpload(null);

		if (fileInput.current) {
			fileInput.current.value = '';
		}
	};

	const remoteCopies = (detail?.copies ?? []).filter((copy) => 'uploaded' === copy.status);

	return (
		<>
			<NavigatorHeaderComponent
				headerIcon="database"
				headerTitle={__('Backups', 'vulobackup')}
				headerDescription={__('Every backup of this site, where it is kept and whether it has been verified.', 'vulobackup')}
				headerCustomContent={
					<ButtonInput
						buttons={[
							{ text: __('Import a backup', 'vulobackup'), color: 'purple', icon: 'import', onClick: () => setIsImporting(true) },
							{ text: __('Back up now', 'vulobackup'), icon: 'database', disabled: Boolean(job), onClick: () => setIsCreating(true) },
						]}
					/>
				}
			/>
			<ContainerComponent general>
				<ColumnComponent>
					<JobBanner />
					<CardComponent id="backups-list-card" title={__('Backups', 'vulobackup')} titleIcon="database">
						{error ? (
							<ModuleGuardComponent icon="error" title={__('Could not load the backups', 'vulobackup')} desc={error} />
						) : (
							<TableCard
								search={{ placeholder: __('Search by name…', 'vulobackup') }}
								showMenu={false}
								headers={{
									name: {
										label: __('Backup', 'vulobackup'),
										render: (row: Job) => (
											<div className="vulobackup-cell">
												<span className="vulobackup-primary">
													<i className={`adminfont-${row.encrypted ? 'lock' : 'database'}`} aria-hidden="true" />
													{row.name}
												</span>
												<span className="vulobackup-secondary">
													{row.created_at_display} · {TRIGGER_LABELS[row.trigger ?? 'manual']}
												</span>
											</div>
										),
									},
									type: {
										label: __('Contains', 'vulobackup'),
										render: (row: Job) => (
											<div className="vulobackup-cell">
												<span className="vulobackup-primary">{TYPE_LABELS[row.type ?? 'full']}</span>
												<span className="vulobackup-secondary">{row.size_display || '—'}</span>
											</div>
										),
									},
									local: { label: __('Kept at', 'vulobackup'), render: (row: Job) => stored(row) },
									status: { label: __('Status', 'vulobackup'), render: (row: Job) => statusBadges(row) },
									id: {
										label: '',
										render: (row: Job) => (
											<ButtonInput
												buttons={[
													{ text: __('Details', 'vulobackup'), icon: 'eye', color: 'purple', onClick: () => openDetail(row.id) },
													...(row.can_restore
														? [
																{
																	text: __('Restore', 'vulobackup'),
																	icon: 'refresh',
																	disabled: Boolean(job),
																	onClick: () => {
																		window.location.hash = `&tab=restore&backup=${row.id}`;
																	},
																},
														  ]
														: []),
												]}
											/>
										),
									},
								}}
								rows={list.data}
								ids={list.data.map((row) => row.id)}
								totalRows={list.total}
								categoryCounts={[
									{ value: 'all', label: __('All', 'vulobackup'), count: list.counts.all },
									{ value: 'completed', label: __('Completed', 'vulobackup'), count: list.counts.completed },
									{ value: 'failed', label: __('Failed', 'vulobackup'), count: list.counts.failed },
								]}
								isLoading={isLoading}
								onQueryUpdate={onQueryUpdate}
								emptyMessage={__('There are no backups yet. Select "Back up now" to make the first one.', 'vulobackup')}
							/>
						)}
					</CardComponent>
				</ColumnComponent>
			</ContainerComponent>

			<CreateBackup open={isCreating} onClose={() => setIsCreating(false)} />

			<PopupComponent
				open={isImporting}
				onClose={() => !upload && setIsImporting(false)}
				width={36}
				height="auto"
				position="lightbox"
				header={{ icon: 'import', title: __('Import a backup', 'vulobackup') }}
			>
				<div className="vulobackup-popup-body">
					<p className="vulobackup-secondary">
						{__(
							'Upload a backup file downloaded from VuloBackup, on this site or another one. It is added to the list; nothing on the site changes until you choose to restore it.',
							'vulobackup'
						)}
					</p>
					<input
						ref={fileInput}
						type="file"
						accept=".zip,application/zip"
						disabled={Boolean(upload)}
						aria-label={__('Backup file', 'vulobackup')}
						onChange={(event) => {
							const file = event.target.files?.[0];

							if (file) {
								importFile(file);
							}
						}}
					/>
					{upload && (
						<div className="vulobackup-job">
							<div className="vulobackup-job-head">
								<strong>{upload.name}</strong>
								<span>{upload.percent}%</span>
							</div>
							<div className="vulobackup-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={upload.percent}>
								<span style={{ width: `${Math.max(2, upload.percent)}%` }} />
							</div>
						</div>
					)}
				</div>
			</PopupComponent>

			<PopupComponent
				open={Boolean(detail)}
				onClose={() => setDetail(null)}
				width={46}
				height="auto"
				position="lightbox"
				header={{ icon: 'database', title: detail?.name ?? '' }}
			>
				{detail && (
					<div className="vulobackup-popup-body">
						{detail.error && <NoticeComponent displayPosition="inline-notice" type="error" message={detail.error} />}
						{(detail.verify_problems ?? []).map((problem) => (
							<NoticeComponent key={problem} displayPosition="inline-notice" type="error" title={__('Integrity check failed', 'vulobackup')} message={problem} />
						))}
						{detail.warnings.map((warning) => (
							<NoticeComponent key={warning} displayPosition="inline-notice" type="warning" message={warning} />
						))}
						<dl className="vulobackup-detail">
							<dt>{__('Status', 'vulobackup')}</dt>
							<dd>{statusBadges(detail)}</dd>
							<dt>{__('Made', 'vulobackup')}</dt>
							<dd>
								{detail.made_at_display || detail.created_at_display} · {TRIGGER_LABELS[detail.trigger ?? 'manual']}
							</dd>
							{detail.from_site && (
								<>
									<dt>{__('From site', 'vulobackup')}</dt>
									<dd>{detail.from_site}</dd>
								</>
							)}
							<dt>{__('Contains', 'vulobackup')}</dt>
							<dd>
								{TYPE_LABELS[detail.type ?? 'full']}
								{detail.size_display ? ` · ${detail.size_display}` : ''}
								{detail.encrypted ? ` · ${__('Encrypted', 'vulobackup')}` : ''}
							</dd>
							{detail.manifest?.database && (
								<>
									<dt>{__('Database', 'vulobackup')}</dt>
									<dd>
										{sprintf(
											/* translators: 1: number of tables, 2: number of rows. */
											__('%1$d tables, %2$d rows', 'vulobackup'),
											detail.manifest.database.tables,
											detail.manifest.database.rows
										)}
									</dd>
								</>
							)}
							{detail.manifest?.files && (
								<>
									<dt>{__('Files', 'vulobackup')}</dt>
									<dd>
										{sprintf(
											/* translators: 1: number of files, 2: total size. */
											__('%1$d files, %2$s', 'vulobackup'),
											detail.manifest.files.count,
											detail.manifest.files.bytes_display
										)}
										{' · '}
										{Object.keys(detail.manifest.files.by_area)
											.map((area) => `${AREA_LABELS[area]?.name ?? area} (${detail.manifest?.files?.by_area[area].files})`)
											.join(', ')}
									</dd>
								</>
							)}
							{detail.manifest && (
								<>
									<dt>{__('Made on', 'vulobackup')}</dt>
									<dd>
										WordPress {detail.manifest.site.wp_version} · PHP {detail.manifest.site.php} · VuloBackup {detail.manifest.plugin_version}
									</dd>
								</>
							)}
							<dt>{__('Kept at', 'vulobackup')}</dt>
							<dd>{stored(detail)}</dd>
							{detail.verified_at_display && (
								<>
									<dt>{__('Last checked', 'vulobackup')}</dt>
									<dd>{detail.verified_at_display}</dd>
								</>
							)}
							<dt>{__('Identifier', 'vulobackup')}</dt>
							<dd className="vulobackup-hash">{detail.id}</dd>
						</dl>
						{(detail.copies ?? [])
							.filter((copy) => 'failed' === copy.status)
							.map((copy) => (
								<NoticeComponent
									key={copy.id}
									displayPosition="inline-notice"
									type="error"
									title={sprintf(
										/* translators: %s: destination name. */
										__('Not stored at %s', 'vulobackup'),
										copy.name
									)}
									message={copy.error}
								/>
							))}
						{detail.manifest && (
							<details>
								<summary>{__('Archives and checksums (SHA-256)', 'vulobackup')}</summary>
								<ul className="vulobackup-list">
									{detail.manifest.parts.map((part) => (
										<li key={part.name}>
											<div className="vulobackup-cell">
												<span>{part.name}</span>
												<span className="vulobackup-hash">{part.sha256}</span>
											</div>
											<span className="vulobackup-secondary">{part.bytes_display}</span>
										</li>
									))}
								</ul>
							</details>
						)}
						{detail.log.length > 0 && (
							<details>
								<summary>{__('Log of this backup', 'vulobackup')}</summary>
								<ul className="vulobackup-log">
									{[...detail.log].reverse().map((line, index) => (
										<li key={index} className={`is-${line.level}`}>
											<time>{line.time_display}</time>
											{line.message}
										</li>
									))}
								</ul>
							</details>
						)}
						{confirmDelete ? (
							<NoticeComponent
								displayPosition="inline-notice"
								type="warning"
								title={__('Delete this backup?', 'vulobackup')}
								message={__('A deleted backup cannot be brought back. Choose what to delete.', 'vulobackup')}
							/>
						) : null}
						<div className="vulobackup-form-footer">
							{confirmDelete ? (
								<ButtonInput
									buttons={[
										{ text: __('Keep it', 'vulobackup'), color: 'purple', onClick: () => setConfirmDelete(false) },
										...(detail.local && remoteCopies.length > 0
											? [{ text: __('Delete from this server only', 'vulobackup'), color: 'border-red', disabled: isBusy, onClick: () => remove('local') }]
											: []),
										{
											text: remoteCopies.length > 0 ? __('Delete everywhere', 'vulobackup') : __('Delete', 'vulobackup'),
											icon: 'delete',
											color: 'red',
											disabled: isBusy,
											onClick: () => remove('all'),
										},
									]}
								/>
							) : (
								<ButtonInput
									buttons={[
										...(detail.is_final ? [{ text: __('Delete', 'vulobackup'), icon: 'delete', color: 'border-red', disabled: isBusy, onClick: () => setConfirmDelete(true) }] : []),
										...('completed' === detail.status
											? [{ text: isBusy ? __('Checking…', 'vulobackup') : __('Verify integrity', 'vulobackup'), color: 'purple', icon: 'security', disabled: isBusy, onClick: verify }]
											: []),
										...(detail.can_download ? [{ text: __('Download', 'vulobackup'), color: 'purple', icon: 'export', disabled: isBusy, onClick: download }] : []),
										...(detail.can_restore
											? [
													{
														text: __('Restore', 'vulobackup'),
														icon: 'refresh',
														disabled: isBusy || Boolean(job),
														onClick: () => {
															window.location.hash = `&tab=restore&backup=${detail.id}`;
														},
													},
											  ]
											: []),
										...(!detail.is_final
											? [
													{
														text: __('Cancel this backup', 'vulobackup'),
														color: 'border-red',
														onClick: () => {
															apiPost(`backups/${detail.id}/cancel`)
																.then(() => {
																	setDetail(null);
																	kick();
																	setReload((n) => n + 1);
																})
																.catch((e) => notify('error', errorMessage(e)));
														},
													},
											  ]
											: []),
									]}
								/>
							)}
						</div>
					</div>
				)}
			</PopupComponent>
		</>
	);
};

export default Backups;
