/* global vuloformAppLocalizer */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { __, _n, sprintf } from '@wordpress/i18n';
import {
	BadgeComponent,
	ColumnComponent,
	ContainerComponent,
	NavigatorHeaderComponent,
	PopupComponent,
} from '@zyra/components';
import { ButtonInput } from '@zyra/inputs';
import { TableCard } from '../components/TableCard/TableCard';
import {
	Card,
	EmptyState,
	IconTile,
	Pill,
	SamplePreview,
} from '../components/ui';
import { apiDelete, apiGet, apiPost } from '../services/api';
import { errorMessage, notify } from '../services/notify';
import { goToTab, tabUrl } from '../services/types';
import type { Form } from '../services/types';
import '../components/forms.scss';

interface FormRow {
	id: number;
	title: string;
	status: string;
	submissions: number;
	unread: number;
	updated_at_display: string;
	[key: string]: unknown;
}

interface FormList {
	data: FormRow[];
	total: number;
	status_counts?: { all: number; published: number; draft: number };
}

interface TableQuery {
	paged?: number | string;
	per_page?: number | string;
	searchValue?: string;
	categoryFilter?: string;
}

interface MigrationSource {
	id: string;
	label: string;
	count: number;
	plugin_file: string;
	forms: Array<{ already_migrated: boolean }>;
}

interface MigrationResult {
	migrated: number;
	skipped: number;
	errors: string[];
	posts_updated?: number;
	references_updated?: number;
}

/** Made-up forms for the empty list's preview (SamplePreview). */
const SAMPLE_FORMS: FormRow[] = [
	{
		id: 1,
		title: __('Contact us', 'vuloform'),
		status: 'published',
		submissions: 128,
		unread: 6,
		updated_at_display: __('Today, 9:12 am', 'vuloform'),
	},
	{
		id: 2,
		title: __('Request a quote', 'vuloform'),
		status: 'published',
		submissions: 42,
		unread: 3,
		updated_at_display: __('Yesterday, 3:40 pm', 'vuloform'),
	},
	{
		id: 3,
		title: __('Event booking', 'vuloform'),
		status: 'published',
		submissions: 17,
		unread: 0,
		updated_at_display: __('Nov 14, 10:05 am', 'vuloform'),
	},
	{
		id: 4,
		title: __('Job application', 'vuloform'),
		status: 'draft',
		submissions: 0,
		unread: 0,
		updated_at_display: __('Nov 9, 6:30 pm', 'vuloform'),
	},
];

/**
 * The forms list: every form with its submission count, and the "new form" chooser.
 */
