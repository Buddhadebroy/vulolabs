/* global vulomailAppLocalizer */
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { PopupComponent, type SaveStatus } from '@zyra/components';
import { ButtonInput, TextInput } from '@zyra/inputs';
import ConnectionForm from './ConnectionForm';
import {
	Card,
	EmptyState,
	IconTile,
	Pill,
	Skeleton,
	Switch,
	tabUrl,
} from '../components/ui';
import type { Status } from '../components/ui';
import { apiDelete, apiGet, apiPost } from '../services/api';
import { errorMessage, notify } from '../services/notify';
import type {
	Connection,
	ConnectionsPayload,
	Routing,
	Settings,
} from '../services/types';

type Channel = 'email' | 'sms';

interface ChannelSettingsProps {
	channel: Channel;
	// eslint-disable-next-line no-unused-vars -- parameter name in a type signature, not a variable.
	onSaveStatusChange?: (status: SaveStatus) => void;
}

const ROUTING_KEYS: (keyof Routing)[] = [
	'email_primary',
	'email_backup',
	'sms_primary',
	'sms_backup',
];

/** A connection messages can actually go through: switched on, with every required field filled in. */
const isUsable = (connection: Connection): boolean =>
	connection.enabled && 0 === connection.missing.length;

/** zyra's text input, saving when it loses focus (or on Enter) and only when its value changed. */
const BlurField = ({
	id,
	type = 'text',
	value,
	placeholder,
	preText,
	validate,
	onSave,
}: {
	id: string;
	type?: 'text' | 'email';
	value: string;
	placeholder?: string;
	preText?: string;
	// eslint-disable-next-line no-unused-vars -- parameter name in a type signature, not a variable.
	validate?: (next: string) => string;
	// eslint-disable-next-line no-unused-vars -- parameter name in a type signature, not a variable.
	onSave: (next: string) => void;
}) => {
	const [draft, setDraft] = useState(value);
	const [problem, setProblem] = useState('');

	useEffect(() => setDraft(value), [value]);

	const commit = () => {
		const next = draft.trim();
		const issue = validate ? validate(next) : '';

		setProblem(issue);

		if (!issue && next !== value) {
			onSave(next);
		}
	};

	return (
		<>
			<TextInput
				id={id}
				name={id}
				type={type}
				value={draft}
				placeholder={placeholder}
				preText={preText}
				onChange={(next) => setDraft(String(next))}
				onBlur={commit}
				onKeyDown={(event) => {
					if ('Enter' === event.key) {
						event.currentTarget.blur();
					}
				}}
			/>
			{problem && (
				<p className="vm-set-field-error" role="alert">
					{problem}
				</p>
			)}
		</>
	);
};

/** One setting: label and help on the left, the control on the right. Settings → Tools uses it too. */
export const FieldRow = ({
	htmlFor,
	label,
	help,
	children,
}: {
	htmlFor?: string;
	label: string;
	help?: string;
	children: ReactNode;
}) => (
	<div className="vm-set-field">
		<div className="vm-set-field-label">
			<label htmlFor={htmlFor}>{label}</label>
			{help && <p>{help}</p>}
		</div>
		<div className="vm-set-field-main">{children}</div>
	</div>
);

/**
 * Settings → Email / SMS: everything about one channel on one screen, in the order people ask about it - is it
 * working, which connection sends and what takes over when it fails, the connections themselves, then the channel's
 * own details (the sender, or phone numbers). Every change saves as it is made.
 */
