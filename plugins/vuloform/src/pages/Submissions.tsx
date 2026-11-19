/* global vuloformAppLocalizer */
import { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { __, _n, sprintf } from '@wordpress/i18n';
import { getApiLink } from '@zyra/core';
import {
	BadgeComponent,
	ColumnComponent,
	ContainerComponent,
	NavigatorHeaderComponent,
	NoticeComponent,
	PopupComponent,
} from '@zyra/components';
import { ButtonInput } from '@zyra/inputs';
import { TableCard } from '../components/TableCard/TableCard';
import { Card, EmptyState, Pill, SamplePreview } from '../components/ui';
import { goToTab } from '../services/types';
import { apiDelete, apiGet, apiPost } from '../services/api';
import { errorMessage, notify } from '../services/notify';

interface Row {
	id: number;
	status: 'unread' | 'read' | 'spam';
	created_at_display: string;
	preview: { label: string; text: string }[];
	// Only set when "All forms" is selected, since every row can be a different form there.
	form_title?: string;
	[key: string]: unknown;
}

interface FormSummary {
	id: number;
	title: string;
	status?: string;
	submissions?: number;
}

interface List {
	data: Row[];
	total: number;
	status_counts: { unread: number; read: number; spam: number };
}

interface Detail {
	id: number;
	status: Row['status'];
	created_at_display: string;
	page_url: string;
	ip: string;
	// `label`, `status_label` and `color` let an extension describe an event type the core does not know.
	events: {
		type: string;
		name: string;
		status: string;
		detail: string;
		label?: string;
		status_label?: string;
		color?: string;
	}[];
	fields: {
		key: string;
		label: string;
		type: string;
		text: string;
		files: { name: string; size: string; index: number }[];
	}[];
}

interface TableQuery {
	paged?: number | string;
	per_page?: number | string;
	searchValue?: string;
	categoryFilter?: string;
	filter?: {
		date?: { startDate?: Date | string; endDate?: Date | string };
		form?: string;
	};
}

/** Made-up submissions for the empty list's preview (SamplePreview). */
const SAMPLE_ROWS: Row[] = [
	{
		id: 128,
		status: 'unread',
		created_at_display: __('Today, 9:41 am', 'vuloform'),
		form_title: __('Contact us', 'vuloform'),
		preview: [
			{ label: '', text: 'Priya Raman' },
			{ label: __('Email', 'vuloform'), text: 'priya@example.com' },
			{
				label: __('Message', 'vuloform'),
				text: __('Do you deliver on weekends?', 'vuloform'),
			},
		],
	},
	{
		id: 127,
		status: 'unread',
		created_at_display: __('Today, 8:02 am', 'vuloform'),
		form_title: __('Request a quote', 'vuloform'),
		preview: [
			{ label: '', text: 'Tom Becker' },
			{ label: __('Company', 'vuloform'), text: 'Becker & Sons' },
			{ label: __('Budget', 'vuloform'), text: '$5,000' },
		],
	},
	{
		id: 126,
		status: 'read',
		created_at_display: __('Yesterday, 4:15 pm', 'vuloform'),
		form_title: __('Event booking', 'vuloform'),
		preview: [
			{ label: '', text: 'Aiko Tanaka' },
			{ label: __('Guests', 'vuloform'), text: '4' },
			{ label: __('Date', 'vuloform'), text: __('Dec 12', 'vuloform') },
		],
	},
	{
		id: 125,
		status: 'read',
		created_at_display: __('Yesterday, 11:30 am', 'vuloform'),
		form_title: __('Contact us', 'vuloform'),
		preview: [
			{ label: '', text: 'Marcus Lee' },
			{ label: __('Email', 'vuloform'), text: 'marcus@example.com' },
		],
	},
	{
		id: 124,
		status: 'spam',
		created_at_display: __('Nov 17, 3:55 am', 'vuloform'),
		form_title: __('Contact us', 'vuloform'),
		preview: [{ label: '', text: 'best-deals-online' }],
	},
];

// The icon the builder shows for each kind of field.
const FIELD_ICONS: Record<string, string> = {
	text: 'form-textbox',
	textarea: 'form-textarea',
	email: 'form-email',
	phone: 'form-phone',
	number: 'arrow-down-up',
	url: 'form-url',
	select: 'form-dropdown',
	radio: 'form-radio',
	checkboxes: 'form-checkboxes',
	consent: 'check',
	date: 'calendar',
	time: 'clock',
	file: 'form-attachment',
	name: 'profile',
	address: 'form-address',
	hidden: 'eye-blocked',
	calculation: 'commission',
	signature: 'edit',
};

/** One answer, shown the way its kind deserves: an address you can click, a yes or no, or plain text. */
const answer = (type: string, text: string) => {
	const value = text.trim();

	if ('' === value) {
		return (
			<span className="vuloform-answer-none">
				{__('Not answered', 'vuloform')}
			</span>
		);
	}

	if ('email' === type && /^[^\s@]+@[^\s@]+$/.test(value)) {
		return <a href={`mailto:${value}`}>{value}</a>;
	}

	if ('phone' === type) {
		return <a href={`tel:${value.replace(/[^\d+]/g, '')}`}>{value}</a>;
	}

	if ('url' === type && /^https?:\/\//i.test(value)) {
		return (
			<a href={value} target="_blank" rel="noreferrer noopener">
				{value}
			</a>
		);
	}

	if ('consent' === type) {
		return <BadgeComponent color="green" text={value} />;
	}

	return value;
};

const EVENT_COLORS: Record<string, string> = {
	handed_off: 'green',
	delivered: 'green',
	failed: 'red',
	retry: 'yellow',
	skipped: 'yellow',
};

const EVENT_LABELS: Record<string, string> = {
	handed_off: __('Handed off', 'vuloform'),
	delivered: __('Delivered', 'vuloform'),
	failed: __('Failed', 'vuloform'),
	retry: __('Will retry', 'vuloform'),
	skipped: __('Skipped', 'vuloform'),
};

const EVENT_TYPES: Record<string, string> = {
	email: __('Email', 'vuloform'),
	sms: __('SMS', 'vuloform'),
	webhook: __('Webhook', 'vuloform'),
};

const pickedDay = (value: Date | string | undefined): string | undefined => {
	const date = value ? new Date(value) : null;

	if (!date || Number.isNaN(date.getTime())) {
		return undefined;
	}

	const pad = (part: number) => String(part).padStart(2, '0');

	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

/** Fetches a private file or export with the admin's nonce and hands it to the browser as a download. */
const download = (
	endpoint: string,
	params: Record<string, string | number | undefined>,
	fallbackName: string
) => {
	const base = getApiLink(vuloformAppLocalizer, endpoint);
	const query = Object.entries(params)
		.filter(([, value]) => value !== undefined && value !== '')
		.map(([key, value]) => `${key}=${encodeURIComponent(String(value))}`)
		.join('&');

	fetch(base + (query ? (base.includes('?') ? '&' : '?') + query : ''), {
		headers: { 'X-WP-Nonce': vuloformAppLocalizer.nonce },
	})
		.then((response) => {
			if (!response.ok) {
				throw new Error(__('The download failed.', 'vuloform'));
			}

			const name =
				/filename="([^"]+)"/.exec(
					response.headers.get('Content-Disposition') ?? ''
				)?.[1] ?? fallbackName;

			return response.blob().then((blob) => ({ blob, name }));
		})
		.then(({ blob, name }) => {
			const link = document.createElement('a');

			link.href = URL.createObjectURL(blob);
			link.download = name;
			link.click();
			URL.revokeObjectURL(link.href);
		})
		.catch((e) => notify('error', errorMessage(e)));
};

