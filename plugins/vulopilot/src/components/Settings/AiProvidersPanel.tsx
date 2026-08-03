/* global appLocalizer */
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import {
	getApiLink,
	getApiResponse,
	sendApiResponse,
} from '@zyra/core';
import {
	CardComponent,
	FormGroupWrapperComponent,
	NoticeManager,
} from '@zyra/components';
import { ButtonInput, SelectInput, TextInput } from '@zyra/inputs';

interface ConfiguredProvider {
	id: number;
	provider: string;
	label: string;
	default_model: string | null;
	is_active: boolean;
	has_credential: boolean;
	created_at: string;
}

interface AdapterMeta {
	label: string;
	available_models: string[];
	requires_credential: boolean;
}

interface AiProvidersResponse {
	configured: ConfiguredProvider[];
	adapters: Record<string, AdapterMeta>;
}

/**
 * Same `.form-group.row` / `.settings-form-label` / `.settings-input-content`
 * markup zyra's own InputRenderer puts around every real settings field
 * (confirmed from its compiled output — there's no exported "FieldRow"
 * component to import instead, InputRenderer builds this JSX inline).
 * Reproduced here rather than falling back to bare, unlabeled inputs so
 * this hand-built panel visually matches every InputRenderer-driven tab
 * on this same page, not just functionally coexist with them.
 */
const SettingsFieldRow = ({
	label,
	description,
	children,
}: {
	label: string;
	description?: string;
	children: ReactNode;
}) => (
	<div className="form-group row">
		<label className="settings-form-label">
			<div className="title">{label}</div>
			{description && (
				<div className="settings-metabox-description">
					{description}
				</div>
			)}
		</label>
		<div className="settings-input-content">{children}</div>
	</div>
);

/**
 * Hand-built rather than InputRenderer-driven, same escape hatch as
 * ImportExportPanel.tsx: AI provider configs live in their own
 * `vulopilot_ai_provider_configs` table (AI-ARCHITECTURE.md), not the flat
 * settings option row every other Settings tab auto-saves into, so they
 * don't fit the per-field `InputRenderer` model at all. Still wrapped in
 * the same `CardComponent` + `FormGroupWrapperComponent` shell
 * ImportExportPanel already uses for the same reason, and every field
 * below reuses InputRenderer's own row markup (see SettingsFieldRow) so
 * it doesn't look like a different app bolted onto this page.
 *
 * This is AI-ARCHITECTURE.md's "What's not here yet" gap being closed:
 * "nothing yet writes to vulopilot_ai_provider_configs from the dashboard
 * — AiProviderConfigRepository exists and works, but there's no REST
 * controller or Settings-page section wired to it yet." Backs
 * RestAPI\Controllers\AiProviders.
 *
 * There's no "default provider"/"credits" mode switch here on purpose —
 * unlike a single-default model, `ProviderRegistry::build_fallback_chain()`
 * already tries *every* active provider in turn (insertion order) until one
 * succeeds, and Built-in Credits is a documented Pro-tier extension point
 * that isn't built yet (AI-ARCHITECTURE.md's "What's not here yet") — this
 * panel only ever shows what's real: BYOK, and "Active" opts a provider
 * into that chain.
 */