const ChannelSettings = ({
	channel,
	onSaveStatusChange,
}: ChannelSettingsProps) => {
	const isEmail = 'email' === channel;
	const [settings, setSettings] = useState<Settings | null>(null);
	const [connections, setConnections] = useState<Connection[] | null>(null);
	const [error, setError] = useState('');
	const [editing, setEditing] = useState<{ connection?: Connection } | null>(
		null
	);
	const [pendingDelete, setPendingDelete] = useState<Connection | null>(null);

	useEffect(() => {
		Promise.all([
			apiGet<Settings>('settings'),
			apiGet<ConnectionsPayload>('connections'),
		])
			.then(([stored, payload]) => {
				setSettings(stored);
				setConnections(payload.connections);
			})
			.catch((e) => setError(errorMessage(e)));
	}, []);

	// Back from "Sign in with Google": say how it went, then drop the result from the address so a reload doesn't repeat it.
	useEffect(() => {
		const params = new URLSearchParams(
			window.location.hash.replace(/^#/, '')
		);
		const outcome = params.get('google');

		if (!outcome) {
			return;
		}

		notify(
			'connected' === outcome ? 'success' : 'error',
			params.get('google_message') ?? '',
			'vulomail-google'
		);

		params.delete('google');
		params.delete('google_message');
		window.history.replaceState(
			null,
			'',
			`${window.location.pathname}${window.location.search}#${params.toString()}`
		);
	}, []);

	if (error) {
		return (
			<Card>
				<EmptyState
					icon="error"
					tone="red"
					title={__('Could not load these settings', 'vulomail')}
					text={error}
				/>
			</Card>
		);
	}

	if (!settings || !connections) {
		return (
			<div className="vm-page vm-set" aria-busy="true">
				<Skeleton size="hero" />
				<Skeleton size="block" />
				<Skeleton size="block" />
			</div>
		);
	}

	/** Saves some settings at once: shown straight away, and put back if the server refuses them. */
	const save = (changes: Partial<Settings>) => {
		let before: Settings | null = settings;

		setSettings((current) => {
			before = current;
			return current ? { ...current, ...changes } : current;
		});
		onSaveStatusChange?.('saving');

		apiPost<Settings>('settings', changes)
			.then((saved) => {
				setSettings(saved);
				onSaveStatusChange?.('saved');
			})
			.catch((e) => {
				setSettings(before);
				onSaveStatusChange?.('error');
				notify('error', errorMessage(e));
			});
	};

	/** A connection change returns the whole list and the routing it left behind. */
	const applyPayload = (payload: ConnectionsPayload) => {
		setConnections(payload.connections);
		setSettings((current) =>
			current
				? ROUTING_KEYS.reduce(
						(next, key) => ({
							...next,
							[key]: payload.routing[key],
						}),
						current
					)
				: current
		);
	};

	const own = connections.filter((item) => item.channel === channel);
	const enabledKey = isEmail ? 'email_enabled' : 'sms_enabled';
	const primaryKey = `${channel}_primary` as keyof Routing;
	const backupKey = `${channel}_backup` as keyof Routing;
	const enabled = Boolean(settings[enabledKey]);
	const primaryId = settings[primaryKey];
	const backupId = settings[backupKey];
	const primary = own.find((item) => item.id === primaryId);
	const backup = own.find((item) => item.id === backupId);
	const primaryWorks = Boolean(primary && isUsable(primary));

	// The order a message tries them in, then the connections that have no place in it yet.
	const inOrder = [...(primary ? [primary] : []), ...(backup ? [backup] : [])];
	const spares = own.filter((item) => item !== primary && item !== backup);

	/** Sends everything through a connection; the one it replaces becomes the backup, if that slot is free. */
	const makePrimary = (connection: Connection) => {
		const changes: Partial<Settings> = { [primaryKey]: connection.id };

		if (backupId === connection.id || (!backup && primaryWorks)) {
			changes[backupKey] = primaryWorks && primary ? primary.id : '';
		}

		save(changes);
		notify(
			'success',
			sprintf(
				/* translators: %s: connection name. */
				__('%s now sends every message.', 'vulomail'),
				connection.label
			)
		);
	};

	const useAsBackup = (connection: Connection) => {
		save({ [backupKey]: connection.id });
		notify(
			'success',
			sprintf(
				/* translators: 1: connection name, 2: primary connection name. */
				__('%1$s now takes over if %2$s fails.', 'vulomail'),
				connection.label,
				primary?.label ?? ''
			)
		);
	};

	/**
	 * A connection just added goes straight to work: it becomes the primary when nothing usable sends yet, or the
	 * backup when that slot is free. Saves the step of finding it again to choose it.
	 */
	const placeNew = (payload: ConnectionsPayload & { saved?: string }) => {
		const added = payload.connections.find((item) => item.id === payload.saved);

		if (!added || !isUsable(added)) {
			notify('success', __('Connection saved.', 'vulomail'));
			return;
		}

		const routing = payload.routing;
		const current = payload.connections.find((item) => item.id === routing[primaryKey]);

		if (current?.id === added.id) {
			notify(
				'success',
				sprintf(
					/* translators: %s: connection name. */
					__('%s is connected and sends every message.', 'vulomail'),
					added.label
				)
			);
			return;
		}

		if (!current || !isUsable(current)) {
			save({ [primaryKey]: added.id });
			notify(
				'success',
				sprintf(
					/* translators: %s: connection name. */
					__('%s is connected and sends every message.', 'vulomail'),
					added.label
				)
			);
		} else if (!routing[backupKey]) {
			save({ [backupKey]: added.id });
			notify(
				'success',
				sprintf(
					/* translators: 1: connection name, 2: primary connection name. */
					__('%1$s is connected as the backup for %2$s.', 'vulomail'),
					added.label,
					current.label
				)
			);
		} else {
			notify('success', __('Connection saved. Make it primary or the backup to use it.', 'vulomail'));
		}
	};

	const toggleConnection = (connection: Connection) => {
		apiPost<ConnectionsPayload>('connections', {
			id: connection.id,
			enabled: !connection.enabled,
		})
			.then((payload) => {
				applyPayload(payload);
				notify(
					'success',
					connection.enabled
						? __('Connection switched off.', 'vulomail')
						: __('Connection switched on.', 'vulomail')
				);
			})
			.catch((e) => notify('error', errorMessage(e)));
	};

	const confirmDelete = () => {
		if (!pendingDelete) {
			return;
		}

		apiDelete<ConnectionsPayload>(`connections/${pendingDelete.id}`)
			.then((payload) => {
				applyPayload(payload);
				notify('success', __('Connection deleted.', 'vulomail'));
			})
			.catch((e) => notify('error', errorMessage(e)))
			.finally(() => setPendingDelete(null));
	};

	// ---- 1. Status: one short line; the route and the switch say the rest ----
	let tone: Status = 'good';
	let statusWord = __('Working', 'vulomail');
	let statusText: string;

	if (!enabled) {
		tone = 'off';
		statusWord = __('Off', 'vulomail');
		statusText = isEmail
			? __(
					"VuloMail isn't handling email. WordPress sends it on its own.",
					'vulomail'
				)
			: __(
					'No text messages are sent, including SMS alerts.',
					'vulomail'
				);
	} else if (!primaryWorks) {
		tone = isEmail ? 'warn' : 'bad';
		statusWord = isEmail
			? __('Using WordPress mailer', 'vulomail')
			: __('Not set up', 'vulomail');
		statusText = isEmail
			? __(
					'Many hosts block this mailer or send it to spam. Connect your own provider.',
					'vulomail'
				)
			: __(
					'No gateway is set up, so no text messages are sent.',
					'vulomail'
				);
	} else {
		statusText =
			backup && isUsable(backup)
				? __(
						'Every message goes through your own provider, with a backup if it fails.',
						'vulomail'
					)
				: __(
						'Every message goes through your own provider. There is no backup if it fails.',
						'vulomail'
					);
	}

	const usableCount = own.filter(isUsable).length;

	const providers = vulomailAppLocalizer.providers
		.filter((provider) => provider.channel === channel)
		.map((provider) => provider.label);

	const switchLabel = isEmail
		? __('Send email with VuloMail', 'vulomail')
		: __('Send SMS with VuloMail', 'vulomail');

	// The way a message actually goes, for the status card: primary, backup, then the WordPress mailer.
	const route: {
		key: string;
		label: string;
		note?: string;
		isFallback?: boolean;
	}[] = [];

	if (primaryWorks && primary) {
		route.push({ key: 'primary', label: primary.label });

		if (backup && isUsable(backup)) {
			route.push({
				key: 'backup',
				label: backup.label,
				note: __('backup', 'vulomail'),
			});
		}

		if (isEmail && settings.fallback_to_default) {
			route.push({
				key: 'wp',
				label: __('WordPress mailer', 'vulomail'),
				note: __('last resort', 'vulomail'),
				isFallback: true,
			});
		}
	} else {
		route.push(
			isEmail
				? {
						key: 'wp',
						label: __('WordPress default mailer', 'vulomail'),
						isFallback: true,
					}
				: {
						key: 'none',
						label: __('Nothing yet', 'vulomail'),
						isFallback: true,
					}
		);
	}

	// The one thing to do next, when the channel is on but not sending through a connection.
	let cta: {
		text: string;
		icon: string;
		color: string;
		onClick: () => void;
	} | null = null;

	if (enabled && !primaryWorks && 0 === usableCount) {
		cta = {
			text: isEmail
				? __('Add connection', 'vulomail')
				: __('Add gateway', 'vulomail'),
			icon: 'plus',
			color: 'purple-bg',
			onClick: () => setEditing({}),
		};
	} else if (enabled && !primaryWorks) {
		cta = {
			text: __('Choose primary', 'vulomail'),
			icon: 'arrow-down',
			color: 'purple-bg',
			onClick: () =>
				document
					.getElementById(`vm-set-connections-${channel}`)
					?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
		};
	}

	/** One connection's row: its step in the order, what it does, the buttons that change that, and its tools. */
	const renderConnection = (item: Connection) => {
				const isPrimary = primaryId === item.id;
				const isBackup = backupId === item.id;
				const incomplete = item.missing.length > 0;
				const usable = isUsable(item);
				const step = isPrimary
					? 1
					: isBackup
						? 2
						: null;

				let sub: string;

				if (incomplete) {
					sub = sprintf(
						/* translators: %s: comma-separated field names. */
						__('Missing: %s', 'vulomail'),
						item.missing.join(', ')
					);
				} else if (!item.enabled) {
					sub = isPrimary || isBackup
						? __('Switched off, so messages skip it', 'vulomail')
						: __('Switched off', 'vulomail');
				} else if (isPrimary) {
					sub = __('Sends every message', 'vulomail');
				} else if (isBackup) {
					sub = sprintf(
						/* translators: %s: primary connection name. */
						__('Takes over if %s fails', 'vulomail'),
						primary?.label ?? ''
					);
				} else {
					sub = '';
				}

				const meta = [item.provider_label, item.settings.account_email]
					.filter(Boolean)
					.join(' · ');

				return (
					<li
						key={item.id}
						className={[
							item.enabled ? '' : 'is-off',
							step ? '' : 'is-spare',
						]
							.filter(Boolean)
							.join(' ')}
					>
						<span className="vm-set-step" aria-hidden={!step}>
							{step ?? ''}
						</span>
						<div className="vm-set-conn-main">
							<div className="vm-set-conn-title">
								<strong>{item.label}</strong>
								{isPrimary && (
									<span className="vm-set-tag is-primary">
										{__('Primary', 'vulomail')}
									</span>
								)}
								{isBackup && (
									<span className="vm-set-tag">
										{__('Backup', 'vulomail')}
									</span>
								)}
							</div>
							<span
								className={`vm-set-conn-sub${incomplete ? ' is-bad' : ''}`}
							>
								{incomplete ? sub : [sub, meta].filter(Boolean).join(' · ')}
							</span>
						</div>
						<div className="vm-set-conn-roles">
							{incomplete && (
								<button
									type="button"
									className="vm-chip-link is-accent"
									onClick={() => setEditing({ connection: item })}
								>
									{__('Finish setup', 'vulomail')}
								</button>
							)}
							{usable && !isPrimary && (
								<button
									type="button"
									className={`vm-chip-link${primaryWorks ? '' : ' is-accent'}`}
									onClick={() => makePrimary(item)}
								>
									{__('Make primary', 'vulomail')}
								</button>
							)}
							{usable && !isPrimary && !isBackup && primaryWorks && (
								<button
									type="button"
									className="vm-chip-link"
									onClick={() => useAsBackup(item)}
								>
									{__('Use as backup', 'vulomail')}
								</button>
							)}
							{isBackup && (
								<button
									type="button"
									className="vm-chip-link"
									onClick={() => {
										save({ [backupKey]: '' });
										notify(
											'success',
											sprintf(
												/* translators: %s: connection name. */
												__('%s is no longer the backup.', 'vulomail'),
												item.label
											)
										);
									}}
								>
									{__('Remove backup', 'vulomail')}
								</button>
							)}
						</div>
						<div className="vm-set-conn-actions">
							<a
								className={`vm-set-icon-btn${incomplete ? ' is-disabled' : ''}`}
								href={
									incomplete
										? undefined
										: tabUrl(`settings&subtab=tools&connection=${item.id}`)
								}
								aria-disabled={incomplete}
								title={__('Send a test', 'vulomail')}
							>
								<i className="adminfont-send" aria-hidden="true" />
								<span className="screen-reader-text">
									{sprintf(
										/* translators: %s: connection name. */
										__('Send a test through %s', 'vulomail'),
										item.label
									)}
								</span>
							</a>
							<button
								type="button"
								className="vm-set-icon-btn"
								title={__('Edit', 'vulomail')}
								onClick={() => setEditing({ connection: item })}
							>
								<i className="adminfont-edit" aria-hidden="true" />
								<span className="screen-reader-text">
									{sprintf(
										/* translators: %s: connection name. */
										__('Edit %s', 'vulomail'),
										item.label
									)}
								</span>
							</button>
							<button
								type="button"
								className="vm-set-icon-btn is-danger"
								title={__('Delete', 'vulomail')}
								onClick={() => setPendingDelete(item)}
							>
								<i className="adminfont-delete" aria-hidden="true" />
								<span className="screen-reader-text">
									{sprintf(
										/* translators: %s: connection name. */
										__('Delete %s', 'vulomail'),
										item.label
									)}
								</span>
							</button>
							<Switch
								checked={item.enabled}
								onChange={() => toggleConnection(item)}
								label={sprintf(
									/* translators: %s: connection name. */
									__('Use %s', 'vulomail'),
									item.label
								)}
							/>
						</div>
					</li>
				);
	};

	return (
		<div className="vm-page vm-set">
			{/* 1. Is it working? Status and the route on top, the main action beside them, the switch underneath. */}
			<section
				className={`vm-set-hero is-${tone}`}
				aria-labelledby={`vm-set-hero-${channel}`}
			>
				<div className="vm-set-hero-main">
					<IconTile
						icon={isEmail ? 'mail' : 'send'}
						tone={
							'good' === tone
								? 'green'
								: 'warn' === tone
									? 'amber'
									: 'bad' === tone
										? 'red'
										: 'neutral'
						}
						size="lg"
					/>
					<div className="vm-set-hero-text">
						<div className="vm-set-hero-title">
							<h3 id={`vm-set-hero-${channel}`}>
								{isEmail
									? __('Email delivery', 'vulomail')
									: __('Text messages (SMS)', 'vulomail')}
							</h3>
							<Pill status={tone}>{statusWord}</Pill>
						</div>
						<p>{statusText}</p>
						{enabled && (
							<div className="vm-set-path">
								<span className="vm-set-path-label">
									{__('Sends through', 'vulomail')}
								</span>
								<ol>
									{route.map((step, index) => (
										<li
											key={step.key}
											className={
												step.isFallback
													? 'is-fallback'
													: ''
											}
										>
											{index > 0 && (
												<i
													className="vm-set-path-arrow"
													aria-hidden="true"
												/>
											)}
											<span className="vm-set-path-chip">
												{step.label}
												{step.note && (
													<em>{step.note}</em>
												)}
											</span>
										</li>
									))}
								</ol>
							</div>
						)}
					</div>
					<div className="vm-set-hero-actions">
						<ButtonInput
							buttons={[
								// A text message test needs a gateway; an email one can always go through WordPress.
								...(isEmail || primaryWorks
									? [
											{
												text: __(
													'Send a test',
													'vulomail'
												),
												icon: 'send',
												color: 'purple',
												onClick: () => {
													window.location.hash = `&tab=settings&subtab=tools&test=${channel}`;
												},
											},
										]
									: []),
								...(cta ? [cta] : []),
							]}
						/>
					</div>
				</div>
				<div className="vm-set-hero-foot">
					<div>
						<strong>{switchLabel}</strong>
						<span>
							{isEmail
								? __(
										'When off, WordPress sends email exactly as it would without VuloMail. Your connections are kept.',
										'vulomail'
									)
								: __(
										'When off, no text messages are sent, including alerts and messages from other plugins.',
										'vulomail'
									)}
						</span>
					</div>
					<Switch
						checked={enabled}
						onChange={() => save({ [enabledKey]: !enabled })}
						label={switchLabel}
					/>
				</div>
			</section>

			{/* 2. The connections, listed in the order a message tries them, each with its role and how to change it. */}
			<Card
				id={`vm-set-connections-${channel}`}
				icon="link"
				title={
					isEmail
						? __('Connections', 'vulomail')
						: __('Gateways', 'vulomail')
				}
				desc={
					own.length > 0
						? __(
								'Each message tries these from the top and stops at the first one that delivers it.',
								'vulomail'
							)
						: isEmail
							? __(
									'The email services this site sends through. Passwords and API keys are encrypted.',
									'vulomail'
								)
							: __(
									'The SMS gateways this site sends through. API keys are encrypted.',
									'vulomail'
								)
				}
				action={
					own.length > 0 && (
						<ButtonInput
							buttons={{
								text: isEmail
									? __('Add connection', 'vulomail')
									: __('Add gateway', 'vulomail'),
								icon: 'plus',
								color: 'purple-bg',
								onClick: () => setEditing({}),
							}}
						/>
					)
				}
			>
				{0 === own.length ? (
					<EmptyState
						icon={isEmail ? 'mail' : 'send'}
						title={
							isEmail
								? __('No email connection yet', 'vulomail')
								: __('No SMS gateway yet', 'vulomail')
						}
						text={sprintf(
							/* translators: %s: comma-separated provider names. */
							__(
								'Connect %s, or another provider you already use. It starts sending as soon as it is saved.',
								'vulomail'
							),
							providers.slice(0, 4).join(', ')
						)}
						action={
							<ButtonInput
								buttons={{
									text: isEmail
										? __('Add email connection', 'vulomail')
										: __('Add SMS gateway', 'vulomail'),
									icon: 'plus',
									color: 'purple-bg',
									onClick: () => setEditing({}),
								}}
							/>
						}
					/>
				) : (
					<ol className={`vm-set-conns${enabled ? '' : ' is-muted'}`}>
						{/* Until a connection is primary, WordPress's own mailer is what sends: say so at the top. */}
						{isEmail && !primaryWorks && (
							<li className="is-wp">
								<span className="vm-set-step">1</span>
								<div className="vm-set-conn-main">
									<div className="vm-set-conn-title">
										<strong>
											{__('WordPress default mailer', 'vulomail')}
										</strong>
										<span className="vm-set-tag is-warn">
											{__('Sending now', 'vulomail')}
										</span>
									</div>
									<span className="vm-set-conn-sub">
										{usableCount > 0
											? __(
													'Make one of your connections primary below to send through it instead.',
													'vulomail'
												)
											: __(
													'Sends every email until one of your connections can take over.',
													'vulomail'
												)}
									</span>
								</div>
							</li>
						)}
						{inOrder.map(renderConnection)}

						{/* The natural next step once one connection sends: a second one to fall back on. */}
						{primaryWorks && !backup && 1 === usableCount && (
							<li className="is-add">
								<span className="vm-set-step">2</span>
								<div className="vm-set-conn-main">
									<div className="vm-set-conn-title">
										<strong>{__('Add a backup', 'vulomail')}</strong>
									</div>
									<span className="vm-set-conn-sub">
										{sprintf(
											/* translators: %s: primary connection name. */
											__(
												'If %s goes down, messages keep going out through the backup.',
												'vulomail'
											),
											primary?.label ?? ''
										)}
									</span>
								</div>
								<div className="vm-set-conn-roles">
									<button
										type="button"
										className="vm-chip-link is-accent"
										onClick={() => setEditing({})}
									>
										{isEmail
											? __('Add backup connection', 'vulomail')
											: __('Add backup gateway', 'vulomail')}
									</button>
								</div>
							</li>
						)}

						{/* Last stop for email: hand it to WordPress rather than lose it. */}
						{isEmail && primaryWorks && (
							<li className="is-wp">
								<span className="vm-set-step">{backup && isUsable(backup) ? 3 : 2}</span>
								<div className="vm-set-conn-main">
									<div className="vm-set-conn-title">
										<strong>
											{__('WordPress default mailer', 'vulomail')}
										</strong>
										<span className="vm-set-tag">
											{__('Last resort', 'vulomail')}
										</span>
									</div>
									<span className="vm-set-conn-sub">
										{settings.fallback_to_default
											? __(
													'If every connection fails, the email goes out this way instead of being lost.',
													'vulomail'
												)
											: __(
													'Off: if every connection fails, the email is not sent.',
													'vulomail'
												)}
									</span>
								</div>
								<div className="vm-set-conn-actions">
									<Switch
										checked={Boolean(settings.fallback_to_default)}
										onChange={() =>
											save({
												fallback_to_default: !settings.fallback_to_default,
											})
										}
										label={__(
											'Fall back to the WordPress default mailer',
											'vulomail'
										)}
									/>
								</div>
							</li>
						)}
						{spares.length > 0 && (
							<li className="vm-set-conns-group" aria-hidden="true">
								{__('Not in use', 'vulomail')}
							</li>
						)}
						{spares.map(renderConnection)}
					</ol>
				)}
			</Card>

			{/* 3. The channel's own details. */}
			{isEmail ? (
				<Card
					id="vm-set-sender"
					icon="profile"
					title={__('Sender', 'vulomail')}
					desc={__(
						'Who your email appears to come from.',
						'vulomail'
					)}
				>
					<FieldRow
						htmlFor="vm-from-email"
						label={__('Sender email', 'vulomail')}
						help={__(
							'Use an address on your own domain that your email provider has verified.',
							'vulomail'
						)}
					>
						<BlurField
							id="vm-from-email"
							type="email"
							value={settings.from_email}
							placeholder={vulomailAppLocalizer.default_from}
							validate={(next) =>
								'' === next ||
								/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next)
									? ''
									: __(
											'Enter a full email address, like hello@yourdomain.com.',
											'vulomail'
										)
							}
							onSave={(next) => save({ from_email: next })}
						/>
						<label className="vm-set-check">
							<input
								type="checkbox"
								checked={Boolean(settings.force_from_email)}
								onChange={() =>
									save({
										force_from_email:
											!settings.force_from_email,
									})
								}
							/>
							{__(
								'Use it even when a plugin sets its own sender address',
								'vulomail'
							)}
						</label>
					</FieldRow>
					<FieldRow
						htmlFor="vm-from-name"
						label={__('Sender name', 'vulomail')}
						help={__(
							'Shown in the inbox instead of "WordPress".',
							'vulomail'
						)}
					>
						<BlurField
							id="vm-from-name"
							value={settings.from_name}
							placeholder={__(
								'Your site or business name',
								'vulomail'
							)}
							onSave={(next) => save({ from_name: next })}
						/>
						<label className="vm-set-check">
							<input
								type="checkbox"
								checked={Boolean(settings.force_from_name)}
								onChange={() =>
									save({
										force_from_name:
											!settings.force_from_name,
									})
								}
							/>
							{__(
								'Use it even when a plugin sets its own sender name',
								'vulomail'
							)}
						</label>
					</FieldRow>
				</Card>
			) : (
				<>
					<Card
						id="vm-set-phones"
						icon="profile"
						title={__('Phone numbers', 'vulomail')}
						desc={__(
							'How numbers are read, and where alerts for you are sent.',
							'vulomail'
						)}
					>
						<FieldRow
							htmlFor="vm-sms-country"
							label={__('Default country code', 'vulomail')}
							help={__(
								'Added to numbers written without one, for example 1 or 44.',
								'vulomail'
							)}
						>
							<BlurField
								id="vm-sms-country"
								value={settings.sms_country_code}
								preText="+"
								placeholder="1"
								validate={(next) =>
									/^\d{0,4}$/.test(next)
										? ''
										: __(
												'Digits only, up to 4.',
												'vulomail'
											)
								}
								onSave={(next) =>
									save({ sms_country_code: next })
								}
							/>
						</FieldRow>
						<FieldRow
							htmlFor="vm-sms-admin"
							label={__('Your phone number', 'vulomail')}
							help={__(
								'Where site and store alerts meant for you are sent. International format.',
								'vulomail'
							)}
						>
							<BlurField
								id="vm-sms-admin"
								value={settings.sms_admin_phone}
								placeholder="+14155550123"
								validate={(next) =>
									'' === next ||
									/^\+?\d{6,20}$/.test(
										next.replace(/[\s()-]/g, '')
									)
										? ''
										: __(
												'Enter the number with its country code, like +14155550123.',
												'vulomail'
											)
								}
								onSave={(next) =>
									save({
										sms_admin_phone: next.replace(
											/[\s()-]/g,
											''
										),
									})
								}
							/>
						</FieldRow>
					</Card>
					<a className="vm-set-link-card" href={tabUrl('sms-alerts')}>
						<IconTile icon="notification" tone="violet" />
						<span>
							<strong>{__('SMS alerts', 'vulomail')}</strong>
							<span>
								{__(
									'Choose which events send a text message, and write what each one says.',
									'vulomail'
								)}
							</span>
						</span>
						<i
							className="adminfont-arrow-right"
							aria-hidden="true"
						/>
					</a>
				</>
			)}

			<PopupComponent
				open={Boolean(editing)}
				onClose={() => setEditing(null)}
				width={44}
				height="auto"
				position="lightbox"
				className="vulomail-connection-popup"
				header={{
					icon: isEmail ? 'mail' : 'send',
					title: editing?.connection
						? __('Edit connection', 'vulomail')
						: isEmail
							? __('Add email connection', 'vulomail')
							: __('Add SMS gateway', 'vulomail'),
					description: isEmail
						? __(
								"Connect the email service your site's email is sent through.",
								'vulomail'
							)
						: __(
								'Connect the SMS gateway your text messages are sent through.',
								'vulomail'
							),
				}}
			>
				{editing && (
					<ConnectionForm
						// Remount per connection so the form never shows another connection's values.
						key={editing.connection?.id ?? `new-${channel}`}
						channel={channel}
						connection={editing.connection}
						onCancel={() => setEditing(null)}
						onSaved={(payload) => {
							const isNew = !editing.connection;

							applyPayload(payload);
							setEditing(null);

							if (isNew) {
								placeNew(payload);
							}
						}}
					/>
				)}
			</PopupComponent>
			<PopupComponent
				open={Boolean(pendingDelete)}
				onClose={() => setPendingDelete(null)}
				width={28}
				height="auto"
				position="lightbox"
				header={{
					icon: 'delete',
					title: __('Delete this connection?', 'vulomail'),
				}}
			>
				<div className="vulomail-popup-body">
					<p>
						{sprintf(
							/* translators: %s: connection name. */
							__(
								'"%s" and its saved credentials will be removed. Messages stop going through it straight away.',
								'vulomail'
							),
							pendingDelete?.label ?? ''
						)}
					</p>
					<ButtonInput
						buttons={[
							{
								text: __('Keep connection', 'vulomail'),
								color: 'purple',
								onClick: () => setPendingDelete(null),
							},
							{
								text: __('Delete connection', 'vulomail'),
								icon: 'delete',
								color: 'border-red',
								onClick: confirmDelete,
							},
						]}
					/>
				</div>
			</PopupComponent>
		</div>
	);
};

export const EmailSettings = (props: Omit<ChannelSettingsProps, 'channel'>) => (
	<ChannelSettings channel="email" {...props} />
);
export const SmsSettings = (props: Omit<ChannelSettingsProps, 'channel'>) => (
	<ChannelSettings channel="sms" {...props} />
);

export default ChannelSettings;