/**
 * Submissions: pick a form, then search, filter, read, mark, export and delete what people sent.
 */
const Submissions = () => {
	const linkedForm =
		Number(new URLSearchParams(useLocation().hash).get('form')) || 0;
	const [forms, setForms] = useState<FormSummary[] | null>(null);
	// Like VuloCart's lists: statuses are the tabs, and the form is picked in the Filter row (a link can preset it).
	const startFilters = linkedForm ? { form: String(linkedForm) } : {};
	const [query, setQuery] = useState<TableQuery>({
		paged: 1,
		per_page: 10,
		filter: startFilters,
	});
	const formId =
		query.filter?.form && 'all' !== query.filter.form
			? Number(query.filter.form)
			: 0;
	// "All" is every status, spam included.
	const status =
		query.categoryFilter && 'all' !== query.categoryFilter
			? query.categoryFilter
			: '';
	const [list, setList] = useState<List>({
		data: [],
		total: 0,
		status_counts: { unread: 0, read: 0, spam: 0 },
	});
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState('');
	const [reload, setReload] = useState(0);
	const [detail, setDetail] = useState<Detail | null>(null);
	// Submissions waiting for the delete confirmation: one, or a bulk selection.
	const [toDelete, setToDelete] = useState<number[] | null>(null);

	const onQueryUpdate = useCallback((next: TableQuery) => setQuery(next), []);

	useEffect(() => {
		apiGet<{ data: FormSummary[] }>('forms', { per_page: 100 })
			.then((result) => setForms(result.data))
			.catch((e) => setError(errorMessage(e)));
	}, []);

	const filters = {
		form_id: formId,
		status,
		search: query.searchValue || undefined,
		after: pickedDay(query.filter?.date?.startDate),
		before: pickedDay(query.filter?.date?.endDate),
	};

	useEffect(() => {
		// formId 0 is "All forms", a real, fetchable state — only wait for the forms list itself.
		if (!forms) {
			return undefined;
		}

		let cancelled = false;

		setIsLoading(true);

		apiGet<List>('submissions', {
			...filters,
			page: query.paged,
			per_page: query.per_page,
		})
			.then((data) => {
				if (!cancelled) {
					setList(data);
					setError('');
				}
			})
			.catch((e) => !cancelled && setError(errorMessage(e)))
			.finally(() => !cancelled && setIsLoading(false));

		return () => {
			cancelled = true;
		};
	}, [forms, formId, query, reload]);

	const refresh = () => setReload((n) => n + 1);

	const openDetail = (id: number) => {
		apiGet<Detail>(`submissions/${id}`)
			.then((data) => {
				setDetail(data);
				// Opening a submission marks it read; the list should show that.
				refresh();
			})
			.catch((e) => notify('error', errorMessage(e)));
	};

	const setStatus = (ids: number[], next: Row['status']) =>
		apiPost('submissions/status', { ids, status: next })
			.then(() => {
				if (ids.length > 1) {
					notify(
						'success',
						sprintf(
							/* translators: %d: number of submissions. */
							_n(
								'%d submission updated.',
								'%d submissions updated.',
								ids.length,
								'vuloform'
							),
							ids.length
						)
					);
				}
				if (detail && ids.includes(detail.id)) {
					setDetail(null);
				}
				refresh();
			})
			.catch((e) => notify('error', errorMessage(e)));

	const remove = () => {
		if (!toDelete) {
			return;
		}

		apiDelete('submissions', { ids: toDelete })
			.then(() => {
				notify(
					'success',
					sprintf(
						/* translators: %d: number of deleted submissions. */
						_n(
							'%d submission deleted.',
							'%d submissions deleted.',
							toDelete.length,
							'vuloform'
						),
						toDelete.length
					)
				);
				if (detail && toDelete.includes(detail.id)) {
					setDetail(null);
				}
				refresh();
			})
			.catch((e) => notify('error', errorMessage(e)))
			.finally(() => setToDelete(null));
	};

	const counts = list.status_counts;
	const isEmpty =
		null !== forms &&
		!isLoading &&
		0 === forms.reduce((sum, form) => sum + (form.submissions ?? 0), 0) &&
		0 === counts.spam;
	const hasLiveForm = (forms ?? []).some(
		(form) => 'published' === form.status
	);

	// The list's columns, shared with its sample preview so both draw a row the same way.
	const columns = {
		preview: {
			label: __('Submission', 'vuloform'),
			flex: '3 0 0',
			render: (row: Row) => {
				const [first, ...rest] = row.preview;
				const isNew = 'unread' === row.status;

				return (
					<button
						type="button"
						className={`vuloform-sub${isNew ? ' is-new' : ''}`}
						onClick={() => openDetail(row.id)}
					>
						<span
							className="vuloform-sub-avatar"
							aria-hidden="true"
						>
							{first
								? first.text.trim().charAt(0).toUpperCase()
								: '?'}
						</span>
						<span className="vuloform-sub-text">
							<span className="vuloform-sub-title">
								{first ? first.text : __('(empty)', 'vuloform')}
								{isNew && (
									<span
										className="vuloform-sub-dot"
										aria-hidden="true"
									/>
								)}
							</span>
							{rest.length > 0 && (
								<span className="vuloform-sub-line">
									{rest.map((item) => (
										<span key={item.label}>
											<em>{item.label}</em> {item.text}
										</span>
									))}
								</span>
							)}
							<span className="vuloform-sub-meta">
								{0 === formId && row.form_title
									? `${row.form_title} · `
									: ''}
								#{row.id}
							</span>
						</span>
					</button>
				);
			},
		},
		created_at_display: {
			label: __('Received', 'vuloform'),
			flex: '1.3 0 0',
			// When it came in, with its status under it: one column instead of two.
			render: (row: Row) => (
				<div className="vf-list-when">
					<span className="vf-list-date">
						{row.created_at_display}
					</span>
					{'spam' === row.status ? (
						<Pill status="bad">{__('Spam', 'vuloform')}</Pill>
					) : 'unread' === row.status ? (
						<Pill status="info">{__('New', 'vuloform')}</Pill>
					) : (
						<Pill status="off">{__('Read', 'vuloform')}</Pill>
					)}
				</div>
			),
		},
		id: {
			label: __('Actions', 'vuloform'),
			flex: '0 0 9rem',
			type: 'action',
			actions: [
				{
					label: __('View', 'vuloform'),
					icon: 'eye',
					onClick: (row: Record<string, unknown>) =>
						openDetail(Number(row.id)),
				},
				{
					label: (row: Record<string, unknown>) =>
						'unread' === row.status
							? __('Mark as read', 'vuloform')
							: __('Mark as new', 'vuloform'),
					icon: (row: Record<string, unknown>) =>
						'unread' === row.status ? 'check' : 'unread',
					hidden: (row: Record<string, unknown>) =>
						'spam' === row.status,
					onClick: (row: Record<string, unknown>) =>
						setStatus(
							[Number(row.id)],
							'unread' === row.status ? 'read' : 'unread'
						),
				},
				{
					label: (row: Record<string, unknown>) =>
						'spam' === row.status
							? __('Not spam', 'vuloform')
							: __('Mark as spam', 'vuloform'),
					icon: (row: Record<string, unknown>) =>
						'spam' === row.status ? 'undo' : 'ban-spam-mail',
					onClick: (row: Record<string, unknown>) =>
						setStatus(
							[Number(row.id)],
							'spam' === row.status ? 'read' : 'spam'
						),
				},
				{
					label: __('Delete', 'vuloform'),
					icon: 'delete',
					onClick: (row: Record<string, unknown>) =>
						setToDelete([Number(row.id)]),
				},
			],
		},
	};

	const total = counts.unread + counts.read + counts.spam;
	const statusTabs = [
		{ value: 'all', label: __('All', 'vuloform'), count: total },
		{ value: 'unread', label: __('New', 'vuloform'), count: counts.unread },
		{ value: 'read', label: __('Read', 'vuloform'), count: counts.read },
		{ value: 'spam', label: __('Spam', 'vuloform'), count: counts.spam },
	];

	return (
		<>
			<NavigatorHeaderComponent
				headerIcon="mail"
				headerTitle={__('Submissions', 'vuloform')}
				headerDescription={__(
					'What people have sent through your forms. Only administrators can see this.',
					'vuloform'
				)}
				headerCustomContent={
					forms && forms.length > 0 ? (
						<div className="vuloform-inline">
							<ButtonInput
								buttons={{
									text: __('Export CSV', 'vuloform'),
									icon: 'export',
									color: 'purple',
									disabled: 0 === list.total,
									tooltip:
										0 === list.total
											? __(
													'There is nothing to export.',
													'vuloform'
												)
											: undefined,
									onClick: () =>
										download(
											'submissions/export',
											filters,
											'submissions.csv'
										),
								}}
							/>
						</div>
					) : undefined
				}
			/>
			<ContainerComponent general>
				<ColumnComponent>
					<div className="vf-page">
						{error && (
							<Card>
								<EmptyState
									icon="error"
									tone="red"
									title={__(
										'Could not load submissions',
										'vuloform'
									)}
									text={error}
								/>
							</Card>
						)}
						{!error && forms && isEmpty && (
							<SamplePreview
								icon={0 === forms.length ? 'form' : 'mail'}
								title={
									0 === forms.length
										? __('No forms yet', 'vuloform')
										: hasLiveForm
											? __(
													'No submissions yet',
													'vuloform'
												)
											: __(
													'Publish a form to start collecting',
													'vuloform'
												)
								}
								text={
									0 === forms.length
										? __(
												'Create a form and add it to a page. What people send you shows up here, like this.',
												'vuloform'
											)
										: hasLiveForm
											? __(
													'Add a published form to a page with its block or shortcode. What people send shows up here, like this.',
													'vuloform'
												)
											: __(
													'Your forms are drafts, so nobody can fill them in yet. Publish one and add it to a page.',
													'vuloform'
												)
								}
								action={
									<ButtonInput
										buttons={
											0 === forms.length
												? {
														text: __(
															'Create a form',
															'vuloform'
														),
														icon: 'plus',
														color: 'purple-bg',
														onClick: () =>
															goToTab(
																'forms&new=1'
															),
													}
												: {
														text: __(
															'Go to forms',
															'vuloform'
														),
														icon: 'form',
														color: 'purple-bg',
														onClick: () =>
															goToTab('forms'),
													}
										}
									/>
								}
								note={__(
									'A preview with sample data. Real submissions show here as they arrive.',
									'vuloform'
								)}
							>
								<TableCard
									search={{
										placeholder: __(
											'Search submissions…',
											'vuloform'
										),
									}}
									showMenu={false}
									headers={columns}
									rows={SAMPLE_ROWS}
									ids={SAMPLE_ROWS.map((row) => row.id)}
									totalRows={SAMPLE_ROWS.length}
									activeCategory="all"
									categoryCounts={[
										{
											value: 'all',
											label: __('All', 'vuloform'),
											count: 5,
										},
										{
											value: 'unread',
											label: __('New', 'vuloform'),
											count: 2,
										},
										{
											value: 'read',
											label: __('Read', 'vuloform'),
											count: 2,
										},
										{
											value: 'spam',
											label: __('Spam', 'vuloform'),
											count: 1,
										},
									]}
									isLoading={false}
								/>
							</SamplePreview>
						)}
						{!error && forms && !isEmpty && (
							<TableCard
								search={{
									placeholder: __(
										'Search submissions…',
										'vuloform'
									),
								}}
								showMenu={false}
								filters={[
									{
										key: 'form',
										type: 'select',
										label: __('Form', 'vuloform'),
										size: 12,
										options: [
											{
												value: 'all',
												label: __(
													'All forms',
													'vuloform'
												),
											},
											...forms.map((form) => ({
												value: String(form.id),
												label: sprintf(
													/* translators: 1: form title, 2: number of submissions. */
													__(
														'%1$s (%2$d)',
														'vuloform'
													),
													form.title,
													form.submissions ?? 0
												),
											})),
										],
									},
									{
										key: 'date',
										type: 'date',
										label: __('Date range', 'vuloform'),
									},
								]}
								defaultFilters={startFilters}
								format={vuloformAppLocalizer.date_format_js}
								headers={columns}
								rows={list.data}
								ids={list.data.map((row) => row.id)}
								totalRows={list.total}
								activeCategory="all"
								categoryCounts={statusTabs}
								bulkActions={[
									{
										label: __('Mark as read', 'vuloform'),
										value: 'read',
									},
									{
										label: __('Mark as new', 'vuloform'),
										value: 'unread',
									},
									{
										label: __('Mark as spam', 'vuloform'),
										value: 'spam',
									},
									{
										label: __('Delete', 'vuloform'),
										value: 'delete',
									},
								]}
								onBulkActionApply={(
									action: string,
									ids: Array<number | string>
								) => {
									const picked = ids.map(Number);

									if (!picked.length) {
										return;
									}

									if ('delete' === action) {
										setToDelete(picked);
									} else if (
										'read' === action ||
										'unread' === action ||
										'spam' === action
									) {
										setStatus(picked, action);
									}
								}}
								isLoading={isLoading}
								onQueryUpdate={onQueryUpdate}
								emptyMessage={__(
									'No submissions match. Try another tab, filter or search.',
									'vuloform'
								)}
							/>
						)}
					</div>
				</ColumnComponent>
			</ContainerComponent>
			<PopupComponent
				open={Boolean(detail) && null === toDelete}
				onClose={() => setDetail(null)}
				width={44}
				height="auto"
				position="lightbox"
				header={{
					icon: 'mail',
					title: sprintf(
						/* translators: %d: submission number. */
						__('Submission #%d', 'vuloform'),
						detail?.id ?? 0
					),
					description: detail?.created_at_display,
				}}
			>
				{detail && (
					<div className="vuloform-popup-body">
						<div className="vuloform-answers">
							{detail.fields.map((field) => {
								const isEmpty =
									0 === field.files.length &&
									'' === field.text.trim();
								const isLong =
									[
										'textarea',
										'address',
										'checkboxes',
									].includes(field.type) ||
									field.text.length > 80 ||
									field.text.includes('\n');

								return (
									<div
										key={field.key}
										className={`vuloform-answer${isLong ? ' is-long' : ''}${isEmpty ? ' is-empty' : ''}`}
									>
										<span className="vuloform-answer-label">
											<i
												className={`adminfont-${FIELD_ICONS[field.type] ?? 'form-textbox'}`}
												aria-hidden="true"
											/>
											{field.label}
										</span>
										<span className="vuloform-answer-value">
											{field.files.length > 0 &&
												field.files.map((file) => (
													<button
														type="button"
														key={file.index}
														className="vuloform-answer-file"
														onClick={() =>
															download(
																`submissions/${detail.id}/file`,
																{
																	key: field.key,
																	index: file.index,
																},
																file.name
															)
														}
													>
														<i
															className="adminfont-export"
															aria-hidden="true"
														/>
														{file.name}
														<small>
															{file.size}
														</small>
													</button>
												))}
											{0 === field.files.length &&
												answer(field.type, field.text)}
										</span>
									</div>
								);
							})}
						</div>
						{(detail.page_url || detail.ip) && (
							<dl className="vuloform-answer-meta">
								{detail.page_url && (
									<div>
										<dt>{__('Sent from', 'vuloform')}</dt>
										<dd>
											<a
												href={detail.page_url}
												target="_blank"
												rel="noreferrer noopener"
											>
												{detail.page_url}
											</a>
										</dd>
									</div>
								)}
								{detail.ip && (
									<div>
										<dt>{__('IP address', 'vuloform')}</dt>
										<dd>{detail.ip}</dd>
									</div>
								)}
							</dl>
						)}
						{detail.events.map((event, index) => (
							<NoticeComponent
								key={index}
								displayPosition="inline-notice"
								type={
									'failed' === event.status ? 'error' : 'info'
								}
								message={`${event.label ?? EVENT_TYPES[event.type] ?? event.type} "${event.name}": ${event.detail}`}
							>
								<BadgeComponent
									color={
										event.color ??
										EVENT_COLORS[event.status] ??
										'blue'
									}
									text={
										event.status_label ??
										EVENT_LABELS[event.status] ??
										event.status
									}
								/>
							</NoticeComponent>
						))}
						<div className="vuloform-form-footer">
							<ButtonInput
								buttons={[
									{
										text: __('Delete', 'vuloform'),
										icon: 'delete',
										color: 'border-red',
										onClick: () => setToDelete([detail.id]),
									},
									'spam' === detail.status
										? {
												text: __(
													'Not spam',
													'vuloform'
												),
												icon: 'undo',
												color: 'purple',
												onClick: () =>
													setStatus(
														[detail.id],
														'read'
													),
											}
										: {
												text: __(
													'Mark as spam',
													'vuloform'
												),
												icon: 'ban-spam-mail',
												color: 'purple',
												onClick: () =>
													setStatus(
														[detail.id],
														'spam'
													),
											},
									...('spam' === detail.status
										? []
										: [
												{
													text: __(
														'Mark as new',
														'vuloform'
													),
													icon: 'unread',
													color: 'purple',
													onClick: () =>
														setStatus(
															[detail.id],
															'unread'
														),
												},
											]),
								]}
							/>
						</div>
					</div>
				)}
			</PopupComponent>
			<PopupComponent
				position="lightbox"
				open={null !== toDelete}
				onClose={() => setToDelete(null)}
				width={31.25}
				height="auto"
			>
				<div className="popup-confirm">
					<i className="popup-icon adminfont-suspended admin-badge zyra-red" />
					<div className="title">
						{sprintf(
							/* translators: %d: number of submissions. */
							_n(
								'Delete %d submission?',
								'Delete %d submissions?',
								toDelete?.length ?? 0,
								'vuloform'
							),
							toDelete?.length ?? 0
						)}
					</div>
					<div className="desc">
						{__(
							'Any files uploaded with them are deleted too. This cannot be undone.',
							'vuloform'
						)}
					</div>
					<ButtonInput
						position="center"
						buttons={[
							{
								icon: 'close',
								text: __('Cancel', 'vuloform'),
								color: 'red',
								onClick: () => setToDelete(null),
							},
							{
								icon: 'delete',
								text: __('Delete', 'vuloform'),
								onClick: remove,
							},
						]}
					/>
				</div>
			</PopupComponent>
		</>
	);
};

export default Submissions;
