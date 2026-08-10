/* global appLocalizer */
import { useEffect, useRef, useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import {
	getApiLink,
	getApiResponse,
	sendApiResponse,
} from '@zyra/core';
import {
	FormGroupWrapperComponent,
	FormGroupComponent,
	NoticeManager,
} from '@zyra/components';
import {
	ButtonInput,
	ExpandablePanelInput,
	SelectInput,
} from '@zyra/inputs';

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
 * Hand-built rather than InputRenderer-driven, same escape hatch as
 * ImportExportPanel.tsx: AI provider configs live in their own
 * `vulopilot_ai_provider_configs` table (AI-ARCHITECTURE.md), not the flat
 * settings option row every other Settings tab auto-saves into, so they
 * don't fit the per-field `InputRenderer` model at all. The add flow uses
 * Zyra's select-driven `ExpandablePanelInput`, while configured providers
 * retain their direct REST-backed controls below.
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
	const [newProviderValues, setNewProviderValues] = useState<
		Record<string, Record<string, unknown>>
	>({});
	const [newProviderPanelKey, setNewProviderPanelKey] = useState(0);
	const newProviderValuesRef = useRef(newProviderValues);
	const isSavingRef = useRef(false);

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

	const activeCount = configured.filter((row) => row.is_active).length;

	const handleAdd = (provider: string) => {
		if (isSavingRef.current) {
			return;
		}

		const values = newProviderValuesRef.current[provider] ?? {};

		isSavingRef.current = true;
		setIsSaving(true);

		sendApiResponse(
			appLocalizer,
			getApiLink(appLocalizer, 'ai-providers'),
			{
				provider,
				label: values.label ?? '',
				credential: values.credential ?? '',
				default_model: values.default_model ?? '',
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
					newProviderValuesRef.current = {};
					setNewProviderValues({});
					setNewProviderPanelKey((key) => key + 1);
					load();
				}
			})
			.finally(() => {
				isSavingRef.current = false;
				setIsSaving(false);
			});
	};

	const handleNewProviderChange = (
		values: Record<string, Record<string, unknown>>
	) => {
		newProviderValuesRef.current = values;
		setNewProviderValues(values);
	};

	const newProviderOptions = unconfiguredProviderIds.map((id) => {
		const adapter = adapters[id];

		return {
			value: id,
			label: adapter.label,
			template: {
				icon: 'ai',
				label: adapter.label,
				desc: __(
					'Configure this provider with your own credentials.',
					'vulopilot'
				),
				formFields: [
					{
						key: 'label',
						type: 'text',
						label: __('Label', 'vulopilot'),
						placeholder: adapter.label,
					},
					{
						key: 'credential',
						type: adapter.requires_credential ? 'password' : 'text',
						label: adapter.requires_credential
							? __('API key', 'vulopilot')
							: __('Base URL', 'vulopilot'),
						desc: adapter.requires_credential
							? undefined
							: __(
									'Defaults to http://localhost:11434 if left blank.',
									'vulopilot'
								),
					},
					...(adapter.available_models.length > 0
						? [
								{
									key: 'default_model',
									type: 'select',
									label: __('Default model', 'vulopilot'),
									options: adapter.available_models.map((model) => ({
										label: model,
										value: model,
									})),
								},
							]
						: []),
					{
						key: 'connect',
						type: 'button',
						label: '',
						text: __('Connect provider', 'vulopilot'),
						disabled: isSaving,
						onClick: () => handleAdd(id),
					},
				],
			},
		};
	});

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
				<FormGroupComponent row label={__('Add a new AI provider', 'vulopilot')}>
					{newProviderOptions.length > 0 ? (
						<ExpandablePanelInput
							key={newProviderPanelKey}
							name="ai-providers"
							methods={[]}
							value={newProviderValues}
							onChange={handleNewProviderChange}
							canAccess
							addNewBtn
							addNewOptions={newProviderOptions}
						/>
					) : (
						configured.length === 0 && (
							<div className="desc">
								{__('No AI providers configured yet.', 'vulopilot')}
							</div>
						)
					)}
				</FormGroupComponent>
			</FormGroupWrapperComponent>
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
		</>
	);
};

export default AiProvidersPanel;
