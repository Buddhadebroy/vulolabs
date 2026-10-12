/* global vulobackupAppLocalizer */
import { useEffect, useState } from 'react';
import type { ComponentType, Dispatch } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { CardComponent, ModuleGuardComponent, NoticeComponent } from '@zyra/components';
import { ButtonInput, SelectInput, TextAreaInput, TextInput } from '@zyra/inputs';
import { Row, Section, Sections, Segmented, Wide } from '../Section';
import Switch from '../Switch';
import { apiGet, apiPost } from '../../services/api';
import { errorMessage, notify } from '../../services/notify';
import { useSettings } from '../../services/useSettings';
import type { Stored } from '../../services/useSettings';
import { AREA_LABELS } from '../../services/types';

type PanelProps = { values: Stored; set: Dispatch<Partial<Stored>>; replace: Dispatch<Stored> };

/** Loads the settings once for a sub-tab and shows its panel when they are there. */
const withSettings = (title: string, icon: string, Panel: ComponentType<PanelProps>) => {
	const Wrapped = () => {
		const { values, error, set, replace } = useSettings();

		if (error) {
			return (
				<CardComponent title={title} titleIcon="error">
					<ModuleGuardComponent icon="error" title={__('Could not load settings', 'vulobackup')} desc={error} />
				</CardComponent>
			);
		}

		if (!values) {
			return <CardComponent title={title} titleIcon={icon} isLoading />;
		}

		return <Panel values={values} set={set} replace={replace} />;
	};

	return Wrapped;
};

const number = (name: string, value: number, onChange: Dispatch<number>, min: number, max: number, postText?: string) => (
	<TextInput name={name} type="number" size={10} minNumber={min} maxNumber={max} postText={postText} value={value} onChange={(next) => onChange(Number(next))} />
);

const FREQUENCIES = [
	{ value: 'manual', label: __('Manual only', 'vulobackup') },
	{ value: 'daily', label: __('Daily', 'vulobackup') },
	{ value: 'weekly', label: __('Weekly', 'vulobackup') },
	{ value: 'monthly', label: __('Monthly', 'vulobackup') },
];

const WEEKDAYS = [__('Sunday', 'vulobackup'), __('Monday', 'vulobackup'), __('Tuesday', 'vulobackup'), __('Wednesday', 'vulobackup'), __('Thursday', 'vulobackup'), __('Friday', 'vulobackup'), __('Saturday', 'vulobackup')];

const HOURS = Array.from({ length: 24 }, (_, hour) => ({ value: String(hour), label: `${String(hour).padStart(2, '0')}:00` }));

