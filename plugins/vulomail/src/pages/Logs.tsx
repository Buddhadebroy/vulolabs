/* global vulomailAppLocalizer */
import { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { __, _n, sprintf } from '@wordpress/i18n';
import {
	BadgeComponent,
	ContainerComponent,
	NavigatorHeaderComponent,
	NoticeComponent,
	PopupComponent,
} from '@zyra/components';
import { ButtonInput, ToggleInput } from '@zyra/inputs';
import { TableCard } from '../components/TableCard/TableCard';
import { apiDelete, apiGet, apiPost } from '../services/api';
import { errorMessage, notify } from '../services/notify';
import { displayDate, providerLabel, settingsUrl } from '../services/types';
import { errorNoticeHtml } from '../services/errorHelp';
import type { Attempt } from '../services/types';
import { Card, EmptyState } from '../components/ui';

interface LogRow {
	id: number;
	channel: 'email' | 'sms';
	status: 'sent' | 'failed';
	provider: string;
	used_fallback: string | number;
	recipients: string;
	subject: string;
	attachments: string | number;
	source: string;
	error_message: string | null;
	created_at: string;
	created_at_display?: string;
	opened: Engagement;
	clicked: Engagement;
	can_resend: boolean;
	[key: string]: unknown;
}

/** Whether an email was opened or clicked; 'not_tracked' when tracking didn't apply to it. */
type Engagement = 'yes' | 'no' | 'not_tracked';

interface TrackedLink {
	url: string;
	click_count: number;
	first_clicked_at: string;
	last_clicked_at: string;
}

interface Tracking {
	open_count: number;
	first_opened_at: string;
	last_opened_at: string;
	click_count: number;
	first_clicked_at: string;
	last_clicked_at: string;
	links: TrackedLink[];
}

interface LogDetail extends LogRow {
	body: string | null;
	has_body: boolean;
	can_resend: boolean;
	message_id: string;
	error_code: string;
	attempts: Attempt[];
	headers: Record<string, string>;
	tracking: Tracking;
}

interface LogList {
	data: LogRow[];
	total: number;
	status_counts: { sent: number; failed: number };
	channel_counts: { email: number; sms: number };
}

interface TableQuery {
	paged?: number | string;
	per_page?: number | string;
	searchValue?: string;
	categoryFilter?: string;
	languageFilter?: string;
	filter?: {
		date?: { startDate?: Date | string; endDate?: Date | string };
		channel?: string;
	};
	orderby?: string;
	order?: string;
}

/**
 * One end of the date-range filter as the calendar day that was picked (`YYYY-MM-DD`). The server
 * reads it in the site's timezone, so the range lines up with the dates the table shows.
 */
const pickedDay = (value: Date | string | undefined): string | undefined => {
	if (!value) {
		return undefined;
	}

	const date = new Date(value);

	if (Number.isNaN(date.getTime())) {
		return undefined;
	}

	const pad = (part: number) => String(part).padStart(2, '0');

	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

/** What the table is filtered and sorted by, as `logs` endpoint params: the same for the list and its CSV export. */
const filterParams = (query: TableQuery) => ({
	channel:
		query.filter?.channel && 'all' !== query.filter.channel
			? query.filter.channel
			: undefined,
	status:
		query.categoryFilter && 'all' !== query.categoryFilter
			? query.categoryFilter
			: undefined,
	search: query.searchValue || undefined,
	after: pickedDay(query.filter?.date?.startDate),
	before: pickedDay(query.filter?.date?.endDate),
	// Newest first until a column is sorted: what the "Sent" column's arrow promises.
	orderby: query.orderby || 'created_at',
	order: query.order || 'desc',
});

const statusBadge = (row: Pick<LogRow, 'status' | 'used_fallback'>) => {
	if ('failed' === row.status) {
		return <BadgeComponent color="red" text={__('Failed', 'vulomail')} />;
	}

	return Number(row.used_fallback) ? (
		<BadgeComponent
			color="yellow"
			text={__('Sent via backup', 'vulomail')}
		/>
	) : (
		<BadgeComponent color="green" text={__('Sent', 'vulomail')} />
	);
};

/** "First – last" for a pair of display dates, or a dash when nothing was observed. */
const observedRange = (first: string, last: string): string => {
	if (!first) {
		return '—';
	}

	return first === last ? first : `${first} – ${last}`;
};

/** Splits a `"Name" <address>` header into its parts; falls back to treating the whole value as both. */
const parseAddress = (value: string): { name: string; address: string } => {
	const match = value.match(/^"?([^"<]*)"?\s*<([^>]+)>$/);

	return match
		? { name: match[1].trim() || match[2], address: match[2] }
		: { name: value, address: value };
};

/** A logged message body, as text, with any http(s) links made clickable. Never rendered as HTML. */
const linkify = (text: string): ReactNode[] =>
	text.split(/(https?:\/\/[^\s<>"]+)/g).map((part, index) =>
		index % 2 ? (
			<a key={index} href={part} target="_blank" rel="noreferrer">
				{part}
			</a>
		) : (
			part
		)
	);

const Logs = () => {
	const [query, setQuery] = useState<TableQuery>({ paged: 1, per_page: 10 });
	const [list, setList] = useState<LogList>({
		data: [],
		total: 0,
		status_counts: { sent: 0, failed: 0 },
		channel_counts: { email: 0, sms: 0 },
	});
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState('');
	const [reload, setReload] = useState(0);
	const [detail, setDetail] = useState<LogDetail | null>(null);
	const [messageView, setMessageView] = useState<'preview' | 'raw'>(
		'preview'
	);
	const [isBusy, setIsBusy] = useState(false);

	const onQueryUpdate = useCallback((next: TableQuery) => setQuery(next), []);

	// A link such as `#&tab=logs&log=12` (the Dashboard's "More Details") opens that entry directly.
	const linkedLogId = new URLSearchParams(useLocation().hash).get('log');

	useEffect(() => {
		if (linkedLogId && /^\d+$/.test(linkedLogId)) {
			apiGet<LogDetail>(`logs/${linkedLogId}`)
				.then((row) => {
					setDetail(row);
					setMessageView('preview');
				})
				.catch((e) => notify('error', errorMessage(e)));
		}
	}, [linkedLogId]);

	useEffect(() => {
		let cancelled = false;

		setIsLoading(true);

		apiGet<LogList>('logs', {
			...filterParams(query),
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
	}, [query, reload]);

	const openDetail = (row: LogRow) => {
		apiGet<LogDetail>(`logs/${row.id}`)
			.then((detailRow) => {
				setDetail(detailRow);
				setMessageView('preview');
			})
			.catch((e) => notify('error', errorMessage(e)));
	};

	// Rows waiting for the delete confirmation: one entry, a bulk selection, or (`all`) the whole log.
	const [toDelete, setToDelete] = useState<number[] | 'all' | null>(null);

	const confirmDelete = () => {
		if (!toDelete) {
			return;
		}

		setIsBusy(true);

		apiDelete(
			'logs',
			'all' === toDelete ? { all: true } : { ids: toDelete }
		)
			.then(() => {
				notify(
					'success',
					'all' === toDelete
						? __('All log entries deleted.', 'vulomail')
						: sprintf(
								/* translators: %d: number of deleted log entries. */
								_n(
									'%d log entry deleted.',
									'%d log entries deleted.',
									toDelete.length,
									'vulomail'
								),
								toDelete.length
							)
				);
				if (
					detail &&
					('all' === toDelete || toDelete.includes(detail.id))
				) {
					setDetail(null);
				}
				setReload((n) => n + 1);
			})
			.catch((e) => notify('error', errorMessage(e)))
			.finally(() => {
				setIsBusy(false);
				setToDelete(null);
			});
	};

	const resend = (id: number) => {
		setIsBusy(true);

		apiPost<{ success: boolean; message: string }>(`logs/${id}/resend`)
			.then((result) => {
				notify(result.success ? 'success' : 'error', result.message);
				setDetail(null);
				setReload((n) => n + 1);
			})
			.catch((e) => notify('error', errorMessage(e)))
			.finally(() => setIsBusy(false));
	};

	// Export: every entry matching the tab, filters and search (up to 1,000), as a CSV file.
	// eslint-disable-next-line no-unused-vars -- a parameter name in a type signature, not a variable.
	const csvColumns: Record<string, (row: LogRow) => string | number> = {
		[__('Date', 'vulomail')]: (row) => displayDate(row),
		[__('Channel', 'vulomail')]: (row) =>
			'sms' === row.channel ? 'SMS' : __('Email', 'vulomail'),
		[__('Status', 'vulomail')]: (row) =>
			'failed' === row.status
				? __('Failed', 'vulomail')
				: Number(row.used_fallback)
					? __('Sent via backup', 'vulomail')
					: __('Sent', 'vulomail'),
		[__('To', 'vulomail')]: (row) => row.recipients,
		[__('Subject', 'vulomail')]: (row) => row.subject,
		[__('Sent with', 'vulomail')]: (row) => providerLabel(row.provider),
		[__('Sent by', 'vulomail')]: (row) => row.source,
		[__('Opened', 'vulomail')]: (row) => row.opened,
		[__('Clicked', 'vulomail')]: (row) => row.clicked,
		[__('Error', 'vulomail')]: (row) => row.error_message ?? '',
	};

	const downloadCsv = (rows: LogRow[]) => {
		if (!rows.length) {
			return;
		}

		const quote = (value: string | number) =>
			`"${String(value ?? '').replace(/"/g, '""')}"`;
		const lines = [
			Object.keys(csvColumns).map(quote).join(','),
			...rows.map((row) =>
				Object.values(csvColumns)
					.map((value) => quote(value(row)))
					.join(',')
			),
		];
		const url = URL.createObjectURL(
			new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
		);
		const link = document.createElement('a');

		link.href = url;
		link.download = `vulomail-logs-${new Date().toISOString().slice(0, 10)}.csv`;
		link.click();
		URL.revokeObjectURL(url);
	};

	const exportMatching = () =>
		apiGet<LogList>('logs', {
			...filterParams(query),
			page: 1,
			per_page: 1000,
		})
			.then((data) => downloadCsv(data.data))
			.catch((e) => notify('error', errorMessage(e)));

	const copyMessageId = () => {
		if (!detail?.message_id) {
			return;
		}

		navigator.clipboard
			?.writeText(detail.message_id)
			.then(() =>
				notify('success', __('Provider ID copied.', 'vulomail'))
			)
			.catch(() =>
				notify(
					'error',
					__(
						'Could not copy. Select the ID and copy it yourself.',
						'vulomail'
					)
				)
			);
	};

	const { sent, failed } = list.status_counts;
	const total = sent + failed;

	return (
		<>
			<NavigatorHeaderComponent
				headerIcon="clock"
				headerTitle={__('Logs', 'vulomail')}
				headerDescription={__(
					'Every email and text message this site has tried to send.',
					'vulomail'
				)}
				// Like VuloCart's lists: the page's own actions top-right. Nothing to export or delete until something is logged.
				headerCustomContent={
					total > 0 ? (
						<ButtonInput
							buttons={[
								{
									text: __('Delete all', 'vulomail'),
									icon: 'delete',
									color: 'red',
									onClick: () => setToDelete('all'),
								},
								{
									text: __('Export', 'vulomail'),
									icon: 'download',
									color: 'purple',
									onClick: exportMatching,
								},
							]}
						/>
					) : undefined
				}
			/>
			<ContainerComponent general>
				<div id="logs-delivery-log-card" className="vm-log-list">
					{error ? (
						<Card>
							<EmptyState
								icon="error"
								tone="red"
								title={__('Could not load the log', 'vulomail')}
								text={error}
							/>
						</Card>
					) : (
						<TableCard
							search={{
								placeholder: __(
									'Search recipient or subject…',
									'vulomail'
								),
							}}
							showMenu={false}
							filters={[
								{
									key: 'channel',
									type: 'select',
									label: __('Channel', 'vulomail'),
									size: 4,
									options: [
										{
											value: 'all',
											label: sprintf(
												/* translators: %d: number of entries. */ __(
													'All channels (%d)',
													'vulomail'
												),
												list.channel_counts.email +
													list.channel_counts.sms
											),
										},
										{
											value: 'email',
											label: sprintf(
												/* translators: %d: number of emails. */ __(
													'Email (%d)',
													'vulomail'
												),
												list.channel_counts.email
											),
										},
										{
											value: 'sms',
											label: sprintf(
												/* translators: %d: number of text messages. */ __(
													'SMS (%d)',
													'vulomail'
												),
												list.channel_counts.sms
											),
										},
									],
								},
								{
									key: 'date',
									type: 'date',
									label: __('Date range', 'vulomail'),
								},
							]}
							format={vulomailAppLocalizer.date_format_js}
							headers={{
								subject: {
									label: __('Message', 'vulomail'),
									flex: '2.6 0 0',
									render: (row: LogRow) => (
										<div className="vm-log-message">
											<span
												className={`vm-log-icon is-${row.channel}`}
												aria-hidden="true"
											>
												<i
													className={`adminfont-${'sms' === row.channel ? 'send' : 'mail'}`}
												/>
											</span>
											<div className="vulomail-log-cell">
												<button
													type="button"
													className="vm-log-title"
													onClick={() =>
														openDetail(row)
													}
												>
													{'sms' === row.channel
														? __(
																'Text message',
																'vulomail'
															)
														: row.subject ||
															__(
																'(no subject)',
																'vulomail'
															)}
												</button>
												<span className="vulomail-log-secondary">
													{sprintf(
														/* translators: %s: recipient addresses or numbers. */
														__('To %s', 'vulomail'),
														row.recipients
													)}
												</span>
												{'failed' === row.status &&
													row.error_message && (
														<span className="vm-log-error">
															{row.error_message}
														</span>
													)}
											</div>
										</div>
									),
								},
								status: {
									label: __('Status', 'vulomail'),
									flex: '1.4 0 0',
									render: (row: LogRow) => (
										<div className="vm-log-tags">
											{statusBadge(row)}
											{'yes' === row.opened && (
												<BadgeComponent
													color="blue"
													text={__(
														'Opened',
														'vulomail'
													)}
												/>
											)}
											{'yes' === row.clicked && (
												<BadgeComponent
													color="purple"
													text={__(
														'Clicked',
														'vulomail'
													)}
												/>
											)}
										</div>
									),
								},
								source: {
									label: __('Sent with', 'vulomail'),
									flex: '1 0 0',
									render: (row: LogRow) => (
										<div className="vulomail-log-cell">
											<span className="vulomail-log-primary">
												{providerLabel(row.provider) ||
													'—'}
											</span>
											{row.source && (
												<span className="vulomail-log-secondary">
													{row.source}
												</span>
											)}
										</div>
									),
								},
								created_at: {
									label: __('Date', 'vulomail'),
									flex: '1.2 0 0',
									isSortable: true,
									defaultSort: true,
									defaultOrder: 'desc',
									render: (row: LogRow) => (
										<span className="vm-log-date">
											{displayDate(row)}
										</span>
									),
								},
								actions: {
									label: __('Actions', 'vulomail'),
									flex: '0 0 8rem',
									type: 'action',
									actions: [
										{
											label: __('View', 'vulomail'),
											icon: 'eye',
											onClick: (row: LogRow) =>
												openDetail(row),
										},
										{
											label: __('Resend', 'vulomail'),
											icon: 'send',
											hidden: (row: LogRow) => !row.can_resend,
											onClick: (row: LogRow) =>
												resend(row.id),
										},
										{
											label: __('Delete', 'vulomail'),
											icon: 'delete',
											onClick: (row: LogRow) =>
												setToDelete([row.id]),
										},
									],
								},
							}}
							rows={list.data}
							ids={list.data.map((row) => row.id)}
							totalRows={list.total}
							categoryCounts={[
								{
									value: 'all',
									label: __('All', 'vulomail'),
									count: total,
								},
								{
									value: 'sent',
									label: __('Sent', 'vulomail'),
									count: sent,
								},
								{
									value: 'failed',
									label: __('Failed', 'vulomail'),
									count: failed,
								},
							]}
							bulkActions={[
								{
									label: __('Delete', 'vulomail'),
									value: 'delete',
								},
							]}
							onBulkActionApply={(
								action: string,
								ids: Array<number | string>
							) =>
								'delete' === action &&
								ids.length > 0 &&
								setToDelete(ids.map(Number))
							}
							onSelectCsvDownloadApply={(
								ids: Array<number | string>
							) =>
								downloadCsv(
									list.data.filter((row) =>
										ids.map(Number).includes(row.id)
									)
								)
							}
							isLoading={isLoading}
							onQueryUpdate={onQueryUpdate}
							emptyMessage={
								total > 0
									? __(
											'No entries match. Try another tab, filter or search.',
											'vulomail'
										)
									: __(
											'Nothing has been logged yet.',
											'vulomail'
										)
							}
						/>
					)}
				</div>
			</ContainerComponent>
			<PopupComponent
				open={Boolean(detail)}
				onClose={() => setDetail(null)}
				width={60}
				height="auto"
				position="lightbox"
				className="vulomail-log-popup"
				header={{
					icon: 'sms' === detail?.channel ? 'send' : 'mail',
					title:
						'sms' === detail?.channel
							? __('Text message', 'vulomail')
							: detail?.subject || __('Email', 'vulomail'),
				}}
				footer={
					detail && (
						<ButtonInput
							buttons={[
								{
									text: __('Delete entry', 'vulomail'),
									icon: 'delete',
									color: 'border-red',
									disabled: isBusy,
									onClick: () => setToDelete([detail.id]),
								},
								{
									text: __('Resend', 'vulomail'),
									icon: 'send',
									color: 'purple',
									disabled: isBusy || !detail.can_resend,
									onClick: () => resend(detail.id),
								},
							]}
						/>
					)
				}
			>
				{detail && (
					<div className="vulomail-popup-body vm-log-detail">
						{/* At a glance: how it went, when, through what, and whether anyone opened it. */}
						<div className="vm-log-summary">
							<div className="vm-log-tags">
								{statusBadge(detail)}
								{'yes' === detail.opened && (
									<BadgeComponent
										color="blue"
										text={__('Opened', 'vulomail')}
									/>
								)}
								{'yes' === detail.clicked && (
									<BadgeComponent
										color="purple"
										text={__('Clicked', 'vulomail')}
									/>
								)}
							</div>
							<span className="vm-log-summary-meta">
								{[
									displayDate(detail),
									providerLabel(detail.provider) &&
										sprintf(
											/* translators: %s: provider name. */
											__('via %s', 'vulomail'),
											providerLabel(detail.provider)
										),
									detail.source,
								]
									.filter(Boolean)
									.join(' · ')}
							</span>
						</div>

						<div className="vulomail-log-route">
							{[
								...(detail.headers.From
									? [
											{
												kind: 'from',
												label: __('From', 'vulomail'),
												...parseAddress(
													detail.headers.From
												),
											},
										]
									: []),
								{
									kind: 'to',
									label: __('To', 'vulomail'),
									name: detail.recipients,
									address: detail.recipients,
								},
							].map((party) => (
								<div
									className="vulomail-log-party"
									key={party.kind}
								>
									<span
										className={`vulomail-log-avatar is-${party.kind}`}
										aria-hidden="true"
									>
										{/* An initial for a name; a phone number or other symbol-led value gets the channel's icon. */}
										{/^\p{L}/u.test(party.name) ? (
											party.name.charAt(0).toUpperCase()
										) : (
											<i
												className={`adminfont-${'sms' === detail.channel ? 'send' : 'mail'}`}
											/>
										)}
									</span>
									<div className="vulomail-log-cell">
										<span className="vulomail-log-secondary">
											{party.label}
										</span>
										<span className="vulomail-log-primary">
											{party.name}
										</span>
										{party.address !== party.name && (
											<span className="vulomail-log-secondary">
												{party.address}
											</span>
										)}
									</div>
								</div>
							))}
						</div>

						{detail.attempts.length <= 1 &&
							detail.error_message && (
								<NoticeComponent
									displayPosition="inline-notice"
									type="error"
									message={errorNoticeHtml(
										detail,
										detail.channel
									)}
								/>
							)}

						<div className="vm-log-detail-grid">
							{/* The message itself, first: it is what people open an entry to see. */}
							<section className="vm-log-panel">
								<header className="vulomail-log-message-head">
									<h4 className="vulomail-section-title">
										{__('Message', 'vulomail')}
									</h4>
									{detail.has_body && (
										<ToggleInput
											value={messageView}
											onChange={(value) =>
												setMessageView(
													value as 'preview' | 'raw'
												)
											}
											options={[
												{
													key: 'preview',
													value: 'preview',
													label: __(
														'Preview',
														'vulomail'
													),
												},
												{
													key: 'raw',
													value: 'raw',
													label: __(
														'Plain text',
														'vulomail'
													),
												},
											]}
										/>
									)}
								</header>
								{detail.has_body && !detail.can_resend && (
									<NoticeComponent
										displayPosition="inline-notice"
										type="info"
										message={sprintf(
											/* translators: 1: opening link tag to Settings → Privacy & data, 2: closing link tag. */
											__(
												'The recipient is hidden, so this can\'t be resent. Turn off "Hide recipients" under %1$sSettings → Privacy & data%2$s to allow resending new messages.',
												'vulomail'
											),
											`<a href="${settingsUrl('logging')}">`,
											'</a>'
										)}
									/>
								)}
								{detail.has_body ? (
									<div className="vulomail-log-message">
										{detail.subject && (
											<div className="vulomail-log-message-bar">
												{__('Subject:', 'vulomail')}{' '}
												<strong>
													{detail.subject}
												</strong>
											</div>
										)}
										{'raw' === messageView ? (
											// The stored source, verbatim - useful for debugging, and never interpreted as markup here.
											<pre className="vulomail-message-body">
												{detail.body}
											</pre>
										) : 'email' === detail.channel ? (
											// Rendered the way the recipient would see it, but the body is still untrusted content: a
											// sandboxed iframe with no sandbox flags at all shows the markup without ever running a
											// script in it or reaching this page.
											<iframe
												className="vulomail-message-preview"
												title={__(
													'Email preview',
													'vulomail'
												)}
												srcDoc={detail.body ?? ''}
												sandbox=""
											/>
										) : (
											// A chat bubble: what the recipient received, rather than a second raw-text view.
											<div className="vulomail-sms-preview">
												{linkify(detail.body ?? '')}
											</div>
										)}
									</div>
								) : (
									<NoticeComponent
										displayPosition="inline-notice"
										type="info"
										message={sprintf(
											/* translators: 1: opening link tag to Settings → Privacy & data, 2: closing link tag. */
											__(
												'Message content was not stored. Turn on "Save message content" under %1$sSettings → Privacy & data%2$s to keep it for new messages and allow resending.',
												'vulomail'
											),
											`<a href="${settingsUrl('logging')}">`,
											'</a>'
										)}
									/>
								)}
							</section>

							<aside className="vm-log-side">
								<section className="vm-log-panel">
									<h4 className="vulomail-section-title">
										{__('Details', 'vulomail')}
									</h4>
									<dl className="vm-log-facts">
										<dt>{__('Channel', 'vulomail')}</dt>
										<dd>
											{'sms' === detail.channel
												? __('SMS', 'vulomail')
												: __('Email', 'vulomail')}
										</dd>
										<dt>{__('Sent with', 'vulomail')}</dt>
										<dd>
											{providerLabel(detail.provider) ||
												'—'}
										</dd>
										{detail.source && (
											<>
												<dt>
													{__('Sent by', 'vulomail')}
												</dt>
												<dd>{detail.source}</dd>
											</>
										)}
										{Number(detail.attachments) > 0 && (
											<>
												<dt>
													{__(
														'Attachments',
														'vulomail'
													)}
												</dt>
												<dd>
													{Number(detail.attachments)}
												</dd>
											</>
										)}
										{detail.message_id && (
											<>
												<dt>
													{__(
														'Provider ID',
														'vulomail'
													)}
												</dt>
												<dd className="vm-log-id">
													<code
														title={
															detail.message_id
														}
													>
														{detail.message_id}
													</code>
													<button
														type="button"
														className="vm-log-copy"
														onClick={copyMessageId}
														aria-label={__(
															'Copy provider ID',
															'vulomail'
														)}
														title={__(
															'Copy',
															'vulomail'
														)}
													>
														<i
															className="adminfont-copy"
															aria-hidden="true"
														/>
													</button>
												</dd>
											</>
										)}
									</dl>
								</section>

								{detail.attempts.length > 1 && (
									<section className="vm-log-panel">
										<h4 className="vulomail-section-title">
											{__(
												'Delivery attempts',
												'vulomail'
											)}
										</h4>
										<ol className="vm-log-attempts">
											{detail.attempts.map(
												(attempt, index) => (
													<li
														key={`${attempt.connection_id}-${index}`}
														className={
															attempt.success
																? 'is-good'
																: 'is-bad'
														}
													>
														<span
															className="vm-log-attempt-dot"
															aria-hidden="true"
														/>
														<div className="vulomail-log-cell">
															<span className="vulomail-log-primary">
																{sprintf(
																	/* translators: 1: attempt number, 2: provider name. */
																	__(
																		'%1$d. %2$s',
																		'vulomail'
																	),
																	index + 1,
																	providerLabel(
																		attempt.provider
																	)
																)}
															</span>
															<span className="vulomail-log-secondary">
																{attempt.success
																	? __(
																			'Accepted the message',
																			'vulomail'
																		)
																	: attempt.error_message}
															</span>
														</div>
													</li>
												)
											)}
										</ol>
									</section>
								)}

								{('not_tracked' !== detail.opened ||
									'not_tracked' !== detail.clicked) && (
									<section className="vm-log-panel">
										<h4 className="vulomail-section-title">
											{__('Activity', 'vulomail')}
										</h4>
										<div className="vm-log-stats">
											{[
												{
													label: __(
														'Opens',
														'vulomail'
													),
													count: detail.tracking
														.open_count,
													last: detail.tracking
														.last_opened_at,
													state: detail.opened,
												},
												{
													label: __(
														'Clicks',
														'vulomail'
													),
													count: detail.tracking
														.click_count,
													last: detail.tracking
														.last_clicked_at,
													state: detail.clicked,
												},
											].map((stat) => (
												<div
													className="vm-log-stat"
													key={stat.label}
												>
													<span className="vm-log-stat-value">
														{'not_tracked' ===
														stat.state
															? '—'
															: stat.count}
													</span>
													<span className="vulomail-log-secondary">
														{stat.label}
													</span>
													{stat.last && (
														<span className="vm-log-stat-when">
															{sprintf(
																/* translators: %s: date of the latest open or click. */
																__(
																	'Last %s',
																	'vulomail'
																),
																stat.last
															)}
														</span>
													)}
												</div>
											))}
										</div>
										{detail.tracking.links.length > 0 && (
											<ul className="vm-log-links">
												{detail.tracking.links.map(
													(link, index) => (
														<li
															key={`${link.url}-${index}`}
														>
															<span
																className="vm-log-link-url"
																title={link.url}
															>
																{link.url}
															</span>
															<span className="vulomail-log-secondary">
																{sprintf(
																	/* translators: 1: number of clicks on this link, 2: first and last click dates. */
																	_n(
																		'%1$d click · %2$s',
																		'%1$d clicks · %2$s',
																		link.click_count,
																		'vulomail'
																	),
																	link.click_count,
																	observedRange(
																		link.first_clicked_at,
																		link.last_clicked_at
																	)
																)}
															</span>
														</li>
													)
												)}
											</ul>
										)}
										<p className="vm-log-note">
											{__(
												'Estimates: some mail apps block images, and security scanners can open links on their own.',
												'vulomail'
											)}
										</p>
									</section>
								)}
							</aside>
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
						{'all' === toDelete
							? __('Delete all logs?', 'vulomail')
							: sprintf(
									/* translators: %d: number of log entries. */
									_n(
										'Delete %d log entry?',
										'Delete %d log entries?',
										toDelete?.length ?? 0,
										'vulomail'
									),
									toDelete?.length ?? 0
								)}
					</div>
					<div className="desc">
						{'all' === toDelete
							? __(
									'Every email and SMS log entry will be permanently deleted. This cannot be undone.',
									'vulomail'
								)
							: __(
									'The message and its delivery details will be permanently deleted. This cannot be undone.',
									'vulomail'
								)}
					</div>
					<ButtonInput
						position="center"
						buttons={[
							{
								icon: 'close',
								text: __('Cancel', 'vulomail'),
								color: 'red',
								disabled: isBusy,
								onClick: () => setToDelete(null),
							},
							{
								icon: 'delete',
								text: isBusy
									? __('Deleting…', 'vulomail')
									: __('Delete', 'vulomail'),
								disabled: isBusy,
								onClick: confirmDelete,
							},
						]}
					/>
				</div>
			</PopupComponent>
		</>
	);
};

export default Logs;
