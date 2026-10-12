/* global vuloformAppLocalizer */
import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import type { Dispatch, ReactNode } from 'react';
import { createInterpolateElement } from '@wordpress/element';
import { __, _n, sprintf } from '@wordpress/i18n';
import { NoticeComponent } from '@zyra/components';
import { ButtonInput, SelectInput, TextAreaInput, TextInput } from '@zyra/inputs';
import Switch from '../components/Switch';
import { Row, Section, Sections, Segmented, Wide } from '../components/Section';
import { formSettingsSections } from '../services/slots';
import { notify } from '../services/notify';
import type { ConfirmationRule, Field, FormSettings as Settings, Notification, Webhook } from '../services/types';
import { makeId } from '../services/types';
import { fieldType } from './fields';
import { openBuilder, sectionFromHash } from './route';
import When, { NO_CONDITIONS, OPERATORS } from './When';

interface FormSettingsProps {
	settings: Settings;
	fields: Field[];
	// eslint-disable-next-line no-unused-vars
	onChange: (settings: Settings) => void;
	/** Changes the settings and adds an Email field to the form, as one step. */
	// eslint-disable-next-line no-unused-vars
	onChangeWithEmailField?: (settings: (emailKey: string) => Settings) => void;
}

const MAX_NOTIFICATIONS = 10;
const MAX_WEBHOOKS = 5;
const MAX_CONFIRMATION_RULES = 10;

// The group that was open, so going to Fields and back does not lose the place.
let lastGroup = 'notifications';

/**
 * A group's name in the URL (`&section=integrations`). Two ids differ from what the admin sees:
 * Integrations is stored as `webhooks`, and an extension's group carries an `extension:` prefix.
 */
const sectionOf = (id: string) => ('webhooks' === id ? 'integrations' : id.replace(/^extension:/, ''));

/** The group to return to when the Settings tab is opened again, as named in the URL. */
export const lastSection = () => sectionOf(lastGroup);

/** Opens a group of the Settings tab, by its id (`webhooks`) or its name in the URL. */
export const openSettingsGroup = (id: string) => {
	openBuilder('settings', sectionOf(id));
};

const select = (name: string, value: string, options: { value: string; label: string }[], onChange: Dispatch<string>) => (
	<SelectInput type="single-select" name={name} isClearable={false} options={options} value={value} onChange={(next) => onChange(next as string)} />
);

/** A colour that follows the theme until one is chosen. */
const Colour = ({ name, value, fallback, onChange }: { name: string; value: string; fallback: string; onChange: Dispatch<string> }) =>
	value ? (
		<div className="vuloform-inline">
			<TextInput name={name} type="color" value={value} onChange={(next) => onChange(String(next))} />
			<button type="button" className="vuloform-link" onClick={() => onChange('')}>
				{__('Use the theme\'s colour', 'vuloform')}
			</button>
		</div>
	) : (
		<div className="vuloform-inline">
			<span className="vuloform-muted">{__('Follows your theme', 'vuloform')}</span>
			<button type="button" className="vuloform-link" onClick={() => onChange(fallback)}>
				{__('Choose a colour', 'vuloform')}
			</button>
		</div>
	);

interface ItemProps {
	icon: string;
	/** The name as stored, edited in place in the header. */
	name: string;
	/** Shown in grey while the name is empty. */
	fallbackName: string;
	// eslint-disable-next-line no-unused-vars
	onRename: (name: string) => void;
	summary: string;
	enabled: boolean;
	isOpen: boolean;
	onToggleOpen: () => void;
	// eslint-disable-next-line no-unused-vars
	onEnabled: (enabled: boolean) => void;
	onRemove: () => void;
	children: ReactNode;
}

/**
 * One notification or webhook: a line that says what it does, opened to edit. Several of them stay
 * readable as a list instead of becoming one very long form. Its name is only for the site owner,
 * so it is typed straight into the line rather than being one more setting inside it.
 */
const Item = ({ icon, name, fallbackName, onRename, summary, enabled, isOpen, onToggleOpen, onEnabled, onRemove, children }: ItemProps) => {
	const title = name || fallbackName;

	return (
	<div className={`vuloform-item${isOpen ? ' is-open' : ''}${enabled ? '' : ' is-off'}`}>
		<div className="vuloform-item-head">
			<button
				type="button"
				className="vuloform-item-toggle"
				aria-expanded={isOpen}
				aria-label={sprintf(
					/* translators: %s: name of a notification or webhook. */
					isOpen ? __('Close "%s"', 'vuloform') : __('Open "%s"', 'vuloform'),
					title
				)}
				onClick={onToggleOpen}
			>
				<i className={`adminfont-${icon}`} aria-hidden="true" />
			</button>
			<span className="vuloform-item-text">
				<input
					type="text"
					className="vuloform-item-name"
					value={name}
					placeholder={fallbackName}
					aria-label={__('Name. Only you see it.', 'vuloform')}
					title={__('Click to rename. Only you see this name.', 'vuloform')}
					size={Math.max(6, (name || fallbackName).length + 1)}
					maxLength={80}
					onChange={(event) => onRename(event.target.value)}
				/>
				<button type="button" className="vuloform-item-summary" tabIndex={-1} onClick={onToggleOpen}>
					{summary}
				</button>
			</span>
			{!enabled && <span className="vuloform-item-state">{__('Off', 'vuloform')}</span>}
			<button
				type="button"
				role="switch"
				aria-checked={enabled}
				aria-label={sprintf(
					/* translators: %s: name of a notification or webhook. */
					__('Use "%s"', 'vuloform'),
					title
				)}
				className={`vuloform-switch${enabled ? ' is-on' : ''}`}
				onClick={() => onEnabled(!enabled)}
			>
				<span aria-hidden="true" />
			</button>
			<button
				type="button"
				className="vuloform-icon-button is-danger"
				aria-label={sprintf(
					/* translators: %s: name of a notification or webhook. */
					__('Remove "%s"', 'vuloform'),
					title
				)}
				title={__('Remove', 'vuloform')}
				onClick={onRemove}
			>
				<i className="adminfont-delete" aria-hidden="true" />
			</button>
			<button type="button" className="vuloform-icon-button" aria-hidden="true" tabIndex={-1} onClick={onToggleOpen}>
				<i className={`adminfont-keyboard-arrow-down${isOpen ? ' is-flipped' : ''}`} />
			</button>
		</div>
		{isOpen && (
			<div className="vuloform-item-body admin-settings vuloform-sections">
				<div className="form-group-wrapper">{children}</div>
			</div>
		)}
	</div>
	);
};