const SchedulePanel = ({ values, set }: PanelProps) => {
	const [preview, setPreview] = useState<{ name: string; date: string; where: string }[] | null>(null);
	const scheduled = [values.schedule_files, values.schedule_database].filter((frequency) => 'manual' !== frequency);

	// What the "keep" numbers would remove today, so they are never a surprise.
	useEffect(() => {
		const timer = setTimeout(() => {
			apiGet<{ name: string; date: string; where: string }[]>('settings/retention')
				.then(setPreview)
				.catch(() => setPreview(null));
		}, 1200);

		return () => clearTimeout(timer);
	}, [values.retention_count, values.retention_remote_count]);

	return (
		<Sections>
			<Section
				icon="clock"
				title={__('Schedule', 'vulobackup')}
				desc={__('How often backups are made by themselves. When files and the database are due together they are made as one backup.', 'vulobackup')}
			>
				<Row label={__('Database', 'vulobackup')} desc={__('Posts, pages, users, orders and settings. It changes most often and is small, so back it up most often.', 'vulobackup')}>
					<Segmented label={__('Database schedule', 'vulobackup')} value={values.schedule_database} options={FREQUENCIES} onChange={(schedule_database) => set({ schedule_database })} />
				</Row>
				<Row label={__('Files', 'vulobackup')} desc={__('Plugins, themes, uploads and the other folders chosen under "What to back up".', 'vulobackup')}>
					<Segmented label={__('Files schedule', 'vulobackup')} value={values.schedule_files} options={FREQUENCIES} onChange={(schedule_files) => set({ schedule_files })} />
				</Row>
				{scheduled.length > 0 && (
					<Row label={__('Time of day', 'vulobackup')} desc={__('In the site\'s timezone. Choose an hour when the site is quiet.', 'vulobackup')}>
						<SelectInput
							type="single-select"
							name="schedule_hour"
							isClearable={false}
							options={HOURS}
							value={String(values.schedule_hour)}
							onChange={(hour) => set({ schedule_hour: Number(hour) })}
						/>
					</Row>
				)}
				{scheduled.includes('weekly') && (
					<Row label={__('Day of the week', 'vulobackup')} desc={__('For weekly backups.', 'vulobackup')}>
						<SelectInput
							type="single-select"
							name="schedule_weekday"
							isClearable={false}
							options={WEEKDAYS.map((label, index) => ({ value: String(index), label }))}
							value={String(values.schedule_weekday)}
							onChange={(day) => set({ schedule_weekday: Number(day) })}
						/>
					</Row>
				)}
				{scheduled.includes('monthly') && (
					<Row label={__('Day of the month', 'vulobackup')} desc={__('For monthly backups. 1 to 28, so that every month has it.', 'vulobackup')}>
						{number('schedule_monthday', values.schedule_monthday, (schedule_monthday) => set({ schedule_monthday }), 1, 28)}
					</Row>
				)}
				{scheduled.length > 0 && (
					<Wide>
						<NoticeComponent
							displayPosition="inline-notice"
							type="info"
							message={__(
								'WordPress runs scheduled tasks when someone visits the site, so a backup starts at the first visit after the time above, not at the exact minute, and on a quiet site it also continues at each visit. For exact times, have your host call wp-cron.php on a timer.',
								'vulobackup'
							)}
						/>
					</Wide>
				)}
			</Section>
			<Section
				icon="database"
				title={__('How many to keep', 'vulobackup')}
				desc={__('Older backups are removed only after a new one has completed and been verified, never because one failed.', 'vulobackup')}
			>
				<Row label={__('On this server', 'vulobackup')} desc={__('The newest backups kept here. 0 keeps every backup.', 'vulobackup')}>
					{number('retention_count', values.retention_count, (retention_count) => set({ retention_count }), 0, 365, __('backups', 'vulobackup'))}
				</Row>
				<Row label={__('At each remote destination', 'vulobackup')} desc={__('Counted separately for each destination. 0 keeps every backup.', 'vulobackup')}>
					{number('retention_remote_count', values.retention_remote_count, (retention_remote_count) => set({ retention_remote_count }), 0, 365, __('backups', 'vulobackup'))}
				</Row>
				<Wide>
					<Switch
						name="keep_local_copy"
						label={__('Keep a copy on this server after uploading', 'vulobackup')}
						desc={__('Off: once a backup has been uploaded to every destination and confirmed, its archives are removed from this server to save space. A restore downloads them again.', 'vulobackup')}
						checked={values.keep_local_copy}
						onChange={(keep_local_copy) => set({ keep_local_copy })}
					/>
				</Wide>
				{preview && preview.length > 0 && (
					<Wide>
						<NoticeComponent
							displayPosition="inline-notice"
							type="warning"
							title={__('The next successful backup will remove', 'vulobackup')}
							message={preview.map((line) => `${line.name} (${line.date}, ${line.where})`).join('; ')}
						/>
					</Wide>
				)}
			</Section>
		</Sections>
	);
};