const AiProvidersPanel = () => {
	const [configured, setConfigured] = useState<ConfiguredProvider[]>([]);
	const [adapters, setAdapters] = useState<Record<string, AdapterMeta>>({});
	const [isLoading, setIsLoading] = useState(true);
	const [isSaving, setIsSaving] = useState(false);

	const [selectedProvider, setSelectedProvider] = useState('');
	const [label, setLabel] = useState('');
	const [credential, setCredential] = useState('');
	const [defaultModel, setDefaultModel] = useState('');

	const load = () => {
		setIsLoading(true);

		getApiResponse<AiProvidersResponse>(
			getApiLink(appLocalizer, 'ai-providers'),
			{ headers: { 'X-WP-Nonce': appLocalizer.nonce } }
		)
			.then((response) => {
				if (!response) {
					return;
				}

				setConfigured(response.configured);
				setAdapters(response.adapters);
			})
			.finally(() => setIsLoading(false));
	};

	useEffect(load, []);

	const unconfiguredProviderIds = Object.keys(adapters).filter(
		(id) => !configured.some((row) => row.provider === id)
	);

	const selectedAdapter = selectedProvider
		? adapters[selectedProvider]
		: undefined;

	const activeCount = configured.filter((row) => row.is_active).length;

	const handleAdd = () => {
		if (!selectedProvider) {
			return;
		}

		setIsSaving(true);

		sendApiResponse(
			appLocalizer,
			getApiLink(appLocalizer, 'ai-providers'),
			{
				provider: selectedProvider,
				label,
				credential,
				default_model: defaultModel,
			}
		)
			.then((response) => {
				NoticeManager.add({
					uniqueKey: 'vulopilot-ai-provider-add',
					type: response ? 'success' : 'error',
					position: 'float',
					message: response
						? __('AI provider connected.', 'vulopilot')
						: __(
								'Could not connect this provider — check the key and try again.',
								'vulopilot'
							),
				});

				if (response) {
					setSelectedProvider('');
					setLabel('');
					setCredential('');
					setDefaultModel('');
					load();
				}
			})
			.finally(() => setIsSaving(false));
	};

	const handleModelChange = (row: ConfiguredProvider, model: string) => {
		setConfigured(
			configured.map((x) =>
				x.id === row.id ? { ...x, default_model: model } : x
			)
		);

		sendApiResponse(
			appLocalizer,
			getApiLink(appLocalizer, `ai-providers/${row.id}`),
			{ default_model: model }
		).then((response) => {
			if (!response) {
				load();
			}
		});
	};

	const handleToggleActive = (row: ConfiguredProvider) => {
		sendApiResponse(
			appLocalizer,
			getApiLink(appLocalizer, `ai-providers/${row.id}`),
			{ is_active: !row.is_active }
		).then((response) => {
			if (response) {
				load();
			}
		});
	};

	const handleDelete = (row: ConfiguredProvider) => {

		if (
			!window.confirm(
				__(
					'Remove this AI provider? Anything relying on it for AI fixes/generation will fall back to another configured provider, if any.',
					'vulopilot'
				)
			)
		) {
			return;
		}

		sendApiResponse(
			appLocalizer,
			getApiLink(appLocalizer, `ai-providers/${row.id}/delete`),
			{}
		).then((response) => {
			NoticeManager.add({
				uniqueKey: 'vulopilot-ai-provider-delete',
				type: response ? 'success' : 'error',
				position: 'float',
				message: response
					? __('AI provider removed.', 'vulopilot')
					: __('Could not remove this provider.', 'vulopilot'),
			});

			if (response) {
				load();
			}
		});
	};

	return (
		<>
			<CardComponent
				title={__('How AI runs on this site', 'vulopilot')}
				desc={__(
					'Connect at least one provider with your own API key to get AI-written suggestions — alt text, meta titles, FAQ blocks, and every other AI action VuloPilot offers. Every fix still waits for your review and approval on the Dashboard before anything is applied.',
					'vulopilot'
				)}
			>
				{activeCount > 1 && (
					<div className="desc settings-metabox-description">
						{sprintf(
							/* translators: %d is how many AI providers are currently active. */
							__(
								'%d providers are active — if the first one fails or is rate-limited, VuloPilot automatically retries with the next.',
								'vulopilot'
							),
							activeCount
						)}
					</div>
				)}
			</CardComponent>

			<CardComponent
				title={__('Providers', 'vulopilot')}
				isLoading={isLoading}
			>
				<FormGroupWrapperComponent>
					{configured.map((row) => {
						const adapter = adapters[row.provider];

						return (
							<div key={row.id} className="vulopilot-ai-provider-row">
								<div className="vulopilot-ai-provider-row__identity">
									<span
										className={
											row.is_active
												? 'vulopilot-ai-provider-row__status vulopilot-ai-provider-row__status--active'
												: 'vulopilot-ai-provider-row__status vulopilot-ai-provider-row__status--inactive'
										}
									/>
									<div>
										<div className="vulopilot-ai-provider-row__label">
											{row.label || adapter?.label || row.provider}
										</div>
										<div className="settings-metabox-description">
											{row.is_active
												? __('Active — tried automatically if an earlier provider fails', 'vulopilot')
												: __('Inactive — skipped by the fallback chain', 'vulopilot')}
										</div>
									</div>
								</div>

								{adapter && adapter.available_models.length > 0 && (
									<SelectInput
										name={`ai_provider_model_${row.id}`}
										value={row.default_model ?? ''}
										placeholder={__('Default model', 'vulopilot')}
										options={adapter.available_models.map((model) => ({
											label: model,
											value: model,
										}))}
										onChange={(newValue) =>
											handleModelChange(row, newValue as string)
										}
										size="12rem"
									/>
								)}

								<div className="vulopilot-ai-provider-row__actions">
									<ButtonInput
										buttons={{
											text: row.is_active
												? __('Deactivate', 'vulopilot')
												: __('Activate', 'vulopilot'),
											onClick: () => handleToggleActive(row),
										}}
									/>
									<ButtonInput
										buttons={{
											text: __('Remove', 'vulopilot'),
											icon: 'delete',
											onClick: () => handleDelete(row),
										}}
									/>
								</div>
							</div>
						);
					})}

					{unconfiguredProviderIds.length > 0 ? (
						<>
							<SettingsFieldRow
								label={__('Add a provider', 'vulopilot')}
								description={__(
									'Bring your own API key from any supported provider.',
									'vulopilot'
								)}
							>
								<SelectInput
									name="ai_provider"
									value={selectedProvider}
									placeholder={__('Choose a provider…', 'vulopilot')}
									options={unconfiguredProviderIds.map((id) => ({
										label: adapters[id].label,
										value: id,
									}))}
									onChange={(newValue) =>
										setSelectedProvider(newValue as string)
									}
									size="12rem"
								/>
							</SettingsFieldRow>

							{selectedProvider && (
								<>
									<SettingsFieldRow label={__('Label', 'vulopilot')}>
										<TextInput
											name="ai_provider_label"
											placeholder={selectedAdapter?.label}
											value={label}
											onChange={(newValue) =>
												setLabel(newValue as string)
											}
										/>
									</SettingsFieldRow>
									<SettingsFieldRow
										label={
											selectedAdapter?.requires_credential
												? __('API key', 'vulopilot')
												: __('Base URL', 'vulopilot')
										}
										description={
											selectedAdapter?.requires_credential
												? undefined
												: __(
														'Defaults to http://localhost:11434 if left blank.',
														'vulopilot'
													)
										}
									>
										<TextInput
											name="ai_provider_credential"
											type={
												selectedAdapter?.requires_credential
													? 'password'
													: 'text'
											}
											value={credential}
											onChange={(newValue) =>
												setCredential(newValue as string)
											}
										/>
									</SettingsFieldRow>
									{selectedAdapter &&
										selectedAdapter.available_models.length > 0 && (
											<SettingsFieldRow
												label={__('Default model', 'vulopilot')}
											>
												<SelectInput
													name="ai_provider_default_model"
													value={defaultModel}
													placeholder={__(
														'Optional',
														'vulopilot'
													)}
													options={selectedAdapter.available_models.map(
														(model) => ({
															label: model,
															value: model,
														})
													)}
													onChange={(newValue) =>
														setDefaultModel(newValue as string)
													}
													size="12rem"
												/>
											</SettingsFieldRow>
										)}
									<SettingsFieldRow label="">
										<ButtonInput
											buttons={{
												text: __('Connect provider', 'vulopilot'),
												onClick: handleAdd,
												disabled: isSaving,
											}}
										/>
									</SettingsFieldRow>
								</>
							)}
						</>
					) : (
						configured.length === 0 && (
							<SettingsFieldRow label="">
								<div className="desc">
									{__('No AI providers configured yet.', 'vulopilot')}
								</div>
							</SettingsFieldRow>
						)
					)}
				</FormGroupWrapperComponent>
			</CardComponent>
		</>
	);
};

export default AiProvidersPanel;
