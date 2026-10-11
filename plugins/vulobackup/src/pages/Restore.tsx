import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { __, sprintf } from '@wordpress/i18n';
import { BadgeComponent, CardComponent, ColumnComponent, ContainerComponent, ModuleGuardComponent, NavigatorHeaderComponent, NoticeComponent } from '@zyra/components';
import { ButtonInput, TextInput } from '@zyra/inputs';
import JobBanner from '../components/JobBanner';
import { Row, Section, Sections, Wide } from '../components/Section';
import Switch from '../components/Switch';
import { apiGet, apiPost } from '../services/api';
import { errorMessage, notify } from '../services/notify';
import { useJob } from '../services/JobContext';
import { AREA_LABELS, STATUS, TYPE_LABELS } from '../services/types';
import type { Job } from '../services/types';

interface Preview {
	backup: Job;
	site: { home: string; wp_version: string; php: string; prefix: string };
	this_site: { home: string; wp_version: string; php: string; prefix: string };
	made_display: string;
	moved: boolean;
	database: { tables: number; rows: number } | null;
	areas: { id: string; files: number; bytes_display: string; available: boolean; swapped: boolean }[];
	encrypted: boolean;
	needs_password: boolean;
	blockers: string[];
	notes: string[];
	safety: boolean;
	confirmation: string;
	busy: Job | null;
}

const go = (hash: string) => {
	window.location.hash = hash;
};

/**
 * The restore wizard for one backup: what it is, what will be replaced, and a deliberate
 * confirmation before anything starts.
 */
