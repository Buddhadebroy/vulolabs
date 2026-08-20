/* global appLocalizer */
import { useState } from 'react';
import { __ } from '@wordpress/i18n';
import { getApiLink, sendApiResponse } from '@zyra/core';
import {
	CardComponent,
	ColumnComponent,
	ModuleGuardComponent,
	NoticeManager,
	PopupComponent,
} from '@zyra/components';
import { ButtonInput, SelectInput, TextInput } from '@zyra/inputs';
import { TableCard, TableRow } from '@zyra/table';
import { useApiList } from '../../services/useApiList';

interface RedirectRow extends TableRow {
	id: number;
	source_path: string;
	target_url: string;
	redirect_type: 301 | 302;
	hit_count: number;
	is_active: 0 | 1;
	created_at: string;
	last_accessed_at: string | null;
}

/**
 * "Redirects" inner section of the merged "Crawl & URLs" tab (renamed and
 * moved here — was its own top-level "Redirects" tab, RedirectsTab.tsx —
 * direct instruction: "Broken Links + Redirects + Crawler Traffic are
 * fragmented... one main tab: Crawl & URLs"). A real 301/302 redirect
 * manager, unchanged internally — CrawlUrlsTab.tsx just renders this as
 * one of its 5 inner tabs now instead of GEO.tsx rendering it as a
 * sibling top-level tab.
 *
 * The 404 log (both real missing-content-page 404s and theme/plugin/
 * core-file/asset 404s) is NotFoundLogSection.tsx's own separate inner
 * "404s" tab, not this one — see that file's own docblock (it used to
 * live on BrokenLinksTab.tsx, per an even earlier direct instruction,
 * before this merge split it out into its own real section to match the
 * requested "Overview | Broken Links | Redirects | 404s | Robots &
 * Sitemap" structure).
 *
 * The Add/Edit form is a controlled popup (not an inline row like
 * AiProvidersPanel.tsx's single-row-at-a-time form) since this table can
 * hold many rows at once, unlike the small, fixed set of AI provider
 * adapters that panel manages.
 *
 * Has its own real CardComponent heading (title) — previously only the
 * shared error state had one.
 */
