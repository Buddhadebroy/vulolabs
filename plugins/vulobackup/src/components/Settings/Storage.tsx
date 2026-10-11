import { useEffect, useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { BadgeComponent, CardComponent, ModuleGuardComponent, NoticeComponent } from '@zyra/components';
import { ButtonInput, TextAreaInput, TextInput } from '@zyra/inputs';
import { Row, Section, Sections, Wide } from '../Section';
import Switch from '../Switch';
import { apiDelete, apiGet, apiPost } from '../../services/api';
import { errorMessage, notify } from '../../services/notify';
import { useSettings } from '../../services/useSettings';
import type { Destination, ProviderDefinition } from '../../services/types';

interface Listing {
	destinations: Destination[];
	providers: ProviderDefinition[];
	max: number;
}

type Draft = { id: string; provider: string; name: string; config: Record<string, string | number | boolean> };

/**
 * Settings → Storage: the folder on this server, and the remote places copies are sent to.
 *
 * A destination is added first and then appears in the list, where it can be switched off, tested
 * or changed. It is only saved once a real write, read and delete at the far end has worked.
 */
const Storage = () => {
	const { values, error: settingsError, set } = useSettings();
	const [listing, setListing] = useState<Listing | null>(null);
	const [error, setError] = useState('');
	const [draft, setDraft] = useState<Draft | null>(null);
	const [choosing, setChoosing] = useState(false);
	const [isBusy, setIsBusy] = useState('');
	const [folder, setFolder] = useState<string | null>(null);

	const load = () => {
		apiGet<Listing>('destinations')
			.then(setListing)
			.catch((e) => setError(errorMessage(e)));
	};

	useEffect(load, []);

	if (error || settingsError) {
		return (
			<CardComponent title={__('Storage', 'vulobackup')} titleIcon="error">
				<ModuleGuardComponent icon="error" title={__('Could not load the storage settings', 'vulobackup')} desc={error || settingsError} />
			</CardComponent>
		);
	}

	if (!listing || !values) {
		return <CardComponent title={__('Storage', 'vulobackup')} titleIcon="link" isLoading />;
	}

	const provider = draft ? listing.providers.find((item) => item.id === draft.provider) : undefined;
	const editing = draft ? listing.destinations.find((item) => item.id === draft.id) : undefined;

	const begin = (definition: ProviderDefinition) => {
		const config: Draft['config'] = {};

		definition.fields.forEach((field) => {
			config[field.key] = field.default ?? ('toggle' === field.type ? false : '');
		});

		setDraft({ id: '', provider: definition.id, name: '', config });
		setChoosing(false);
	};

	const edit = (destination: Destination) => {
		const definition = listing.providers.find((item) => item.id === destination.provider);
		const config: Draft['config'] = { ...destination.config };

		// Secrets are never sent to the browser; an empty field keeps the stored one.
		definition?.fields.filter((field) => field.secret).forEach((field) => {
			config[field.key] = '';
		});

		setDraft({ id: destination.id, provider: destination.provider, name: destination.name, config });
	};

	const save = () => {
		if (!draft) {
			return;
		}

		setIsBusy('save');

		apiPost<Destination>('destinations', draft)
			.then(() => {
				notify('success', __('Connection tested and saved.', 'vulobackup'));
				setDraft(null);
				load();
			})
			.catch((e) => notify('error', errorMessage(e)))
			.finally(() => setIsBusy(''));
	};

	const act = (id: string, action: () => Promise<unknown>, done?: string) => {
		setIsBusy(id);

		action()
			.then(() => {
				if (done) {
					notify('success', done);
				}

				load();
			})
			.catch((e) => notify('error', errorMessage(e)))
			.finally(() => setIsBusy(''));
	};

	const folderValue = null === folder ? values.backup_dir : folder;

	return (
		<Sections>
			<Section
				icon="database"
				title={__('This server', 'vulobackup')}
				desc={__('Every backup is made here first. The folder has a name that cannot be guessed and refuses web requests; backups are only ever downloaded through WordPress, by an administrator.', 'vulobackup')}
			>
				<Row label={__('Backup folder', 'vulobackup')} desc={__('Leave empty for the default. To move it, enter the full path of a folder the web server can write to, ideally outside the web root.', 'vulobackup')}>
					<TextInput name="backup_dir" value={folderValue} placeholder={values.backup_dir_default} onChange={(value) => setFolder(String(value))} />
				</Row>
				{null !== folder && folder !== values.backup_dir && (
					<Wide>
						<div className="vulobackup-inline">
							<ButtonInput
								buttons={[
									{ text: __('Cancel', 'vulobackup'), color: 'purple', onClick: () => setFolder(null) },
									{
										text: __('Use this folder', 'vulobackup'),
										color: 'purple',
										onClick: () => {
											set({ backup_dir: folder });
											setFolder(null);
										},
									},
								]}
							/>
							<span className="vulobackup-secondary">{__('Backups already in the current folder stay there and will no longer be listed.', 'vulobackup')}</span>
						</div>
					</Wide>
				)}
				<Wide>
					<NoticeComponent
						displayPosition="inline-notice"
						type={values.backup_dir_public ? 'warning' : 'success'}
						title={values.backup_dir_public ? __('The folder is inside the web root', 'vulobackup') : __('The folder is outside the web root', 'vulobackup')}
						message={
							values.backup_dir_public
								? sprintf(
										/* translators: %s: folder path. */
										__('In use: %s. It is protected, and Diagnostics checks that the protection works on your server. A folder outside the web root is safer still.', 'vulobackup'),
										values.backup_dir_in_use
								  )
								: sprintf(
										/* translators: %s: folder path. */
										__('In use: %s.', 'vulobackup'),
										values.backup_dir_in_use
								  )
						}
					/>
				</Wide>
			</Section>
			<Section
				icon="link"
				title={__('Remote storage', 'vulobackup')}
				desc={__('A copy somewhere else is what saves you when the server itself is lost. Each new backup is uploaded to every destination that is switched on, and confirmed to have arrived.', 'vulobackup')}
			>
				<Wide>
					<div className="vulobackup-subhead">
						<p>
							{sprintf(
								/* translators: 1: number of destinations, 2: the most allowed. */
								__('%1$d of %2$d destinations', 'vulobackup'),
								listing.destinations.length,
								listing.max
							)}
						</p>
						{!draft && listing.destinations.length < listing.max && (
							<ButtonInput
								buttons={{
									text: choosing ? __('Cancel', 'vulobackup') : __('Add destination', 'vulobackup'),
									icon: choosing ? undefined : 'plus',
									onClick: () => setChoosing(!choosing),
								}}
							/>
						)}
					</div>
				</Wide>
				{choosing && (
					<Wide>
						<div className="vulobackup-checks">
							{listing.providers.map((definition) => (
								<label key={definition.id} htmlFor={`vulobackup-provider-${definition.id}`}>
									<input type="radio" name="vulobackup-provider" id={`vulobackup-provider-${definition.id}`} onChange={() => begin(definition)} />
									<div>
										<strong>{definition.label}</strong>
										<span>
											{'s3' === definition.id
												? __('Amazon S3, Cloudflare R2, Backblaze B2, Wasabi, DigitalOcean Spaces, MinIO and other services with an S3-compatible API.', 'vulobackup')
												: __('Any server you can reach over SFTP: a second host, a NAS, a storage box.', 'vulobackup')}
										</span>
									</div>
								</label>
							))}
						</div>
					</Wide>
				)}
				{!draft && !choosing && 0 === listing.destinations.length && (
					<Wide>
						<div className="vulobackup-empty">
							<i className="adminfont-link" aria-hidden="true" />
							<strong>{__('Backups are kept on this server only', 'vulobackup')}</strong>
							<span>{__('Add a destination to keep a copy somewhere else as well.', 'vulobackup')}</span>
						</div>
					</Wide>
				)}
				{!draft &&
					listing.destinations.map((destination) => (
						<Wide key={destination.id}>
							<div className="vulobackup-item">
								<div className="vulobackup-item-head">
									<span className="vulobackup-item-toggle">
										<i className="adminfont-link" aria-hidden="true" />
									</span>
									<span className="vulobackup-item-text">
										<strong>{destination.name || destination.label}</strong>
										<span className="vulobackup-item-summary">
											{destination.where}
											{destination.checked_at
												? ` · ${sprintf(
														/* translators: %s: date and time. */
														__('checked %s', 'vulobackup'),
														destination.checked_at
												  )}`
												: ''}
										</span>
									</span>
									<BadgeComponent color={destination.ok ? 'green' : 'red'} text={destination.ok ? __('Connected', 'vulobackup') : __('Failing', 'vulobackup')} />
									<button
										type="button"
										role="switch"
										aria-checked={destination.enabled}
										aria-label={sprintf(
											/* translators: %s: destination name. */
											__('Send new backups to %s', 'vulobackup'),
											destination.name || destination.label
										)}
										className={`vulobackup-switch${destination.enabled ? ' is-on' : ''}`}
										onClick={() => act(destination.id, () => apiPost(`destinations/${destination.id}/enabled`, { enabled: !destination.enabled }))}
									>
										<span aria-hidden="true" />
									</button>
								</div>
								<div className="vulobackup-popup-body">
									{!destination.ok && destination.message && <NoticeComponent displayPosition="inline-notice" type="error" message={destination.message} />}
									{destination.fingerprint && (
										<span className="vulobackup-secondary">
											{__('Server key fingerprint:', 'vulobackup')} <span className="vulobackup-hash">{destination.fingerprint}</span>
										</span>
									)}
									<ButtonInput
										buttons={[
											{
												text: __('Remove', 'vulobackup'),
												icon: 'delete',
												color: 'border-red',
												disabled: '' !== isBusy,
												onClick: () =>
													act(destination.id, () => apiDelete(`destinations/${destination.id}`), __('Destination removed. Backups already stored there were left in place.', 'vulobackup')),
											},
											{ text: __('Change', 'vulobackup'), color: 'purple', icon: 'edit', disabled: '' !== isBusy, onClick: () => edit(destination) },
											{
												text: isBusy === destination.id ? __('Testing…', 'vulobackup') : __('Test connection', 'vulobackup'),
												icon: 'refresh',
												color: 'purple',
												disabled: '' !== isBusy,
												onClick: () => act(destination.id, () => apiPost(`destinations/${destination.id}/test`)),
											},
										]}
									/>
								</div>
							</div>
						</Wide>
					))}
				{draft && provider && (
					<>
						<Row label={__('Name', 'vulobackup')} desc={__('Only you see this, in the list of backups.', 'vulobackup')}>
							<TextInput name="destination-name" value={draft.name} placeholder={provider.label} onChange={(value) => setDraft({ ...draft, name: String(value) })} />
						</Row>
						{provider.fields.map((field) => {
							const value = draft.config[field.key];
							const change = (next: string | number | boolean) => setDraft({ ...draft, config: { ...draft.config, [field.key]: next } });
							const kept = field.secret && editing?.has_secret[field.key];
							const help = [field.help, kept ? __('Leave empty to keep the one that is saved.', 'vulobackup') : ''].filter(Boolean).join(' ');

							if ('toggle' === field.type) {
								return (
									<Wide key={field.key}>
										<Switch name={`destination-${field.key}`} label={field.label} desc={field.help} checked={Boolean(value)} onChange={change} />
									</Wide>
								);
							}

							return (
								<Row key={field.key} label={field.label} desc={help}>
									{'textarea' === field.type ? (
										<TextAreaInput name={`destination-${field.key}`} rowNumber={4} usePlainText value={String(value ?? '')} onChange={(next) => change(String(next))} />
									) : (
										<TextInput
											name={`destination-${field.key}`}
											type={'password' === field.type ? 'password' : 'number' === field.type ? 'number' : 'text'}
											value={value as string | number}
											placeholder={kept ? '••••••••' : field.placeholder}
											onChange={(next) => change('number' === field.type ? Number(next) : String(next))}
										/>
									)}
								</Row>
							);
						})}
						<Wide>
							<div className="vulobackup-inline">
								<ButtonInput
									buttons={[
										{ text: __('Cancel', 'vulobackup'), color: 'purple', disabled: 'save' === isBusy, onClick: () => setDraft(null) },
										{
											text: 'save' === isBusy ? __('Testing…', 'vulobackup') : __('Test and save', 'vulobackup'),
											icon: 'check',
											disabled: 'save' === isBusy,
											onClick: save,
										},
									]}
								/>
								<span className="vulobackup-secondary">{__('A small test file is written, read back and deleted. Nothing is saved unless that works.', 'vulobackup')}</span>
							</div>
						</Wide>
					</>
				)}
			</Section>
		</Sections>
	);
};

export default Storage;