const Wizard = ({ backupId }: { backupId: string }) => {
	const { job, kick } = useJob();
	const [preview, setPreview] = useState<Preview | null>(null);
	const [error, setError] = useState('');
	const [database, setDatabase] = useState(true);
	const [areas, setAreas] = useState<string[]>([]);
	const [safety, setSafety] = useState(true);
	const [password, setPassword] = useState('');
	const [confirm, setConfirm] = useState('');
	const [isBusy, setIsBusy] = useState(false);

	useEffect(() => {
		setPreview(null);
		setError('');

		apiGet<Preview>('restores/preview', { backup: backupId })
			.then((result) => {
				setPreview(result);
				setDatabase(Boolean(result.database));
				// The folders that can be put back if something goes wrong are ticked; the rest are opt-in.
				setAreas(result.areas.filter((area) => area.available && area.swapped).map((area) => area.id));
				setSafety(result.safety);
			})
			.catch((e) => setError(errorMessage(e)));
	}, [backupId]);

	if (error) {
		return (
			<CardComponent title={__('Restore', 'vulobackup')} titleIcon="error">
				<ModuleGuardComponent icon="error" title={__('This backup cannot be restored', 'vulobackup')} desc={error} />
			</CardComponent>
		);
	}

	if (!preview) {
		return <CardComponent title={__('Restore', 'vulobackup')} titleIcon="refresh" isLoading />;
	}

	const start = () => {
		setIsBusy(true);

		apiPost('restores', { backup: backupId, database, areas, safety, password, confirm })
			.then(() => {
				setConfirm('');
				setPassword('');
				go('&tab=restore');
				kick();
			})
			.catch((e) => notify('error', errorMessage(e)))
			.finally(() => setIsBusy(false));
	};

	const blocked = preview.blockers.length > 0;
	const nothing = !database && 0 === areas.length;
	const overlay = preview.areas.filter((area) => areas.includes(area.id) && !area.swapped);
	const replaced: string[] = [];

	if (database) {
		replaced.push(__('The whole database: posts, pages, users, orders, settings. Everything added since the backup was made is lost.', 'vulobackup'));
	}

	areas.forEach((area) => {
		replaced.push(
			sprintf(
				/* translators: %s: folder name, e.g. Plugins. */
				__('%s: the folder is replaced by the one in the backup. Files added since are removed.', 'vulobackup'),
				AREA_LABELS[area]?.name ?? area
			)
		);
	});

	return (
		<>
			{preview.blockers.map((blocker) => (
				<NoticeComponent key={blocker} displayPosition="inline-notice" type="error" title={__('This backup cannot be restored here', 'vulobackup')} message={blocker} />
			))}
			{preview.notes.map((note) => (
				<NoticeComponent key={note} displayPosition="inline-notice" type="info" message={note} />
			))}
			{!preview.backup.verified && (
				<NoticeComponent
					displayPosition="inline-notice"
					type="warning"
					message={__('This backup has not been verified on this server yet. Its checksums are checked as the first step of the restore, and nothing is changed if they do not match.', 'vulobackup')}
				/>
			)}
			<Sections>
				<Section icon="database" title={__('The backup', 'vulobackup')} desc={__('What you are about to restore.', 'vulobackup')}>
					<Wide>
						<dl className="vulobackup-detail">
							<dt>{__('Name', 'vulobackup')}</dt>
							<dd>{preview.backup.name}</dd>
							<dt>{__('Made', 'vulobackup')}</dt>
							<dd>{preview.made_display}</dd>
							<dt>{__('Site', 'vulobackup')}</dt>
							<dd>
								{preview.site.home}
								{preview.moved && <> {<BadgeComponent color="yellow" text={__('Another address', 'vulobackup')} />}</>}
							</dd>
							<dt>{__('Contains', 'vulobackup')}</dt>
							<dd>
								{TYPE_LABELS[preview.backup.type ?? 'full']} · {preview.backup.size_display}
								{preview.encrypted ? ` · ${__('Encrypted', 'vulobackup')}` : ''}
							</dd>
							<dt>{__('Made on', 'vulobackup')}</dt>
							<dd>
								WordPress {preview.site.wp_version} · PHP {preview.site.php}
							</dd>
						</dl>
					</Wide>
				</Section>
				<Section icon="check" title={__('What to restore', 'vulobackup')} desc={__('Only what you tick is replaced. Everything else on the site is left as it is.', 'vulobackup')}>
					<Wide>
						<div className="vulobackup-checks">
							{preview.database && (
								<label htmlFor="vulobackup-restore-database">
									<input type="checkbox" id="vulobackup-restore-database" checked={database} disabled={blocked} onChange={(event) => setDatabase(event.target.checked)} />
									<div>
										<strong>{__('Database', 'vulobackup')}</strong>
										<span>
											{sprintf(
												/* translators: 1: number of tables, 2: number of rows. */
												__('%1$d tables, %2$d rows. Switched in one step at the very end.', 'vulobackup'),
												preview.database.tables,
												preview.database.rows
											)}
										</span>
									</div>
								</label>
							)}
							{preview.areas.map((area) => (
								<label key={area.id} htmlFor={`vulobackup-restore-${area.id}`}>
									<input
										type="checkbox"
										id={`vulobackup-restore-${area.id}`}
										checked={areas.includes(area.id)}
										disabled={blocked || !area.available}
										onChange={(event) => setAreas(event.target.checked ? [...areas, area.id] : areas.filter((item) => item !== area.id))}
									/>
									<div>
										<strong>{AREA_LABELS[area.id]?.name ?? area.id}</strong>
										<span>
											{sprintf(
												/* translators: 1: number of files, 2: size. */
												__('%1$d files, %2$s.', 'vulobackup'),
												area.files,
												area.bytes_display
											)}{' '}
											{area.swapped
												? __('The folder is switched in one step, and switched back if the restore fails.', 'vulobackup')
												: __('Copied over the existing files one by one. This cannot be undone if the restore is interrupted, and files that are not in the backup stay.', 'vulobackup')}
										</span>
									</div>
								</label>
							))}
						</div>
					</Wide>
				</Section>
				{preview.needs_password && (
					<Section icon="lock" title={__('Password', 'vulobackup')} desc={__('This backup is encrypted. It can only be opened with the password it was made with.', 'vulobackup')}>
						<Row label={__('Backup password', 'vulobackup')} desc={__('Used for this restore only and not kept afterwards.', 'vulobackup')}>
							<TextInput name="restore-password" type="password" value={password} onChange={(value) => setPassword(String(value))} />
						</Row>
					</Section>
				)}
				<Section
					icon="security"
					title={__('Safety backup', 'vulobackup')}
					desc={__('A backup of the site as it is now, made before anything is replaced, so the restore itself can be undone.', 'vulobackup')}
				>
					<Wide>
						<Switch
							name="restore-safety"
							label={__('Back up the current site first', 'vulobackup')}
							desc={
								safety
									? __('Kept on this server under Backups. The restore does not start if this backup fails.', 'vulobackup')
									: __('Off: there will be no way back to how the site is now.', 'vulobackup')
							}
							checked={safety}
							onChange={setSafety}
						/>
					</Wide>
				</Section>
				<Section icon="error" title={__('Confirm', 'vulobackup')} desc={__('A restore replaces live data. Read what will happen before you start.', 'vulobackup')}>
					<Wide>
						<NoticeComponent
							displayPosition="inline-notice"
							type="warning"
							title={__('This will replace', 'vulobackup')}
							message={nothing ? __('Nothing is ticked above.', 'vulobackup') : replaced.join(' ')}
						/>
					</Wide>
					{overlay.length > 0 && (
						<Wide>
							<NoticeComponent
								displayPosition="inline-notice"
								type="error"
								message={sprintf(
									/* translators: %s: folder names. */
									__('%s cannot be switched back automatically. If the restore is interrupted while those files are being copied, some will be from the backup and some not.', 'vulobackup'),
									overlay.map((area) => AREA_LABELS[area.id]?.name ?? area.id).join(', ')
								)}
							/>
						</Wide>
					)}
					<Wide>
						<span className="vulobackup-control-desc">
							{__('The site may be unavailable for a moment while it is switched, and you may be signed out: the restored database has the users and passwords of the backup. Keep this page open until the restore has finished.', 'vulobackup')}
						</span>
					</Wide>
					<Row
						label={sprintf(
							/* translators: %s: the word to type. */
							__('Type %s to confirm', 'vulobackup'),
							preview.confirmation
						)}
					>
						<div className="vulobackup-confirm">
							<TextInput name="restore-confirm" value={confirm} placeholder={preview.confirmation} onChange={(value) => setConfirm(String(value))} />
						</div>
					</Row>
					<Wide>
						<ButtonInput
							buttons={[
								{ text: __('Back to backups', 'vulobackup'), color: 'purple', onClick: () => go('&tab=backups') },
								{
									text: isBusy ? __('Starting…', 'vulobackup') : __('Restore this backup', 'vulobackup'),
									icon: 'refresh',
									color: 'red',
									disabled: isBusy || blocked || nothing || Boolean(job) || confirm.trim() !== preview.confirmation || (preview.needs_password && '' === password),
									onClick: start,
								},
							]}
						/>
					</Wide>
				</Section>
			</Sections>
		</>
	);
};