const RedirectsSection = () => {
	const [isFormOpen, setIsFormOpen] = useState(false);
	const [editingId, setEditingId] = useState<number | null>(null);
	const [sourcePath, setSourcePath] = useState('');
	const [targetUrl, setTargetUrl] = useState('');
	const [redirectType, setRedirectType] = useState<string>('301');
	const [isSaving, setIsSaving] = useState(false);

	const activeOptions = [
		{ label: __('Active', 'vulopilot'), value: '1' },
		{ label: __('Inactive', 'vulopilot'), value: '0' },
	];

	const redirects = useApiList<RedirectRow>(
		'redirects',
		{},
		{ key: 'is_active', options: activeOptions }
	);

	const resetForm = () => {
		setEditingId(null);
		setSourcePath('');
		setTargetUrl('');
		setRedirectType('301');
	};

	const openAddForm = () => {
		resetForm();
		setIsFormOpen(true);
	};

	const openEditForm = (row: RedirectRow) => {
		setEditingId(row.id);
		setSourcePath(row.source_path);
		setTargetUrl(row.target_url);
		setRedirectType(String(row.redirect_type));
		setIsFormOpen(true);
	};

	const handleSaveRedirect = () => {
		setIsSaving(true);

		const endpoint = editingId
			? `redirects/${editingId}`
			: 'redirects';

		sendApiResponse(appLocalizer, getApiLink(appLocalizer, endpoint), {
			...(editingId ? {} : { source_path: sourcePath }),
			target_url: targetUrl,
			redirect_type: Number(redirectType),
		})
			.then((response) => {
				NoticeManager.add({
					uniqueKey: 'vulopilot-redirect-save',
					type: response ? 'success' : 'error',
					position: 'float',
					message: response
						? __('Redirect saved.', 'vulopilot')
						: __(
								'Could not save this redirect — check the path and URL and try again.',
								'vulopilot'
							),
				});

				if (response) {
					setIsFormOpen(false);
					resetForm();
					redirects.refetch();
				}
			})
			.finally(() => setIsSaving(false));
	};

	const handleToggleActive = (row: RedirectRow) => {
		sendApiResponse(
			appLocalizer,
			getApiLink(appLocalizer, `redirects/${row.id}`),
			{ is_active: row.is_active ? 0 : 1 }
		).then((response) => {
			if (response) {
				redirects.refetch();
			}
		});
	};

	const handleDeleteRedirect = (row: RedirectRow) => {
		if (
			!window.confirm(
				__('Delete this redirect? This cannot be undone.', 'vulopilot')
			)
		) {
			return;
		}

		sendApiResponse(
			appLocalizer,
			getApiLink(appLocalizer, `redirects/${row.id}/delete`),
			{}
		).then((response) => {
			NoticeManager.add({
				uniqueKey: 'vulopilot-redirect-delete',
				type: response ? 'success' : 'error',
				position: 'float',
				message: response
					? __('Redirect deleted.', 'vulopilot')
					: __('Could not delete this redirect.', 'vulopilot'),
			});

			if (response) {
				redirects.refetch();
			}
		});
	};

	const headerAction = (
		<ButtonInput
			buttons={{
				text: __('Add redirect', 'vulopilot'),
				icon: 'plus',
				onClick: openAddForm,
			}}
		/>
	);

	return (
		<ColumnComponent>
			{redirects.error ? (
					<CardComponent
						title={__('Redirects', 'vulopilot')}
						action={headerAction}
					>
						<ModuleGuardComponent
							icon="error"
							title={__(
								'Could not load redirects',
								'vulopilot'
							)}
							desc={redirects.error}
							buttonText={__('Retry', 'vulopilot')}
							onButtonClick={redirects.refetch}
						/>
					</CardComponent>
				) : (
					<>
						<CardComponent
							title={__('Redirects', 'vulopilot')}
							titleIcon="link"
						>
							<TableCard
								buttonActions={[
									{
										label: __('Add redirect', 'vulopilot'),
										onClick: openAddForm,
									},
								]}
								search={{
									placeholder: __('Search redirects…', 'vulopilot'),
								}}
								format={appLocalizer.date_format_js}
								headers={{
									source_path: {
										label: __('From', 'vulopilot'),
									},
									target_url: {
										label: __('To', 'vulopilot'),
									},
									redirect_type: {
										label: __('Type', 'vulopilot'),
									},
									hit_count: {
										label: __('Hits', 'vulopilot'),
										isSortable: true,
									},
									created_at: {
										label: __('Created at', 'vulopilot'),
										type: 'date',
										isSortable: true,
									},
									last_accessed_at: {
										label: __('Last accessed', 'vulopilot'),
										type: 'date',
										isSortable: true,
										emptyText: __('Never', 'vulopilot'),
									},
									is_active: {
										label: __('Status', 'vulopilot'),
										type: 'badge',
										statusClass: (row: RedirectRow) =>
											row.is_active ? 'status-active' : 'status-inactive',
									},
									actions: {
										label: __('Actions', 'vulopilot'),
										type: 'action',
										actions: [
											{
												label: __('Edit', 'vulopilot'),
												icon: 'edit',
												onClick: (row?: Record<string, unknown>) =>
													row && openEditForm(row as RedirectRow),
											},
											{
												label: (row?: Record<string, unknown>) =>
													row?.is_active
														? __('Deactivate', 'vulopilot')
														: __('Activate', 'vulopilot'),
												icon: 'toggle',
												onClick: (row?: Record<string, unknown>) =>
													row &&
													handleToggleActive(row as RedirectRow),
											},
											{
												label: __('Delete', 'vulopilot'),
												icon: 'delete',
												onClick: (row?: Record<string, unknown>) =>
													row &&
													handleDeleteRedirect(row as RedirectRow),
											},
										] as any[],
									},
								}}
								rows={redirects.data}
								ids={redirects.data.map((row) => row.id)}
								totalRows={redirects.total}
								categoryCounts={redirects.categoryCounts}
								isLoading={redirects.isLoading}
								onQueryUpdate={redirects.onQueryUpdate}
								emptyMessage={__(
									'No redirects yet — add one, or convert an entry from the 404s tab.',
									'vulopilot'
								)}
							/>
						</CardComponent>

						<PopupComponent
							open={isFormOpen}
							onClose={() => {
								setIsFormOpen(false);
								resetForm();
							}}
							width={28}
							height="auto"
							position="lightbox"
							header={{
								title: editingId
									? __('Edit redirect', 'vulopilot')
									: __('Add redirect', 'vulopilot'),
							}}
						>
							<div className="vulopilot-redirect-form">
								<TextInput
									name="source_path"
									placeholder={__('/old-page/', 'vulopilot')}
									value={sourcePath}
									disabled={!!editingId}
									onChange={(newValue) =>
										setSourcePath(newValue as string)
									}
								/>
								<TextInput
									name="target_url"
									placeholder={__(
										'https://example.com/new-page/',
										'vulopilot'
									)}
									value={targetUrl}
									onChange={(newValue) =>
										setTargetUrl(newValue as string)
									}
								/>
								<SelectInput
									name="redirect_type"
									value={redirectType}
									options={[
										{ label: '301 (Permanent)', value: '301' },
										{ label: '302 (Temporary)', value: '302' },
									]}
									onChange={(newValue) =>
										setRedirectType(newValue as string)
									}
									size="12rem"
								/>
								<ButtonInput
									buttons={{
										text: __('Save', 'vulopilot'),
										onClick: handleSaveRedirect,
										disabled: isSaving,
									}}
								/>
							</div>
						</PopupComponent>
					</>
				)}
		</ColumnComponent>
	);
};

export default RedirectsSection;