const ContentsPanel = ({ values, set }: PanelProps) => (
	<Sections>
		<Section icon="database" title={__('Files', 'vulobackup')} desc={__('The folders a full or files backup includes. You can change the choice for a single backup when you start it.', 'vulobackup')}>
			<Wide>
				<div className="vulobackup-checks">
					{vulobackupAppLocalizer.areas.map((area) => (
						<label key={area} htmlFor={`vulobackup-setting-area-${area}`}>
							<input
								type="checkbox"
								id={`vulobackup-setting-area-${area}`}
								checked={values.areas.includes(area)}
								onChange={(event) => set({ areas: event.target.checked ? [...values.areas, area] : values.areas.filter((item) => item !== area) })}
							/>
							<div>
								<strong>{AREA_LABELS[area]?.name ?? area}</strong>
								<span>{AREA_LABELS[area]?.desc}</span>
							</div>
						</label>
					))}
				</div>
			</Wide>
			<Wide>
				<Switch
					name="include_wp_config"
					label={__('Include wp-config.php', 'vulobackup')}
					desc={__('Only with "WordPress itself". The file holds your database password and secret keys, so anyone who gets the backup gets them. It is never put back by a restore, on any site.', 'vulobackup')}
					checked={values.include_wp_config}
					onChange={(include_wp_config) => set({ include_wp_config })}
				/>
			</Wide>
		</Section>
		<Section icon="filter" title={__('Left out', 'vulobackup')} desc={__('Caches, temporary files and other plugins\' backups are always left out. Add your own here.', 'vulobackup')}>
			<Row
				label={__('Also leave out', 'vulobackup')}
				desc={__('One per line, as folder/path. * matches within a name and ** across folders. Examples: uploads/videos/**   *.zip   plugins/my-plugin/cache/**', 'vulobackup')}
			>
				<TextAreaInput name="exclude_patterns" rowNumber={5} usePlainText value={values.exclude_patterns} onChange={(value) => set({ exclude_patterns: String(value) })} />
			</Row>
			<Row label={__('Skip files larger than', 'vulobackup')} desc={__('0 for no limit. Skipped files are listed in the backup\'s warnings.', 'vulobackup')}>
				{number('max_file_size_mb', values.max_file_size_mb, (max_file_size_mb) => set({ max_file_size_mb }), 0, 102400, 'MB')}
			</Row>
			<Wide>
				<details>
					<summary>{__('Always left out', 'vulobackup')}</summary>
					<span className="vulobackup-hash">{values.default_exclusions.join('   ')}</span>
				</details>
			</Wide>
		</Section>
		<Section icon="database" title={__('Database', 'vulobackup')} desc={__('Which tables a database backup includes.', 'vulobackup')}>
			<Row label={__('Tables', 'vulobackup')} desc={__('"Every table" also backs up tables of other software sharing this database. A restore only ever replaces the tables that are in the backup.', 'vulobackup')}>
				<Segmented
					label={__('Tables', 'vulobackup')}
					value={values.db_scope}
					options={[
						{ value: 'prefix', label: __('This WordPress site\'s tables', 'vulobackup') },
						{ value: 'all', label: __('Every table in the database', 'vulobackup') },
					]}
					onChange={(db_scope) => set({ db_scope })}
				/>
			</Row>
		</Section>
	</Sections>
);

const SecurityPanel = ({ values, replace }: PanelProps) => {
	const [password, setPassword] = useState('');
	const [isBusy, setIsBusy] = useState(false);

	const save = (enabled: boolean) => {
		setIsBusy(true);

		apiPost<Stored>('settings/encryption', { enabled, password })
			.then((saved) => {
				replace(saved);
				setPassword('');
				notify('success', enabled ? __('New backups will be encrypted.', 'vulobackup') : __('New backups will not be encrypted.', 'vulobackup'));
			})
			.catch((e) => notify('error', errorMessage(e)))
			.finally(() => setIsBusy(false));
	};

	return (
		<Sections>
			<Section
				icon="lock"
				title={__('Encrypt backups', 'vulobackup')}
				desc={__('Protects backups wherever they are copied: a download, a storage bucket, an SFTP server. Archives are encrypted with a key made from your password.', 'vulobackup')}
			>
				{!values.encryption_available && (
					<Wide>
						<NoticeComponent
							displayPosition="inline-notice"
							type="warning"
							title={__('Not available on this server', 'vulobackup')}
							message={__('Encryption needs PHP\'s sodium extension, which this server does not have. Ask your host to enable it.', 'vulobackup')}
						/>
					</Wide>
				)}
				{values.encryption_available && (
					<>
						<Wide>
							<NoticeComponent
								displayPosition="inline-notice"
								type="warning"
								title={__('Keep the password somewhere safe', 'vulobackup')}
								message={__(
									'Without it an encrypted backup cannot be restored by anyone, including us: VuloLabs never receives it. It is stored on this site so scheduled backups can run, which means the backups are protected in the places they are copied to, not from someone who already controls this site.',
									'vulobackup'
								)}
							/>
						</Wide>
						<Row
							label={values.encryption_has_password ? __('New password', 'vulobackup') : __('Password', 'vulobackup')}
							desc={
								values.encryption_has_password
									? __('Leave empty to keep the current password. Backups made earlier still need the password they were made with.', 'vulobackup')
									: __('At least 12 characters. A long phrase is best.', 'vulobackup')
							}
						>
							<TextInput name="encryption-password" type="password" value={password} onChange={(value) => setPassword(String(value))} />
						</Row>
						<Wide>
							<div className="vulobackup-inline">
								<ButtonInput
									buttons={[
										...(values.encrypt
											? [{ text: __('Stop encrypting new backups', 'vulobackup'), color: 'border-red', disabled: isBusy, onClick: () => save(false) }]
											: []),
										{
											text: values.encrypt ? __('Change password', 'vulobackup') : __('Encrypt new backups', 'vulobackup'),
											icon: 'lock',
											disabled: isBusy || (values.encrypt ? '' === password : '' === password && !values.encryption_has_password),
											onClick: () => save(true),
										},
									]}
								/>
								<span className="vulobackup-secondary">{values.encrypt ? __('Encryption is on.', 'vulobackup') : __('Encryption is off.', 'vulobackup')}</span>
							</div>
						</Wide>
					</>
				)}
			</Section>
		</Sections>
	);
};