/**
 * Everything about a form that isn't a field, in the order people need it: who is told, what the
 * visitor sees, how the form looks, spam, and connections to other services. One group at a time,
 * each laid out like the other VuloLabs settings screens.
 */
const FormSettings = ({ settings, fields, onChange, onChangeWithEmailField }: FormSettingsProps) => {
	// The open group is whatever the URL names, so it can be linked to and survives a reload.
	const requested = sectionFromHash(useLocation().hash);
	const [openItem, setOpenItem] = useState('');
	const set = (patch: Partial<Settings>) => onChange({ ...settings, ...patch });
	const style = settings.style;
	const setStyle = (key: string, value: string) => set({ style: { ...style, [key]: value } });

	const setGroup = (id: string) => openSettingsGroup(id);

	const inputs = fields.filter((field) => fieldType(field.type)?.input);
	const emailFields = inputs.filter((field) => 'email' === field.type);
	const isMultiStep = fields.some((field) => 'page_break' === field.type);
	const placeholders = ['{all_fields}', ...inputs.map((field) => `{${field.key}}`), '{form_title}', '{site_name}'];

	const setNotification = (index: number, patch: Partial<Notification>) =>
		set({ notifications: settings.notifications.map((item, i) => (i === index ? { ...item, ...patch } : item)) });

	// Adds a placeholder to the end of a message, with a space before it when one is needed.
	const withTag = (message: string, name: string) => `${message}${message && !/\s$/.test(message) ? ' ' : ''}${name}`;

	// The placeholders a message can use, as tags that add themselves when selected.
	// eslint-disable-next-line no-unused-vars
	const answerTags = (onAdd: (name: string) => void) => (
		<span className="vuloform-chips">
			{__('Add an answer:', 'vuloform')}
			{placeholders.map((name) => (
				<button type="button" key={name} title={'{all_fields}' === name ? __('Every answer, one per line', 'vuloform') : undefined} onClick={() => onAdd(name)}>
					{name}
				</button>
			))}
		</span>
	);

	const alternatives = settings.confirmation.rules ?? [];
	const setAlternatives = (rules: ConfirmationRule[]) => set({ confirmation: { ...settings.confirmation, rules } });
	const setAlternative = (index: number, patch: Partial<ConfirmationRule>) =>
		setAlternatives(alternatives.map((item, i) => (i === index ? { ...item, ...patch } : item)));
	// A rule can look at any answer except an uploaded file.
	const ruleFields = inputs.filter((field) => 'file' !== field.type);

	// What one confirmation shows: a message or another page. The same two settings serve the
	// confirmation everyone gets and each exception to it.
	const afterSubmit = (
		name: string,
		value: { type: string; message: string; redirect_url: string },
		// eslint-disable-next-line no-unused-vars
		onPatch: (patch: { type?: string; message?: string; redirect_url?: string }) => void,
		// Inside an exception there is no room for a label beside each setting, so it goes above.
		stacked = false
	) => {
		const line = (label: string, control: ReactNode, desc?: ReactNode) =>
			stacked ? (
				<div className="vuloform-field" key={label}>
					<span className="vuloform-control-label">{label}</span>
					{control}
					{desc && <span className="vuloform-control-desc">{desc}</span>}
				</div>
			) : (
				<Row label={label} desc={desc} key={label}>
					{control}
				</Row>
			);

		return (
			<>
				{line(
					stacked ? __('They see', 'vuloform') : __('Show', 'vuloform'),
					<Segmented
						label={__('What to show after the form is sent', 'vuloform')}
						value={value.type}
						options={[
							{ value: 'message', label: __('A message', 'vuloform') },
							{ value: 'redirect', label: __('Another page', 'vuloform') },
						]}
						onChange={(type) => onPatch({ type })}
					/>
				)}
				{'redirect' === value.type
					? line(
							__('Page address', 'vuloform'),
							<TextInput name={`${name}-redirect`} value={value.redirect_url} placeholder="https://" onChange={(text) => onPatch({ redirect_url: String(text) })} />,
							__('The visitor is taken here straight away. Use the full address, starting with https://.', 'vuloform')
					  )
					: line(
							__('Message', 'vuloform'),
							<TextAreaInput
								name={`${name}-message`}
								rowNumber={3}
								usePlainText
								placeholder={__('Thank you. Your message has been sent.', 'vuloform')}
								value={value.message}
								onChange={(text) => onPatch({ message: String(text) })}
							/>,
							answerTags((tag) => onPatch({ message: withTag(value.message, tag) }))
					  )}
			</>
		);
	};

	// An exception in one line: the answer it waits for and what it then shows.
	const exceptionSummary = (item: ConfirmationRule) => {
		const rule = item.conditions?.rules?.[0];
		const shows = 'redirect' === item.type ? __('another page', 'vuloform') : __('a message', 'vuloform');

		if (!rule) {
			return __('No rule yet: add one to say who sees this', 'vuloform');
		}

		const label = fields.find((field) => field.key === rule.field)?.label || rule.field;
		const needsAnswer = 'empty' !== rule.operator && 'not_empty' !== rule.operator;

		if (needsAnswer && '' === String(rule.value ?? '').trim()) {
			return __('Not finished: enter the answer it waits for', 'vuloform');
		}

		const operator = OPERATORS.find((option) => option.value === rule.operator)?.label ?? rule.operator;
		const when = `${label} ${operator}${needsAnswer ? ` "${rule.value}"` : ''}`;
		const more = item.conditions.rules.length - 1;

		return sprintf(
			/* translators: 1: a rule such as: Subject is "Sales". 2: "a message" or "another page". */
			__('When %1$s: shows %2$s', 'vuloform'),
			more > 0
				? sprintf(
						/* translators: 1: a rule such as: Subject is "Sales". 2: number of further rules. */
						_n('%1$s and %2$d more rule', '%1$s and %2$d more rules', more, 'vuloform'),
						when,
						more
				  )
				: when,
			shows
		);
	};

	// "Only for some answers": a switch, and under it the rules that decide.
	// eslint-disable-next-line no-unused-vars
	const whenToSend = (name: string, value: Notification['conditions'], onWhen: (conditions: NonNullable<Notification['conditions']>) => void, what: string) => (
		<Section icon="filter" title={__('When to send', 'vuloform')} desc={what}>
			<Wide>
				<Switch
					name={`${name}-conditional`}
					label={__('Only for certain answers', 'vuloform')}
					desc={__('Off: sent for every submission. On: sent only when the rules below are met.', 'vuloform')}
					checked={Boolean(value?.enabled)}
					onChange={(enabled) => onWhen({ ...(value ?? NO_CONDITIONS), enabled })}
				/>
			</Wide>
			{value?.enabled && (
				<Wide>
					<When name={name} value={value} fields={fields} onChange={onWhen} />
				</Wide>
			)}
		</Section>
	);

	const setWebhook = (index: number, patch: Partial<Webhook>) =>
		set({ webhooks: settings.webhooks.map((item, i) => (i === index ? { ...item, ...patch } : item)) });

	// An extension either gets a sub-tab of its own or, when it connects the form to another
	// service, a place inside Integrations next to the webhooks.
	const allExtensions = formSettingsSections();
	const extensions = allExtensions.filter((item) => 'integrations' !== item.placement);
	const integrations = allExtensions.filter((item) => 'integrations' === item.placement);
	const integrationCount = integrations.reduce((total, item) => {
		const items = settings.extensions?.[item.id]?.items;

		return total + (Array.isArray(items) ? items.length : 0);
	}, settings.webhooks.length);
	const kit = { Section, Row, Wide, Switch, Segmented, Item };
	const [choosing, setChoosing] = useState(false);
	const count = (n: number) => (n > 0 ? ` (${n})` : '');
	const groups = [
		{ id: 'notifications', title: __('Notifications', 'vuloform') + count(settings.notifications.length), icon: 'notification' },
		// Named for what it holds; "confirmation" is also an email, added under Notifications.
		{ id: 'confirmation', title: __('After submitting', 'vuloform'), icon: 'check' },
		{ id: 'appearance', title: __('Appearance', 'vuloform'), icon: 'edit' },
		// The id predates the name: it is where problems with a webhook point to.
		{ id: 'webhooks', title: __('Integrations', 'vuloform') + count(integrationCount), icon: 'link' },
		...extensions.map((item) => ({ id: `extension:${item.id}`, title: item.title, icon: item.icon })),
	];
	const current = groups.find((item) => sectionOf(item.id) === requested)?.id ?? 'notifications';

	useEffect(() => {
		lastGroup = current;
	}, [current]);
	const extension = extensions.find((item) => `extension:${item.id}` === current);

	// A form that keeps nothing and tells nobody loses every submission.
	const goesNowhere =
		!settings.store_submissions && !settings.notifications.some((item) => item.enabled) && !settings.webhooks.some((item) => item.enabled);

	// A new notification starts with nobody to send to: the address is the site owner's to give.
	// Until it has one it is not saved (see Builder's persist()).
	const newNotification = (preset: Partial<Notification>): Notification => ({
		id: makeId('n'),
		name: __('Email to me', 'vuloform'),
		enabled: true,
		channel: 'email',
		to: '',
		subject: __('New submission: {form_title}', 'vuloform'),
		message: '{all_fields}',
		reply_to: emailFields[0]?.key ?? '',
		...preset,
	});

	const addNotification = () => {
		const added = newNotification({});

		set({ notifications: [...settings.notifications, added] });
		setOpenItem(added.id);
	};

	const confirmation = (emailKey: string) =>
		newNotification({
			name: __('Confirmation to the visitor', 'vuloform'),
			to: `{${emailKey}}`,
			subject: __('We received your message', 'vuloform'),
			message: __('Thank you for getting in touch. This is a copy of what you sent:', 'vuloform') + '\n\n{all_fields}',
			reply_to: '',
		});

	// A confirmation goes to the address the visitor typed, so the form needs an Email field. When
	// it has none, one is added along with the confirmation.
	const addConfirmation = () => {
		if (emailFields.length > 0) {
			const added = confirmation(emailFields[0].key);

			set({ notifications: [...settings.notifications, added] });
			setOpenItem(added.id);

			return;
		}

		onChangeWithEmailField?.((emailKey) => {
			const added = confirmation(emailKey);

			setOpenItem(added.id);

			return { ...settings, notifications: [...settings.notifications, added] };
		});
		notify('info', __('An Email field was added to the form, so the confirmation has an address to go to.', 'vuloform'));
	};

	const addWebhook = () => {
		const id = makeId('w');

		set({ webhooks: [...settings.webhooks, { id, name: __('Custom connector', 'vuloform'), enabled: true, url: '', secret: '', fields: [] }] });
		setOpenItem(id);
	};

	// Everything "Add integration" can add: what extensions offer first, then VuloForm's own
	// custom connector, a webhook to any address.
	const connectors = [
		...integrations.flatMap((item) =>
			(item.connectors ?? []).map((connector) => ({
				...connector,
				id: `${item.id}:${connector.id}`,
				icon: connector.icon ?? 'link',
				add: () => {
					const value = settings.extensions?.[item.id] ?? {};

					set({ extensions: { ...(settings.extensions ?? {}), [item.id]: item.add ? item.add(connector.id, value, fields) : value } });
				},
			}))
		),
		...(settings.webhooks.length < MAX_WEBHOOKS
			? [
					{
						id: 'webhook',
						label: __('Custom connector', 'vuloform'),
						desc: __('A webhook: sends each submission to any address another service gives you.', 'vuloform'),
						icon: 'link',
						add: addWebhook,
					},
			  ]
			: []),
	];

	// A single entry is shown open; with several, the one last opened.
	const isOpen = (id: string, total: number) => openItem === id || (1 === total && '' === openItem);
	const toggleOpen = (id: string, total: number) => setOpenItem(isOpen(id, total) ? 'none' : id);

	return (
		<div className="vuloform-form-settings">
			{goesNowhere && (
				<NoticeComponent
					displayPosition="inline-notice"
					type="warning"
					message={__('Nothing happens to what people send through this form: it is not saved, and no notification or webhook is on. Switch one of them on.', 'vuloform')}
				/>
			)}

			<div className="vuloform-subtabs" role="tablist" aria-label={__('Form settings', 'vuloform')}>
				{groups.map((item) => (
					<button
						key={item.id}
						type="button"
						role="tab"
						aria-selected={current === item.id}
						className={current === item.id ? 'is-active' : ''}
						onClick={() => setGroup(item.id)}
					>
						<i className={`adminfont-${item.icon}`} aria-hidden="true" />
						{item.title}
					</button>
				))}
			</div>

			{'notifications' === current && (
				<>
					<div className="vuloform-subhead">
						<p>
							{vuloformAppLocalizer.has_vulomail
								? __('Who hears about a new submission. Sent through VuloMail.', 'vuloform')
								: __('Who hears about a new submission. Sent with your site\'s email.', 'vuloform')}
						</p>
						{settings.notifications.length < MAX_NOTIFICATIONS && (
							<ButtonInput
								buttons={[
									{ text: __('Add a confirmation to the visitor', 'vuloform'), icon: 'plus', color: 'purple', onClick: addConfirmation },
									{ text: __('Add notification', 'vuloform'), icon: 'plus', onClick: addNotification },
								]}
							/>
						)}
					</div>
					{0 === settings.notifications.length && (
						<div className="vuloform-empty">
							<i className="adminfont-notification" aria-hidden="true" />
							<strong>{__('Nobody is told when this form is submitted', 'vuloform')}</strong>
							<span>
								{settings.store_submissions
									? __('Submissions are still saved under VuloForm → Submissions. Add a notification to get an email as well.', 'vuloform')
									: __('Add a notification to get an email for each submission.', 'vuloform')}
							</span>
							{/* Every form starts with this one; it is one click to have it back. */}
							<ButtonInput
								buttons={{
									text: sprintf(
										/* translators: %s: the site's admin email address. */
										__('Email each submission to %s', 'vuloform'),
										vuloformAppLocalizer.admin_email
									),
									icon: 'mail',
									color: 'purple',
									onClick: () => {
										const added = newNotification({ name: __('Admin notification', 'vuloform'), to: vuloformAppLocalizer.admin_email });

										set({ notifications: [added] });
										setOpenItem('none');
									},
								}}
							/>
						</div>
					)}
					{settings.notifications.map((item, index) => {
						const isSms = 'sms' === item.channel;
						const isBoth = 'both' === item.channel;

						return (
							<Item
								key={item.id}
								icon={isSms ? 'send' : 'mail'}
								name={item.name}
								fallbackName={__('Notification', 'vuloform')}
								onRename={(name) => setNotification(index, { name })}
								summary={
									'' === item.to.trim()
										? __('Not saved yet: enter who it goes to', 'vuloform')
										: isBoth
										? sprintf(
												/* translators: 1: email address, 2: phone number. */
												__('Email to %1$s and text message to %2$s', 'vuloform'),
												item.to,
												item.sms_to || '…'
										  )
										: isSms
										? sprintf(
												/* translators: %s: phone number or placeholder. */
												__('Text message to %s', 'vuloform'),
												item.to || '…'
										  )
										: sprintf(
												/* translators: %s: email address or placeholder. */
												__('Email to %s', 'vuloform'),
												item.to || '…'
										  )
								}
								enabled={item.enabled}
								isOpen={isOpen(item.id, settings.notifications.length)}
								onToggleOpen={() => toggleOpen(item.id, settings.notifications.length)}
								onEnabled={(enabled) => setNotification(index, { enabled })}
								onRemove={() => set({ notifications: settings.notifications.filter((_, i) => i !== index) })}
							>
								<Section icon="setting" title={__('Delivery', 'vuloform')} desc={__('How this notification reaches people.', 'vuloform')}>
									<Row label={__('Send as', 'vuloform')}>
										<Segmented
											label={__('Send as', 'vuloform')}
											value={item.channel}
											options={[
												{ value: 'email', label: __('Email', 'vuloform') },
												{ value: 'sms', label: __('Text message', 'vuloform') },
												{ value: 'both', label: __('Both', 'vuloform') },
											]}
											onChange={(channel) => {
												const next = channel as Notification['channel'];
												// "To" holds an address for an email and a number for a text message; what
												// was typed for one makes no sense for the other.
												const crosses = ('sms' === next) !== isSms;

												setNotification(index, { channel: next, ...(crosses ? { to: '' } : {}) });
											}}
										/>
									</Row>
								</Section>

								{!isSms && (
									<Section icon="mail" title={__('Email', 'vuloform')} desc={__('Who gets the email and what it says.', 'vuloform')}>
										<Row
											label={__('To', 'vuloform')}
											desc={__('Several addresses: separate with commas. The person who filled in the form: your email field\'s placeholder, such as {email}.', 'vuloform')}
										>
											<TextInput
												name={`n-to-${index}`}
												value={item.to}
												placeholder={vuloformAppLocalizer.admin_email}
												onChange={(value) => setNotification(index, { to: String(value) })}
											/>
										</Row>
										<Row label={__('Subject', 'vuloform')}>
											<TextInput name={`n-subject-${index}`} value={item.subject} onChange={(value) => setNotification(index, { subject: String(value) })} />
										</Row>
										<Row label={__('Message', 'vuloform')} desc={answerTags((name) => setNotification(index, { message: withTag(item.message, name) }))}>
											<TextAreaInput
												name={`n-message-${index}`}
												rowNumber={5}
												usePlainText
												value={item.message}
												onChange={(value) => setNotification(index, { message: value })}
											/>
										</Row>
										{emailFields.length > 0 && (
											<Row label={__('Replies go to', 'vuloform')} desc={__('Choose your email field to answer the visitor by replying to the notification.', 'vuloform')}>
												{select(
													`n-reply-${index}`,
													item.reply_to || 'none',
													[
														{ value: 'none', label: __('Your site\'s address', 'vuloform') },
														...emailFields.map((field) => ({
															value: field.key,
															label: sprintf(
																/* translators: %s: field label. */
																__('The address in "%s"', 'vuloform'),
																field.label || field.key
															),
														})),
													],
													(reply_to) => setNotification(index, { reply_to: 'none' === reply_to ? '' : reply_to })
												)}
											</Row>
										)}
									</Section>
								)}

								{(isSms || isBoth) && (
									<Section icon="send" title={__('Text message', 'vuloform')} desc={__('Which number gets the text and what it says.', 'vuloform')}>
										{!vuloformAppLocalizer.sms_available && (
											<Wide>
												<p className="vuloform-note" role="note">
													{createInterpolateElement(
														vuloformAppLocalizer.has_vulomail
															? __('Text messages need an SMS connection in <a>VuloMail</a>.', 'vuloform')
															: __('Text messages need the <a>VuloMail</a> plugin with an SMS connection.', 'vuloform'),
														// The link's text is the part of the sentence between <a> and </a>.
														{ a: <a href={vuloformAppLocalizer.vulomail_url} /> }
													)}{' '}
													{isBoth
														? __('Until then only the email is sent.', 'vuloform')
														: __('Until then this notification is skipped.', 'vuloform')}
												</p>
											</Wide>
										)}
										{/* Alone, a text message uses the notification's own "to" and "message"; beside an email it has its own pair. */}
										<Row
											label={__('To this number', 'vuloform')}
											desc={__('International format, such as +14155550123. Several: separate with commas. A phone field: its placeholder, such as {phone}.', 'vuloform')}
										>
											<TextInput
												name={isBoth ? `n-sms-to-${index}` : `n-to-${index}`}
												value={isBoth ? item.sms_to ?? '' : item.to}
												placeholder="+14155550123"
												onChange={(value) => setNotification(index, isBoth ? { sms_to: String(value) } : { to: String(value) })}
											/>
										</Row>
										<Row
											label={__('Message', 'vuloform')}
											desc={answerTags((name) =>
												setNotification(index, isBoth ? { sms_message: withTag(item.sms_message ?? '', name) } : { message: withTag(item.message, name) })
											)}
										>
											<TextAreaInput
												name={isBoth ? `n-sms-message-${index}` : `n-message-${index}`}
												rowNumber={2}
												usePlainText
												value={isBoth ? item.sms_message ?? '' : item.message}
												onChange={(value) => setNotification(index, isBoth ? { sms_message: value } : { message: value })}
											/>
										</Row>
									</Section>
								)}

								{whenToSend(
									`n-when-${index}`,
									item.conditions,
									(conditions) => setNotification(index, { conditions }),
									__('Send this to different people depending on what was answered, for example sales questions to the sales team.', 'vuloform')
								)}
							</Item>
						);
					})}
				</>
			)}

			{'confirmation' === current && (
				<Sections>
					<Section
						icon="check"
						title={__('What visitors see', 'vuloform')}
						desc={__('Shown to everyone as soon as the form is sent, in place of the form.', 'vuloform')}
					>
						{afterSubmit('confirmation', settings.confirmation, (patch) => set({ confirmation: { ...settings.confirmation, ...patch } }))}
					</Section>
					<Section
						icon="filter"
						title={__('Exceptions', 'vuloform')}
						desc={__('Optional. Show something different to visitors who gave a certain answer. Everyone else sees the message above. When more than one exception matches, the first is used.', 'vuloform')}
					>
						<Wide>
							<div className="vuloform-exceptions">
								<div className="vuloform-exceptions-head">
									<span className="vuloform-control-desc">
										{sprintf(
											/* translators: 1: number of exceptions. 2: the most a form can have. */
											__('%1$d of %2$d', 'vuloform'),
											alternatives.length,
											MAX_CONFIRMATION_RULES
										)}
									</span>
									{alternatives.length < MAX_CONFIRMATION_RULES && (
										<ButtonInput
											buttons={{
												text: __('Add an exception', 'vuloform'),
												icon: 'plus',
												color: 'purple',
												onClick: () => {
													const id = makeId('c');

													setAlternatives([
														...alternatives,
														{
															id,
															type: 'message',
															message: '',
															redirect_url: '',
															// Starts with one rule, so it is clear what there is to fill in.
															conditions: { enabled: true, match: 'all', rules: ruleFields[0] ? [{ field: ruleFields[0].key, operator: 'is', value: '' }] : [] },
														},
													]);
													setOpenItem(id);
												},
											}}
										/>
									)}
								</div>
								{0 === alternatives.length && (
									<div className="vuloform-empty">
										<i className="adminfont-filter" aria-hidden="true" />
										<strong>{__('Everyone sees the same message', 'vuloform')}</strong>
										<span>{__('For example: people who chose "Sales" go to a booking page, and everyone else is thanked.', 'vuloform')}</span>
									</div>
								)}
								{alternatives.map((item, index) => {
									const isOpen = openItem === item.id;
									const title = sprintf(
										/* translators: %d: number of the exception. */
										__('Exception %d', 'vuloform'),
										index + 1
									);

									return (
										<div className={`vuloform-item${isOpen ? ' is-open' : ''}`} key={item.id}>
											<div className="vuloform-item-head">
												<button type="button" className="vuloform-item-toggle" aria-expanded={isOpen} aria-label={title} onClick={() => setOpenItem(isOpen ? '' : item.id)}>
													<i className="adminfont-filter" aria-hidden="true" />
												</button>
												<button type="button" className="vuloform-item-text vuloform-exception-text" onClick={() => setOpenItem(isOpen ? '' : item.id)}>
													<strong>{title}</strong>
													<span className="vuloform-item-summary">{exceptionSummary(item)}</span>
												</button>
												<button
													type="button"
													className="vuloform-icon-button is-danger"
													aria-label={sprintf(
														/* translators: %s: name of the exception, such as: Exception 1. */
														__('Remove %s', 'vuloform'),
														title
													)}
													onClick={() => setAlternatives(alternatives.filter((_, i) => i !== index))}
												>
													<i className="adminfont-delete" aria-hidden="true" />
												</button>
												<button type="button" className="vuloform-icon-button" aria-hidden="true" tabIndex={-1} onClick={() => setOpenItem(isOpen ? '' : item.id)}>
													<i className={`adminfont-keyboard-arrow-down${isOpen ? ' is-flipped' : ''}`} aria-hidden="true" />
												</button>
											</div>
											{isOpen && (
												<div className="vuloform-exception-body">
													<div className="vuloform-field">
														<span className="vuloform-control-label">{__('When the visitor\'s answer', 'vuloform')}</span>
														<When name={`c-when-${index}`} value={item.conditions} fields={fields} onChange={(conditions) => setAlternative(index, { conditions })} />
													</div>
													{afterSubmit(`c-${index}`, item, (patch) => setAlternative(index, patch), true)}
												</div>
											)}
										</div>
									);
								})}
							</div>
						</Wide>
					</Section>
					<Section icon="database" title={__('Keep a copy', 'vuloform')} desc={__('Whether what people send is also saved on this site.', 'vuloform')}>
						<Wide>
							<Switch
								name="store_submissions"
								label={__('Save submissions on this site', 'vuloform')}
								desc={__('On: read them any time under VuloForm → Submissions. Off: nothing is kept here, so they only reach your notifications and integrations.', 'vuloform')}
								checked={settings.store_submissions}
								onChange={(store_submissions) => set({ store_submissions })}
							/>
						</Wide>
					</Section>
				</Sections>
			)}

			{'appearance' === current && (
				<Sections>
					<Section icon="form" title={__('Design', 'vuloform')} desc={__('The form takes its fonts and colours from your theme. Change only what you want different.', 'vuloform')}>
						<Row label={__('Labels', 'vuloform')}>
							<Segmented
								label={__('Labels', 'vuloform')}
								value={style.label_position}
								options={[
									{ value: 'top', label: __('Above', 'vuloform') },
									{ value: 'left', label: __('Beside', 'vuloform') },
									{ value: 'hidden', label: __('Hidden', 'vuloform') },
								]}
								onChange={(value) => setStyle('label_position', value)}
							/>
						</Row>
						<Row label={__('Spacing', 'vuloform')}>
							<Segmented
								label={__('Spacing', 'vuloform')}
								value={style.spacing}
								options={[
									{ value: 'compact', label: __('Compact', 'vuloform') },
									{ value: 'normal', label: __('Normal', 'vuloform') },
									{ value: 'relaxed', label: __('Relaxed', 'vuloform') },
								]}
								onChange={(value) => setStyle('spacing', value)}
							/>
						</Row>
						<Row label={__('Accent colour', 'vuloform')} desc={__('Buttons, focus outlines and the step indicator.', 'vuloform')}>
							<Colour name="accent_color" value={style.accent_color} fallback="#2563eb" onChange={(value) => setStyle('accent_color', value)} />
						</Row>
						<Row label={__('Text colour', 'vuloform')}>
							<Colour name="text_color" value={style.text_color} fallback="#111827" onChange={(value) => setStyle('text_color', value)} />
						</Row>
						<Row label={__('Text size', 'vuloform')} desc={__('12 to 24. Empty follows your theme.', 'vuloform')}>
							<TextInput name="font_size" type="number" size={10} minNumber={12} maxNumber={24} postText="px" placeholder={__('Theme', 'vuloform')} value={style.font_size} onChange={(value) => setStyle('font_size', String(value))} />
						</Row>
						<Row label={__('Rounded corners', 'vuloform')} desc={__('0 is square. Empty follows your theme.', 'vuloform')}>
							<TextInput name="radius" type="number" size={10} minNumber={0} maxNumber={30} postText="px" placeholder={__('Theme', 'vuloform')} value={style.radius} onChange={(value) => setStyle('radius', String(value))} />
						</Row>
					</Section>
					<Section
						icon="edit"
						title={__('Buttons', 'vuloform')}
						desc={isMultiStep ? __('The form\'s buttons and its step indicator.', 'vuloform') : __('The form\'s button. Add a Page break field to split the form into steps.', 'vuloform')}
					>
						<Row label={__('Submit button', 'vuloform')}>
							<TextInput name="submit_label" value={settings.submit_label} onChange={(value) => set({ submit_label: String(value) })} />
						</Row>
						<Row label={__('Position', 'vuloform')}>
							<Segmented
								label={__('Button position', 'vuloform')}
								value={style.button_align}
								options={[
									{ value: 'left', label: __('Left', 'vuloform') },
									{ value: 'center', label: __('Centre', 'vuloform') },
									{ value: 'right', label: __('Right', 'vuloform') },
									{ value: 'full', label: __('Full width', 'vuloform') },
								]}
								onChange={(value) => setStyle('button_align', value)}
							/>
						</Row>
						{isMultiStep && (
							<>
								<Row label={__('Next button', 'vuloform')}>
									<TextInput name="next_label" value={settings.next_label} onChange={(value) => set({ next_label: String(value) })} />
								</Row>
								<Row label={__('Back button', 'vuloform')}>
									<TextInput name="previous_label" value={settings.previous_label} onChange={(value) => set({ previous_label: String(value) })} />
								</Row>
								<Row label={__('Step indicator', 'vuloform')}>
									<Segmented
										label={__('Step indicator', 'vuloform')}
										value={settings.progress}
										options={[
											{ value: 'steps', label: __('Steps', 'vuloform') },
											{ value: 'bar', label: __('Progress bar', 'vuloform') },
											{ value: 'none', label: __('None', 'vuloform') },
										]}
										onChange={(progress) => set({ progress })}
									/>
								</Row>
							</>
						)}
					</Section>
					<Section icon="notification" title={__('Error messages', 'vuloform')} desc={__('What visitors read when something needs correcting.', 'vuloform')}>
						<Row label={__('A required field is empty', 'vuloform')}>
							<TextInput name="msg-required" value={settings.messages.required} onChange={(value) => set({ messages: { ...settings.messages, required: String(value) } })} />
						</Row>
						<Row label={__('An answer is not valid', 'vuloform')}>
							<TextInput name="msg-invalid" value={settings.messages.invalid} onChange={(value) => set({ messages: { ...settings.messages, invalid: String(value) } })} />
						</Row>
						<Row label={__('Above the form', 'vuloform')} desc={__('Shown when the form could not be sent.', 'vuloform')}>
							<TextInput name="msg-error" value={settings.messages.error} onChange={(value) => set({ messages: { ...settings.messages, error: String(value) } })} />
						</Row>
					</Section>
					<Section icon="setting" title={__('For developers', 'vuloform')} desc={__('Hooks for your own stylesheet.', 'vuloform')}>
						<Row label={__('CSS class', 'vuloform')} desc={__('Added to the form\'s wrapper.', 'vuloform')}>
							<TextInput name="form_css_class" value={style.css_class} onChange={(value) => setStyle('css_class', String(value))} />
						</Row>
					</Section>
				</Sections>
			)}

						{'webhooks' === current && (
				<>
					<div className="vuloform-subhead">
						<p>
							{__(
								'Pass each submission on to the other services you use. It is sent in the background, so visitors never wait, and a failed delivery is tried twice more.',
								'vuloform'
							)}
						</p>
						{connectors.length > 0 && (
							<ButtonInput
								buttons={{
									text: choosing ? __('Cancel', 'vuloform') : __('Add integration', 'vuloform'),
									icon: choosing ? undefined : 'plus',
									color: choosing ? 'purple' : undefined,
									// With one kind of integration there is nothing to choose between.
									onClick: () => (1 === connectors.length && !choosing ? connectors[0].add() : setChoosing(!choosing)),
								}}
							/>
						)}
					</div>
					{choosing && (
						<div className="vuloform-templates vuloform-connectors" role="group" aria-label={__('Choose what to connect', 'vuloform')}>
							{connectors.map((connector) => (
								<button
									type="button"
									key={connector.id}
									className="vuloform-template"
									onClick={() => {
										connector.add();
										setChoosing(false);
									}}
								>
									<i className={`adminfont-${connector.icon}`} aria-hidden="true" />
									<strong>{connector.label}</strong>
									<span>{connector.desc}</span>
								</button>
							))}
						</div>
					)}
					{0 === integrationCount && !choosing && (
						<div className="vuloform-empty">
							<i className="adminfont-link" aria-hidden="true" />
							<strong>{__('Nothing is connected to this form', 'vuloform')}</strong>
							<span>{__('Most forms do not need this. Add an integration when submissions should also reach another service.', 'vuloform')}</span>
						</div>
					)}
					{integrations.map((item) => (
						<item.Component
							key={item.id}
							ui={kit}
							value={settings.extensions?.[item.id] ?? {}}
							onChange={(value) => set({ extensions: { ...(settings.extensions ?? {}), [item.id]: value } })}
							settings={settings}
							fields={fields}
						/>
					))}
					{settings.webhooks.map((item, index) => (
						<Item
							key={item.id}
							icon="link"
							name={item.name}
							fallbackName={__('Custom connector', 'vuloform')}
							onRename={(name) => setWebhook(index, { name })}
							summary={
								item.url
									? sprintf(
											/* translators: %s: web address. */
											__('Webhook to %s', 'vuloform'),
											item.url
									  )
									: __('Not saved yet: enter the address to send to', 'vuloform')
							}
							enabled={item.enabled}
							isOpen={isOpen(item.id, settings.webhooks.length)}
							onToggleOpen={() => toggleOpen(item.id, settings.webhooks.length)}
							onEnabled={(enabled) => setWebhook(index, { enabled })}
							onRemove={() => set({ webhooks: settings.webhooks.filter((_, i) => i !== index) })}
						>
							<Section icon="link" title={__('Destination', 'vuloform')} desc={__('Where each submission is sent.', 'vuloform')}>
								<Row label={__('Address', 'vuloform')} desc={__('Given to you by the other service. It must start with https://.', 'vuloform')}>
									<TextInput name={`w-url-${index}`} value={item.url} placeholder="https://" onChange={(value) => setWebhook(index, { url: String(value) })} />
								</Row>
								<Row
									label={__('Signing secret', 'vuloform')}
									desc={__('Optional. With a secret, each request carries an X-VuloForm-Signature header the other service can use to check it came from this site.', 'vuloform')}
								>
									<TextInput name={`w-secret-${index}`} type="password" value={item.secret} onChange={(value) => setWebhook(index, { secret: String(value) })} />
								</Row>
							</Section>
							<Section icon="form" title={__('What to send', 'vuloform')} desc={__('All of the form\'s answers, or only some.', 'vuloform')}>
								<Row label={__('Fields to send', 'vuloform')} desc={__('Tick none to send every field.', 'vuloform')}>
									<div className="vuloform-checks">
										{inputs.map((field) => (
											<label key={field.id}>
												<input
													type="checkbox"
													checked={item.fields.includes(field.key)}
													onChange={(event) =>
														setWebhook(index, {
															fields: event.target.checked ? [...item.fields, field.key] : item.fields.filter((key) => key !== field.key),
														})
													}
												/>{' '}
												{field.label || field.key}
											</label>
										))}
									</div>
								</Row>
							</Section>
							{whenToSend(
								`w-when-${index}`,
								item.conditions,
								(conditions) => setWebhook(index, { conditions }),
								__('Pass on only the submissions the other service should get.', 'vuloform')
							)}
						</Item>
					))}
				</>
			)}

{extension && (
				<Sections>
					<extension.Component
						ui={kit}
						value={settings.extensions?.[extension.id] ?? {}}
						onChange={(value) => set({ extensions: { ...(settings.extensions ?? {}), [extension.id]: value } })}
						settings={settings}
						fields={fields}
					/>
				</Sections>
			)}
		</div>
	);
};

export default FormSettings;