/**
 * Restore: the wizard when a backup is chosen (`#&tab=restore&backup=…`), otherwise the backups
 * that can be restored and the record of past restores.
 */
const Restore = () => {
	const { job, finishedCount } = useJob();
	const backupId = new URLSearchParams(useLocation().hash.substring(1)).get('backup');
	const [backups, setBackups] = useState<Job[] | null>(null);
	const [restores, setRestores] = useState<Job[]>([]);
	const [error, setError] = useState('');

	useEffect(() => {
		if (backupId) {
			return;
		}

		Promise.all([apiGet<{ data: Job[] }>('backups', { status: 'completed', per_page: 100 }), apiGet<Job[]>('restores')])
			.then(([list, past]) => {
				setBackups(list.data.filter((backup) => backup.can_restore));
				setRestores(past);
			})
			.catch((e) => setError(errorMessage(e)));
	}, [backupId, finishedCount]);

	const restoring = job && 'restore' === job.kind;

	return (
		<>
			<NavigatorHeaderComponent
				headerIcon="refresh"
				headerTitle={__('Restore', 'vulobackup')}
				headerDescription={__('Put a backup back, in whole or in part. Nothing on the site is replaced until the backup has been verified and everything is ready.', 'vulobackup')}
			/>
			<ContainerComponent general>
				<ColumnComponent>
					<JobBanner />
					{backupId && !restoring && <Wizard backupId={backupId} />}
					{!backupId && error && (
						<CardComponent title={__('Restore', 'vulobackup')} titleIcon="error">
							<ModuleGuardComponent icon="error" title={__('Could not load the backups', 'vulobackup')} desc={error} />
						</CardComponent>
					)}
					{!backupId && !error && (
						<CardComponent id="restore-choose" title={__('Choose a backup to restore', 'vulobackup')} titleIcon="database" isLoading={null === backups}>
							{backups && 0 === backups.length && (
								<ModuleGuardComponent
									icon="database"
									title={__('There is no backup to restore', 'vulobackup')}
									desc={__('Make a backup first, or import one from another site under Backups.', 'vulobackup')}
								/>
							)}
							{backups && backups.length > 0 && (
								<ul className="vulobackup-list">
									{backups.map((backup) => (
										<li key={backup.id}>
											<div className="vulobackup-cell">
												<span className="vulobackup-primary">{backup.name}</span>
												<span className="vulobackup-secondary">
													{backup.made_at_display || backup.created_at_display} · {TYPE_LABELS[backup.type ?? 'full']} · {backup.size_display}
													{backup.from_site ? ` · ${backup.from_site}` : ''}
												</span>
											</div>
											<div className="vulobackup-inline">
												{backup.verified ? <BadgeComponent color="green" text={__('Verified', 'vulobackup')} /> : <BadgeComponent color="yellow" text={__('Not verified', 'vulobackup')} />}
												<ButtonInput
													buttons={{
														text: __('Restore', 'vulobackup'),
														icon: 'refresh',
														color: 'purple',
														disabled: Boolean(job),
														onClick: () => go(`&tab=restore&backup=${backup.id}`),
													}}
												/>
											</div>
										</li>
									))}
								</ul>
							)}
						</CardComponent>
					)}
					{!backupId && restores.length > 0 && (
						<CardComponent id="restore-history" title={__('Past restores', 'vulobackup')} titleIcon="clock">
							<ul className="vulobackup-list">
								{restores.map((restore) => (
									<li key={restore.id}>
										<div className="vulobackup-cell">
											<span className="vulobackup-primary">{restore.name}</span>
											<span className="vulobackup-secondary">
												{restore.created_at_display}
												{'completed' === restore.status && restore.result
													? ` · ${sprintf(
															/* translators: 1: number of tables, 2: number of files. */
															__('%1$d tables and %2$d files restored', 'vulobackup'),
															restore.result.tables ?? 0,
															restore.result.files ?? 0
													  )}`
													: ''}
												{restore.migrated?.from
													? ` · ${sprintf(
															/* translators: 1: old address, 2: number of rows. */
															__('address %1$s replaced in %2$d rows', 'vulobackup'),
															restore.migrated.from,
															restore.migrated.changed ?? 0
													  )}`
													: ''}
											</span>
											{restore.error && <span className="vulobackup-secondary">{restore.error}</span>}
											{(restore.result?.notes ?? []).map((note) => (
												<span key={note} className="vulobackup-secondary">
													{note}
												</span>
											))}
										</div>
										<BadgeComponent color={STATUS[restore.status]?.color ?? 'blue'} text={STATUS[restore.status]?.text ?? restore.status} />
									</li>
								))}
							</ul>
						</CardComponent>
					)}
				</ColumnComponent>
			</ContainerComponent>
		</>
	);
};

export default Restore;