const NotificationsPanel = ({ values, set }: PanelProps) => (
	<Sections>
		<Section icon="notification" title={__('Email', 'vulobackup')} desc={__('Be told when a backup fails or cannot be copied to remote storage. One email per failed backup.', 'vulobackup')}>
			<Wide>
				<Switch
					name="notify_failure"
					label={__('Email me when a backup fails', 'vulobackup')}
					desc={__('Sent with your site\'s own email. Whether it arrives depends on how the site sends email.', 'vulobackup')}
					checked={values.notify_failure}
					onChange={(notify_failure) => set({ notify_failure })}
				/>
			</Wide>
			{values.notify_failure && (
				<Row
					label={__('Send to', 'vulobackup')}
					desc={sprintf(
						/* translators: %s: email address. */
						__('Leave empty to use the site administrator\'s address, %s.', 'vulobackup'),
						values.admin_email
					)}
				>
					<TextInput name="notify_email" type="email" value={values.notify_email} placeholder={values.admin_email} onChange={(value) => set({ notify_email: String(value) })} />
				</Row>
			)}
		</Section>
		<Section icon="clock" title={__('Activity log', 'vulobackup')} desc={__('What VuloBackup did and when, shown under Diagnostics. It never holds passwords, keys or the contents of your database.', 'vulobackup')}>
			<Row label={__('Keep activity for', 'vulobackup')}>{number('log_retention_days', values.log_retention_days, (log_retention_days) => set({ log_retention_days }), 1, 365, __('days', 'vulobackup'))}</Row>
		</Section>
	</Sections>
);

const AdvancedPanel = ({ values, set }: PanelProps) => (
	<Sections>
		<Section icon="refresh" title={__('Restore', 'vulobackup')} desc={__('What a restore does before it replaces anything.', 'vulobackup')}>
			<Wide>
				<Switch
					name="safety_backup"
					label={__('Suggest a safety backup before every restore', 'vulobackup')}
					desc={__('The restore screen starts with "Back up the current site first" switched on. The newest two safety backups are kept.', 'vulobackup')}
					checked={values.safety_backup}
					onChange={(safety_backup) => set({ safety_backup })}
				/>
			</Wide>
		</Section>
		<Section icon="tools" title={__('Server limits', 'vulobackup')} desc={__('Change these only if backups stop part-way. Diagnostics shows this server\'s limits.', 'vulobackup')}>
			<Row label={__('Seconds per step', 'vulobackup')} desc={__('A backup is made in short steps so it fits within PHP\'s time limit. Lower this if backups keep stopping at the same point.', 'vulobackup')}>
				{number('step_seconds', values.step_seconds, (step_seconds) => set({ step_seconds }), 5, 120, __('seconds', 'vulobackup'))}
			</Row>
			<Row label={__('Archive size', 'vulobackup')} desc={__('Files are packed into archives of about this size. Smaller archives need less memory and resume faster after an interrupted upload.', 'vulobackup')}>
				{number('part_size_mb', values.part_size_mb, (part_size_mb) => set({ part_size_mb }), 10, 2000, 'MB')}
			</Row>
		</Section>
		<Section icon="delete" title={__('When VuloBackup is deleted', 'vulobackup')} desc={__('Your backups are never deleted with the plugin. This is about its settings only.', 'vulobackup')}>
			<Row label={__('Settings', 'vulobackup')} desc={__('The backup folder and everything in it always stays on the server; delete it yourself if you no longer want it.', 'vulobackup')}>
				<Segmented
					label={__('Settings on uninstall', 'vulobackup')}
					value={values.keep_data_uninstall}
					options={[
						{ value: 'keep_data', label: __('Keep settings', 'vulobackup') },
						{ value: 'delete_everything', label: __('Delete settings and stored credentials', 'vulobackup') },
					]}
					onChange={(keep_data_uninstall) => set({ keep_data_uninstall })}
				/>
			</Row>
		</Section>
	</Sections>
);

export const Schedule = withSettings(__('Schedule', 'vulobackup'), 'clock', SchedulePanel);
export const Contents = withSettings(__('What to back up', 'vulobackup'), 'database', ContentsPanel);
export const Security = withSettings(__('Security', 'vulobackup'), 'lock', SecurityPanel);
export const Notifications = withSettings(__('Notifications', 'vulobackup'), 'notification', NotificationsPanel);
export const Advanced = withSettings(__('Advanced', 'vulobackup'), 'tools', AdvancedPanel);