const Forms = () => {
	const [query, setQuery] = useState<TableQuery>({ paged: 1, per_page: 10 });
	const [list, setList] = useState<FormList>({ data: [], total: 0 });
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState('');
	const [reload, setReload] = useState(0);
	const hash = new URLSearchParams(useLocation().hash);
	// `&new=1` (the Dashboard's "New form") opens the template chooser on arrival.
	const [isChoosing, setIsChoosing] = useState(() => '1' === hash.get('new'));
	const [templateCategory, setTemplateCategory] = useState('all');
	const [isBusy, setIsBusy] = useState(false);
	// Forms waiting for the delete confirmation: one from its row, or several from a bulk action.
	const [toDelete, setToDelete] = useState<FormRow[] | null>(null);
	const fileInput = useRef<HTMLInputElement>(null);
	const [sources, setSources] = useState<MigrationSource[] | null>(null);
	const [isMigrating, setIsMigrating] = useState(false);
	const [isDeactivating, setIsDeactivating] = useState(false);

	// Checked once on load, so a detected plugin can be surfaced right on the forms list.
	const loadSources = () => {
		apiGet<{ data: MigrationSource[] }>('migration/sources')
			.then((payload) => setSources(payload.data))
			.catch(() => {});
	};

	useEffect(loadSources, []);

	const detectedSources = (sources ?? []).filter(
		(source) => source.count > 0
	);

	// Still-active plugins with at least one already-migrated form - shown until the plugin itself
	// is deactivated (plugin_file goes empty), so this survives reloads, not just this page visit.
	const migratedSources = (sources ?? []).filter(
		(source) =>
			source.plugin_file &&
			source.forms.some((form) => form.already_migrated)
	);

	// A template a plugin supplies is grouped under that plugin's name instead of its own category.
	const categoryOf = (template: { category?: string; plugin?: string }) =>
		template.plugin || template.category || '';

	// Categories in first-seen order, each with how many templates it holds.
	const templateCategories = vuloformAppLocalizer.templates.reduce<
		Array<{ id: string; label: string; count: number }>
	>((categories, template) => {
		const label = categoryOf(template);
		const existing = categories.find(
			(category) => category.label === label
		);

		if (existing) {
			existing.count++;
		} else {
			categories.push({ id: label, label, count: 1 });
		}

		return categories;
	}, []);

	const visibleTemplates =
		'all' === templateCategory
			? vuloformAppLocalizer.templates
			: vuloformAppLocalizer.templates.filter(
					(template) => categoryOf(template) === templateCategory
				);

	// Closing it also drops `new=1`, so a reload does not open it again.
	const closeChooser = () => {
		setIsChoosing(false);

		if (hash.get('new')) {
			window.history.replaceState(
				null,
				'',
				`${window.location.pathname}${window.location.search}#&tab=forms`
			);
		}
	};

	const onQueryUpdate = useCallback((next: TableQuery) => setQuery(next), []);

	useEffect(() => {
		let cancelled = false;

		setIsLoading(true);

		apiGet<FormList>('forms', {
			search: query.searchValue || undefined,
			status:
				query.categoryFilter && 'all' !== query.categoryFilter
					? query.categoryFilter
					: undefined,
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

	const create = (body: Record<string, unknown>) => {
		setIsBusy(true);

		apiPost<Form>('forms', body)
			.then((form) => goToTab(`forms&form=${form.id}`))
			.catch((e) => notify('error', errorMessage(e)))
			.finally(() => setIsBusy(false));
	};

	const importFile = (file: File | undefined) => {
		if (!file) {
			return;
		}

		file.text()
			.then((text) => {
				const parsed = JSON.parse(text);

				// The server rebuilds the schema field by field, so a hand-edited file is safe to send.
				create({ title: parsed.title, schema: parsed.schema });
			})
			.catch(() =>
				notify(
					'error',
					__('That file is not a VuloForm export.', 'vuloform')
				)
			);
	};

	/** Migrates every detected source straight away - no picker, no popup. */
	const migrateDetected = () => {
		if (0 === detectedSources.length) {
			return;
		}

		setIsMigrating(true);

		const migratingSources = detectedSources;

		Promise.all(
			migratingSources.map((source) =>
				apiPost<MigrationResult>('migration/run', { source: source.id })
			)
		)
			.then((results) => {
				const migrated = results.reduce(
					(total, result) => total + result.migrated,
					0
				);
				const errors = results.flatMap((result) => result.errors);

				if (migrated > 0) {
					notify(
						'success',
						sprintf(
							/* translators: %d: number of forms migrated. */
							_n(
								'%d form migrated.',
								'%d forms migrated.',
								migrated,
								'vuloform'
							),
							migrated
						)
					);
					setReload((n) => n + 1);
				}

				if (errors.length > 0) {
					notify('error', errors.join(' '));
				}

				loadSources();
			})
			.catch((e) => notify('error', errorMessage(e)))
			.finally(() => setIsMigrating(false));
	};

	const deactivateMigratedSources = () => {
		if (0 === migratedSources.length) {
			return;
		}

		setIsDeactivating(true);

		Promise.all(
			migratedSources.map((source) =>
				apiPost('migration/deactivate-source', { source: source.id })
			)
		)
			.then(() => {
				notify('success', __('Plugin deactivated.', 'vuloform'));
				loadSources();
			})
			.catch((e) => notify('error', errorMessage(e)))
			.finally(() => setIsDeactivating(false));
	};

	const duplicate = (row: FormRow) => {
		apiPost<Form>(`forms/${row.id}/duplicate`)
			.then(() => {
				notify('success', __('Form duplicated.', 'vuloform'));
				setReload((n) => n + 1);
			})
			.catch((e) => notify('error', errorMessage(e)));
	};

	const confirmDelete = () => {
		if (!toDelete) {
			return;
		}

		const ids = toDelete.map((row) => row.id);
		const request =
			1 === ids.length
				? apiDelete(`forms/${ids[0]}`).then(() => ({
						deleted: 1,
						skipped: 0,
					}))
				: apiPost<{ deleted: number; skipped: number }>(
						'forms/bulk-delete',
						{ ids }
					);

		setIsBusy(true);

		request
			.then(({ deleted, skipped }) => {
				notify(
					'success',
					sprintf(
						/* translators: %d: number of deleted forms. */
						_n(
							'%d form deleted.',
							'%d forms deleted.',
							deleted,
							'vuloform'
						),
						deleted
					) +
						(skipped
							? ' ' +
								sprintf(
									/* translators: %d: number of forms that were kept. */
									_n(
										'%d form is in use by another plugin and was kept.',
										'%d forms are in use by another plugin and were kept.',
										skipped,
										'vuloform'
									),
									skipped
								)
							: '')
				);
				setReload((n) => n + 1);
			})
			.catch((e) => notify('error', errorMessage(e)))
			.finally(() => {
				setIsBusy(false);
				setToDelete(null);
			});
	};

	// Publish or unpublish several forms. A form with problems stays a draft (the server decides), so the count says what changed.
	const setStatus = (ids: number[], status: 'published' | 'draft') =>
		Promise.all(ids.map((id) => apiPost<Form>(`forms/${id}`, { status })))
			.then((saved) => {
				const changed = saved.filter(
					(form) => form.status === status
				).length;

				notify(
					changed === ids.length ? 'success' : 'error',
					'published' === status
						? sprintf(
								/* translators: 1: forms published, 2: forms selected. */
								__(
									'%1$d of %2$d forms published. A form with problems stays a draft until they are fixed.',
									'vuloform'
								),
								changed,
								ids.length
							)
						: sprintf(
								/* translators: %d: number of forms. */
								_n(
									'%d form moved to drafts.',
									'%d forms moved to drafts.',
									changed,
									'vuloform'
								),
								changed
							)
				);
				setReload((n) => n + 1);
			})
			.catch((e) => notify('error', errorMessage(e)));

	const copyShortcode = (id: number) =>
		navigator.clipboard
			?.writeText(`[vuloform id="${id}"]`)
			.then(() => notify('success', __('Shortcode copied.', 'vuloform')))
			.catch(() =>
				notify(
					'error',
					__(
						'Could not copy. Select the shortcode and copy it yourself.',
						'vuloform'
					)
				)
			);

	// The list's columns, shared with its sample preview so both draw a row the same way.
	const columns = {
		title: {
			label: __('Form', 'vuloform'),
			flex: '2.6 0 0',
			// Name and status on one line, then the form number and when it was last edited: one cell, not three columns.
			render: (row: FormRow) => (
				<div className="vf-row-main">
					<span className="vf-list-icon" aria-hidden="true">
						<i className="adminfont-form" />
					</span>
					<div className="vuloform-cell">
						<span className="vuloform-cell-title">
							<a
								className="vuloform-cell-primary"
								href={tabUrl(`forms&form=${row.id}`)}
							>
								{row.title || __('(no name)', 'vuloform')}
							</a>
							{'published' === row.status ? (
								<Pill status="good">
									{__('Published', 'vuloform')}
								</Pill>
							) : (
								<Pill status="off">
									{__('Draft', 'vuloform')}
								</Pill>
							)}
						</span>
						<span className="vuloform-cell-secondary">
							{sprintf(
								/* translators: 1: form number, used in the shortcode and the block, 2: date and time. */
								__('#%1$d · Edited %2$s', 'vuloform'),
								row.id,
								row.updated_at_display
							)}
						</span>
					</div>
				</div>
			),
		},
		submissions: {
			label: __('Submissions', 'vuloform'),
			flex: '1.2 0 0',
			render: (row: FormRow) =>
				0 === row.submissions ? (
					<span className="vuloform-cell-secondary">
						{__('None yet', 'vuloform')}
					</span>
				) : (
					<a
						className="vuloform-cell-count"
						href={tabUrl(`submissions&form=${row.id}`)}
					>
						{row.submissions.toLocaleString()}
						{row.unread > 0 && (
							<Pill status="info">
								{sprintf(
									/* translators: %d: number of unread submissions. */
									__('%d new', 'vuloform'),
									row.unread
								)}
							</Pill>
						)}
					</a>
				),
		},
		shortcode: {
			label: __('Shortcode', 'vuloform'),
			flex: '1.5 0 0',
			render: (row: FormRow) => (
				<span className="vf-shortcode">
					<code>{`[vuloform id="${row.id}"]`}</code>
					<button
						type="button"
						onClick={() => copyShortcode(row.id)}
						aria-label={__('Copy shortcode', 'vuloform')}
						title={__('Copy', 'vuloform')}
					>
						<i className="adminfont-copy" aria-hidden="true" />
					</button>
				</span>
			),
		},
		id: {
			label: __('Actions', 'vuloform'),
			flex: '0 0 9rem',
			type: 'action',
			actions: [
				{
					label: __('Edit', 'vuloform'),
					icon: 'edit',
					onClick: (row: Record<string, unknown>) =>
						goToTab(`forms&form=${(row as unknown as FormRow).id}`),
				},
				{
					label: __('Submissions', 'vuloform'),
					icon: 'mail',
					onClick: (row: Record<string, unknown>) =>
						goToTab(
							`submissions&form=${(row as unknown as FormRow).id}`
						),
				},
				{
					label: __('Duplicate', 'vuloform'),
					icon: 'copy',
					onClick: (row: Record<string, unknown>) =>
						duplicate(row as unknown as FormRow),
				},
				{
					label: __('Delete', 'vuloform'),
					icon: 'delete',
					onClick: (row: Record<string, unknown>) =>
						setToDelete([row as unknown as FormRow]),
				},
			],
		},
	};

	const sourceNames = detectedSources
		.map((source) => source.label)
		.join(', ');
	const sourceForms = detectedSources.reduce(
		(total, source) => total + source.count,
		0
	);
	const isEmpty =
		!isLoading &&
		0 === list.total &&
		!query.searchValue &&
		(!query.categoryFilter || 'all' === query.categoryFilter);

	return (
		<>
			<NavigatorHeaderComponent
				headerIcon="form"
				headerTitle={__('Forms', 'vuloform')}
				headerDescription={__(
					'Every form on your site. Build one, publish it, and add it to a page.',
					'vuloform'
				)}
				headerCustomContent={
					<ButtonInput
						buttons={{
							text: __('New form', 'vuloform'),
							icon: 'plus',
							color: 'purple-bg',
							onClick: () => setIsChoosing(true),
						}}
					/>
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
										'Could not load your forms',
										'vuloform'
									)}
									text={error}
								/>
							</Card>
						)}

						{/* Forms another plugin still holds: an opportunity, so it reads as one. */}
						{!error && detectedSources.length > 0 && (
							<section className="vf-banner">
								<IconTile icon="import" tone="violet" />
								<div>
									<strong>
										{sprintf(
											/* translators: %s: comma-separated list of detected plugin names. */
											__(
												'Bring your %s forms into VuloForm',
												'vuloform'
											),
											sourceNames
										)}
									</strong>
									<span>
										{sprintf(
											/* translators: 1: number of forms found, 2: comma-separated list of detected plugin names. */
											_n(
												'%1$d form found in %2$s. Migrating copies it; %2$s stays untouched.',
												'%1$d forms found in %2$s. Migrating copies them; %2$s stays untouched.',
												sourceForms,
												'vuloform'
											),
											sourceForms,
											sourceNames
										)}
									</span>
								</div>
								<ButtonInput
									buttons={{
										text: isMigrating
											? __('Migrating…', 'vuloform')
											: __('Migrate now', 'vuloform'),
										icon: 'import',
										color: 'purple-bg',
										disabled: isMigrating,
										onClick: migrateDetected,
									}}
								/>
							</section>
						)}
						{!error && migratedSources.length > 0 && (
							<section className="vf-banner is-good">
								<IconTile icon="check" tone="green" />
								<div>
									<strong>
										{__('Migration successful', 'vuloform')}
									</strong>
									<span>
										{sprintf(
											/* translators: %s: comma-separated list of source plugin names. */
											__(
												'Your forms from %s now live in VuloForm too. You can deactivate it.',
												'vuloform'
											),
											migratedSources
												.map((source) => source.label)
												.join(', ')
										)}
									</span>
								</div>
								<ButtonInput
									buttons={{
										text: isDeactivating
											? __('Deactivating…', 'vuloform')
											: __('Deactivate it', 'vuloform'),
										color: 'purple',
										disabled: isDeactivating,
										onClick: deactivateMigratedSources,
									}}
								/>
							</section>
						)}

						{!error && isEmpty && (
							<SamplePreview
								icon="form"
								title={__('Create your first form', 'vuloform')}
								text={__(
									'Start from a template such as a contact form, or from a blank form. Your forms show up here, like this.',
									'vuloform'
								)}
								action={
									<ButtonInput
										buttons={{
											text: __('New form', 'vuloform'),
											icon: 'plus',
											color: 'purple-bg',
											onClick: () => setIsChoosing(true),
										}}
									/>
								}
								note={__(
									'A preview with sample data. Your own forms show here once you create one.',
									'vuloform'
								)}
							>
								<TableCard
									search={{
										placeholder: __(
											'Search forms…',
											'vuloform'
										),
									}}
									showMenu={false}
									categoryCounts={[
										{
											value: 'all',
											label: __('All', 'vuloform'),
											count: 4,
										},
										{
											value: 'published',
											label: __('Published', 'vuloform'),
											count: 3,
										},
										{
											value: 'draft',
											label: __('Drafts', 'vuloform'),
											count: 1,
										},
									]}
									activeCategory="all"
									headers={columns}
									rows={SAMPLE_FORMS}
									ids={SAMPLE_FORMS.map((row) => row.id)}
									totalRows={SAMPLE_FORMS.length}
									isLoading={false}
								/>
							</SamplePreview>
						)}

						{!error && !isEmpty && (
							<TableCard
								search={{
									placeholder: __(
										'Search forms…',
										'vuloform'
									),
								}}
								showMenu={false}
								categoryCounts={[
									{
										value: 'all',
										label: __('All', 'vuloform'),
										count: list.status_counts?.all ?? 0,
									},
									{
										value: 'published',
										label: __('Published', 'vuloform'),
										count:
											list.status_counts?.published ?? 0,
									},
									{
										value: 'draft',
										label: __('Drafts', 'vuloform'),
										count: list.status_counts?.draft ?? 0,
									},
								]}
								activeCategory="all"
								headers={columns}
								rows={list.data}
								ids={list.data.map((row) => row.id)}
								totalRows={list.total}
								bulkActions={[
									{
										label: __('Publish', 'vuloform'),
										value: 'published',
									},
									{
										label: __('Move to drafts', 'vuloform'),
										value: 'draft',
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
										setToDelete(
											list.data.filter((row) =>
												picked.includes(row.id)
											)
										);
									} else if (
										'published' === action ||
										'draft' === action
									) {
										setStatus(picked, action);
									}
								}}
								isLoading={isLoading}
								onQueryUpdate={onQueryUpdate}
								emptyMessage={__('No forms match.', 'vuloform')}
							/>
						)}
					</div>
				</ColumnComponent>
			</ContainerComponent>
			<PopupComponent
				open={isChoosing}
				onClose={closeChooser}
				width={68}
				height="auto"
				position="lightbox"
				header={{
					icon: 'form',
					title: __('Start a new form', 'vuloform'),
				}}
			>
				<div className="vuloform-popup-body">
					<div className="vuloform-template-picker">
						<div className="vuloform-template-categories">
							<button
								type="button"
								className={
									'all' === templateCategory
										? 'vuloform-template-category is-active'
										: 'vuloform-template-category'
								}
								onClick={() => setTemplateCategory('all')}
							>
								{__('All templates', 'vuloform')}
								<span>
									{vuloformAppLocalizer.templates.length}
								</span>
							</button>
							{templateCategories.map((category) => (
								<button
									type="button"
									key={category.id}
									className={
										category.id === templateCategory
											? 'vuloform-template-category is-active'
											: 'vuloform-template-category'
									}
									onClick={() =>
										setTemplateCategory(category.id)
									}
								>
									{category.label}
									<span>{category.count}</span>
								</button>
							))}
						</div>
						<div className="vuloform-templates">
							<button
								type="button"
								className="vuloform-template"
								disabled={isBusy}
								onClick={() => create({})}
							>
								<i
									className="adminfont-plus"
									aria-hidden="true"
								/>
								<strong>{__('Blank form', 'vuloform')}</strong>
								<span>
									{__(
										'Start with an empty canvas.',
										'vuloform'
									)}
								</span>
							</button>
							{visibleTemplates.map((template) => (
								<button
									type="button"
									className="vuloform-template"
									key={template.id}
									disabled={isBusy}
									onClick={() =>
										create({ template: template.id })
									}
								>
									<i
										className={`adminfont-${template.icon}`}
										aria-hidden="true"
									/>
									<strong>{template.title}</strong>
									{template.plugin && (
										<BadgeComponent
											color="purple"
											text={template.plugin}
										/>
									)}
									<span>{template.desc}</span>
								</button>
							))}
						</div>
					</div>
					<div className="vuloform-form-footer">
						<input
							ref={fileInput}
							type="file"
							accept="application/json,.json"
							hidden
							onChange={(event) =>
								importFile(event.target.files?.[0])
							}
						/>
						<ButtonInput
							buttons={{
								text: __('Import a form (.json)', 'vuloform'),
								icon: 'import',
								color: 'purple',
								disabled: isBusy,
								onClick: () => fileInput.current?.click(),
							}}
						/>
					</div>
				</div>
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
						{1 === toDelete?.length
							? __('Delete this form?', 'vuloform')
							: sprintf(
									/* translators: %d: number of forms. */
									__('Delete %d forms?', 'vuloform'),
									toDelete?.length ?? 0
								)}
					</div>
					<div className="desc">
						{1 === toDelete?.length
							? sprintf(
									/* translators: 1: form title, 2: number of submissions. */
									_n(
										'"%1$s" and its %2$d submission, including any uploaded files, will be permanently deleted.',
										'"%1$s" and its %2$d submissions, including any uploaded files, will be permanently deleted.',
										toDelete[0].submissions,
										'vuloform'
									),
									toDelete[0].title,
									toDelete[0].submissions
								)
							: __(
									'The selected forms and all their submissions, including uploaded files, will be permanently deleted.',
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
								disabled: isBusy,
								onClick: () => setToDelete(null),
							},
							{
								icon: 'delete',
								text: isBusy
									? __('Deleting…', 'vuloform')
									: __('Delete', 'vuloform'),
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

export default Forms;
