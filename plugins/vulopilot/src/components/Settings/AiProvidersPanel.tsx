/* global appLocalizer */
import { useEffect, useRef, useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { getApiLink, getApiResponse, sendApiResponse } from '@zyra/core';
import {
	FormGroupWrapperComponent,
	FormGroupComponent,
	NoticeManager,
} from '@zyra/components';
import { ExpandablePanelInput } from '@zyra/inputs';

interface ConfiguredProvider {
	id: number;
	provider: string;
	label: string;
	default_model: string | null;
	is_active: boolean;
	has_credential: boolean;
	/**
	 * Whether the stored credential can actually still be decrypted
	 * (Controllers\AiProviders::prepare_config_for_response()). A site
	 * that rotates its auth salts/keys after this was saved (a
	 * regenerated wp-config.php, a database copied to a fresh
	 * environment, ...) leaves this `false` forever — the row still
	 * looks "configured," but ProviderRegistry::build_fallback_chain()
	 * (the real request path every "Generate with AI" call goes through)
	 * already silently skips it. This panel now surfaces that instead of
	 * only ever showing "Configured with your own credentials."
	 */
	credential_ok: boolean;
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
 * don't fit the per-field `InputRenderer` model at all. Zyra's select-driven
 * `ExpandablePanelInput` owns both the connection form and the read-only
 * connected state, so providers do not move into separate settings rows.
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
				desc: `<span class="admin-badge blue">${__('Not connected', 'vulopilot')}</span><span class="vulopilot-provider-summary">${__('Configure this provider with your own credentials.', 'vulopilot')}</span>`,
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
									options: adapter.available_models.map(
										(model) => ({
											label: model,
											value: model,
										})
									),
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

	/**
	 * Re-saves a configured provider's credential — the real fix for a row
	 * whose `credential_ok` is false (see ConfiguredProvider's own
	 * docblock): re-encrypts under the site's CURRENT auth salt via the
	 * same `POST /ai-providers/{id}` route the "add new provider" flow's
	 * own edits already use (Controllers\AiProviders::update_item()),
	 * rather than requiring a full Disconnect + re-Add round trip.
	 */
	const handleReconnect = (row: ConfiguredProvider) => {
		if (isSavingRef.current) {
			return;
		}

		const credential = String(
			newProviderValuesRef.current[row.provider]?.credential ?? ''
		).trim();

		if ('' === credential) {
			NoticeManager.add({
				uniqueKey: 'vulopilot-ai-provider-reconnect',
				type: 'error',
				position: 'float',
				message: __('Enter the new API key first.', 'vulopilot'),
			});
			return;
		}

		isSavingRef.current = true;
		setIsSaving(true);

		sendApiResponse(
			appLocalizer,
			getApiLink(appLocalizer, `ai-providers/${row.id}`),
			{ credential }
		)
			.then((response) => {
				NoticeManager.add({
					uniqueKey: 'vulopilot-ai-provider-reconnect',
					type: response ? 'success' : 'error',
					position: 'float',
					message: response
						? __('AI provider reconnected.', 'vulopilot')
						: __(
								'Could not save this key — check it and try again.',
								'vulopilot'
							),
				});

				if (response) {
					const next = { ...newProviderValuesRef.current };
					delete next[row.provider];
					newProviderValuesRef.current = next;
					setNewProviderValues(next);
					load();
				}
			})
			.finally(() => {
				isSavingRef.current = false;
				setIsSaving(false);
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

	const configuredMethods = configured.map((row) => {
		const providerLabel =
			row.label || adapters[row.provider]?.label || row.provider;
		const needsReconnect = !row.credential_ok;
		const adapter = adapters[row.provider];

		return {
			id: row.provider,
			icon: 'ai',
			label: providerLabel,
			desc: needsReconnect
				? `<span class="admin-badge red">${__('Needs reconnecting', 'vulopilot')}</span><span class="vulopilot-provider-summary">${__('This provider stopped working — see below.', 'vulopilot')}</span>`
				: `<span class="vulopilot-provider-summary is-connected">${__('Configured with your own credentials.', 'vulopilot')}</span>`,
			isCustom: true,
			hideDeleteBtn: true,
			wrapperClass: 'vulopilot-ai-provider-configuration',
			formFields: needsReconnect
				? [
						{
							key: 'provider_details',
							type: 'notice',
							label: '',
							noticeType: 'error',
							message: __(
								'VuloPilot can no longer read this provider’s saved API key (this usually happens after moving to a new server or environment). AI features have silently stopped using it. Enter the key again to reconnect it.',
								'vulopilot'
							),
						},
						{
							key: 'credential',
							type: adapter?.requires_credential ? 'password' : 'text',
							label: adapter?.requires_credential
								? __('API key', 'vulopilot')
								: __('Base URL', 'vulopilot'),
						},
						{
							key: 'reconnect',
							type: 'button',
							label: '',
							text: __('Save key', 'vulopilot'),
							disabled: isSaving,
							onClick: () => handleReconnect(row),
						},
						{
							key: 'disconnect',
							type: 'button',
							label: '',
							text: __('Disconnect', 'vulopilot'),
							icon: 'disconnect',
							onClick: () => handleDelete(row),
						},
					]
				: [
						{
							key: 'provider_details',
							type: 'notice',
							label: '',
							noticeType: 'info',
							message: row.default_model
								? sprintf(
										__(
											'Provider: %1$s — Default model: %2$s',
											'vulopilot'
										),
										providerLabel,
										row.default_model
									)
								: sprintf(
										__('Provider: %s', 'vulopilot'),
										providerLabel
									),
						},
						{
							key: 'disconnect',
							type: 'button',
							label: '',
							text: __('Disconnect', 'vulopilot'),
							icon: 'disconnect',
							onClick: () => handleDelete(row),
						},
					],
		};
	});

	const panelValues = {
		...newProviderValues,
		...Object.fromEntries(
			configured.map((row) => [
				row.provider,
				{
					enable: true,
					title:
						row.label ||
						adapters[row.provider]?.label ||
						row.provider,
				},
			])
		),
	};

	return (
		<div className="vulopilot-ai-providers-panel">
			<FormGroupWrapperComponent>
				<FormGroupComponent
					row
					label={__('Add a new AI provider', 'vulopilot')}
				>
					{isLoading ? (
						<div className="desc">
							{__('Loading…', 'vulopilot')}
						</div>
					) : configured.length > 0 ||
					  newProviderOptions.length > 0 ? (
						<ExpandablePanelInput
							key={`${newProviderPanelKey}-${configured.map(({ id }) => id).join('-')}`}
							name="ai-providers"
							methods={configuredMethods}
							value={panelValues}
							onChange={handleNewProviderChange}
							canAccess
							addNewBtn={newProviderOptions.length > 0}
							addNewTemplate={{
								editableFields: {
									title: false,
									description: false,
								},
							}}
							addNewOptions={newProviderOptions}
						/>
					) : (
						configured.length === 0 && (
							<div className="desc">
								{__(
									'No AI providers configured yet.',
									'vulopilot'
								)}
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
		</div>
	);
};

export default AiProvidersPanel;
