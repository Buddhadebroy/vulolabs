/* global appLocalizer */
import { useEffect, useRef, useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { getApiLink, getApiResponse, sendApiResponse } from '@zyra/core';
import {
	FormGroupWrapperComponent,
	FormGroupComponent,
	NoticeManager,
} from '@zyra/components';
import { ButtonInput, ChoiceToggleInput, ExpandablePanelInput, SelectInput, TextInput } from '@zyra/inputs';

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
	 * already silently skips it. This panel surfaces that instead of
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

const nonceHeaders = { headers: { 'X-WP-Nonce': appLocalizer.nonce } };

/**
 * Gemini/OpenAI get their own fixed hero cards (mockup) — real copy, not
 * fabricated data (ProviderRegistry has no "description" field for an
 * adapter, only label/available_models/requires_credential), and a real
 * external link to where that provider's own API key page actually lives.
 * Every other registered adapter (Anthropic, OpenRouter, Ollama, Groq —
 * whatever `vulopilot_ai_provider_sources` adds) is bundled into the
 * "Other providers" section below instead of getting its own hero card.
 */
const HERO_PROVIDERS: Record<string, { desc: string; helpLabel: string; helpUrl: string }> = {
	gemini: {
		desc: __( "Google's next-generation AI model.", 'vulopilot' ),
		helpLabel: __( 'Google AI Studio', 'vulopilot' ),
		helpUrl: 'https://aistudio.google.com/apikey',
	},
	openai: {
		desc: __( 'Advanced AI models for chat, content, and more.', 'vulopilot' ),
		helpLabel: 'platform.openai.com',
		helpUrl: 'https://platform.openai.com/api-keys',
	},
};

interface ProviderCardProps {
	providerId: string;
	adapter: AdapterMeta;
	config: ConfiguredProvider | null;
	isSaving: boolean;
	onConnect: ( providerId: string, credential: string, defaultModel: string ) => void;
	onToggleActive: ( row: ConfiguredProvider ) => void;
	onSaveModel: ( row: ConfiguredProvider, model: string ) => void;
	onReconnect: ( row: ConfiguredProvider, credential: string ) => void;
	onDisconnect: ( row: ConfiguredProvider ) => void;
	onTest: ( row: ConfiguredProvider ) => Promise<{ success: boolean; message: string }>;
}

/**
 * One Gemini/OpenAI hero card — connect / connected(healthy) / needs
 * reconnecting, matching the mockup's own 3 real states. The API key field
 * is only ever a live, freshly-typed value (connect or rotate) with a real
 * show/hide toggle on what's actually being typed — GET /ai-providers never
 * returns a saved credential (Controllers\AiProviders's own docblock), so a
 * "connected" row shows a static masked placeholder instead of a
 * reveal-my-old-key control that could never really reveal anything.
 */
const ProviderCard = ( {
	providerId,
	adapter,
	config,
	isSaving,
	onConnect,
	onToggleActive,
	onSaveModel,
	onReconnect,
	onDisconnect,
	onTest,
}: ProviderCardProps ) => {
	const hero = HERO_PROVIDERS[ providerId ];
	const [ credential, setCredential ] = useState( '' );
	const [ showCredential, setShowCredential ] = useState( false );
	const [ model, setModel ] = useState( config?.default_model ?? '' );
	const [ isTesting, setIsTesting ] = useState( false );
	const [ testResult, setTestResult ] = useState<{ success: boolean; message: string } | null>( null );

	const needsReconnect = !! config && ! config.credential_ok;

	const handleTest = () => {
		if ( ! config ) {
			return;
		}

		setIsTesting( true );
		setTestResult( null );

		onTest( config )
			.then( setTestResult )
			.finally( () => setIsTesting( false ) );
	};

	return (
		<div className="ai-provider-card">
			<div className="ai-provider-card-header">
				<div className="ai-provider-card-icon">
					<i className="adminfont-ai" />
				</div>
				<div className="ai-provider-card-title">
					<strong>{ adapter.label }</strong>
					<span className="desc">{ hero?.desc }</span>
				</div>
				{ config && (
					<ChoiceToggleInput
						options={ [ { key: 'enabled', value: 'enabled', label: config.is_active ? __( 'Enabled', 'vulopilot' ) : __( 'Disabled', 'vulopilot' ) } ] }
						value={ config.is_active ? [ 'enabled' ] : [] }
						multiSelect
						modules={ [] }
						onChange={ () => onToggleActive( config ) }
					/>
				) }
			</div>

			{ ! config && (
				<div className="ai-provider-card-body">
					<div className="ai-provider-field">
						<label>{ __( 'API Key', 'vulopilot' ) }</label>
						<div className="ai-provider-input-with-eye">
							<TextInput
								type={ showCredential ? 'text' : 'password' }
								value={ credential }
								onChange={ setCredential }
								placeholder={ __( 'Paste your API key', 'vulopilot' ) }
							/>
							<i
								className={ `adminfont-${ showCredential ? 'eye' : 'eye-blocked' }` }
								onClick={ () => setShowCredential( ( v ) => ! v ) }
							/>
						</div>
						{ hero && (
							<div className="desc">
								{ __( 'Get your API key from', 'vulopilot' ) }{ ' ' }
								<a href={ hero.helpUrl } target="_blank" rel="noreferrer">
									{ hero.helpLabel }
								</a>
							</div>
						) }
					</div>
					<ButtonInput
						buttons={ {
							text: isSaving ? __( 'Connecting…', 'vulopilot' ) : __( 'Connect', 'vulopilot' ),
							disabled: isSaving || '' === credential.trim(),
							onClick: () => onConnect( providerId, credential, model ),
						} }
					/>
				</div>
			) }

			{ config && (
				<div className="ai-provider-card-body">
					<div className="ai-provider-card-row">
						<div className="ai-provider-field">
							<label>{ __( 'API Key', 'vulopilot' ) }</label>
							{ needsReconnect ? (
								<div className="ai-provider-input-with-eye">
									<TextInput
										type={ showCredential ? 'text' : 'password' }
										value={ credential }
										onChange={ setCredential }
										placeholder={ __( 'Enter a new API key', 'vulopilot' ) }
									/>
									<i
										className={ `adminfont-${ showCredential ? 'eye' : 'eye-blocked' }` }
										onClick={ () => setShowCredential( ( v ) => ! v ) }
									/>
								</div>
							) : (
								<TextInput type="text" value="••••••••••••••••" onChange={ () => undefined } readOnly />
							) }
							{ hero && (
								<div className="desc">
									{ __( 'Get your API key from', 'vulopilot' ) }{ ' ' }
									<a href={ hero.helpUrl } target="_blank" rel="noreferrer">
										{ hero.helpLabel }
									</a>
								</div>
							) }
						</div>
						{ adapter.available_models.length > 0 && (
							<div className="ai-provider-field">
								<label>{ __( 'Model', 'vulopilot' ) }</label>
								<SelectInput
									name={ `${ providerId }-model` }
									value={ model }
									options={ adapter.available_models.map( ( m ) => ( { label: m, value: m } ) ) }
									onChange={ ( value ) => {
										const next = value as string;
										setModel( next );
										onSaveModel( config, next );
									} }
								/>
								<div className="desc">
									{ __( 'Choose the model to use for AI responses.', 'vulopilot' ) }
								</div>
							</div>
						) }
					</div>

					{ needsReconnect && (
						<ButtonInput
							buttons={ {
								text: isSaving ? __( 'Saving…', 'vulopilot' ) : __( 'Save key', 'vulopilot' ),
								disabled: isSaving || '' === credential.trim(),
								onClick: () => onReconnect( config, credential ),
							} }
						/>
					) }

					<div className="ai-provider-card-footer">
						<div className={ `ai-provider-connection-status ${ needsReconnect ? 'is-error' : 'is-success' }` }>
							<i className={ `adminfont-${ needsReconnect ? 'warning' : 'check' }` } />
							{ __( 'Connection status:', 'vulopilot' ) }{ ' ' }
							<strong>
								{ needsReconnect
									? __( 'Needs reconnecting', 'vulopilot' )
									: __( 'Connected', 'vulopilot' ) }
							</strong>
						</div>
						<div className="ai-provider-card-actions">
							<ButtonInput
								wrapperClass="ai-provider-test-button"
								buttons={ {
									text: isTesting ? __( 'Testing…', 'vulopilot' ) : __( 'Test Connection', 'vulopilot' ),
									icon: 'refresh',
									disabled: isTesting || needsReconnect,
									onClick: handleTest,
								} }
							/>
							<button
								type="button"
								className="ai-provider-inline-action is-destructive"
								onClick={ () => onDisconnect( config ) }
							>
								{ __( 'Disconnect', 'vulopilot' ) }
							</button>
						</div>
					</div>

					{ testResult && (
						<p className={ `ai-provider-test-result ${ testResult.success ? 'is-success' : 'is-error' }` }>
							{ testResult.message }
						</p>
					) }
				</div>
			) }
		</div>
	);
};

/**
 * Settings → Connections → AI Providers.
 *
 * Moved here from the old top-level Settings → AI Providers tab, nested
 * under a new Connections folder alongside Webhooks/External Services —
 * same "folder of sub-tab files" shape Settings/Scanning/,
 * Settings/Notifications/, and Settings/Automation/ already use.
 *
 * Redesigned per direct instruction to match a mockup: Gemini and OpenAI
 * each get a fixed hero card (Enabled/Disabled toggle, API key, Model,
 * real Connection status, real Test Connection); every other registered
 * adapter (Anthropic, OpenRouter, Ollama, Groq, or anything
 * `vulopilot_ai_provider_sources` adds) stays in the original generic
 * `ExpandablePanelInput`-driven "Other providers" list this panel already
 * had, just scoped to exclude the two hero providers.
 *
 * "Test Connection" (`POST /ai-providers/{id}/test`,
 * Controllers\AiProviders::test_connection_item()) is new, real
 * functionality — previously there was no way to know a saved key actually
 * worked short of trying "Generate with AI" and possibly having a
 * different, still-working provider in the fallback chain quietly answer
 * instead. It reuses ProviderRegistry::build_provider() (rate-limited,
 * retried, usage-tracked — the exact real request path a generation call
 * takes) and sends the smallest real request that still proves the key
 * works.
 *
 * Hand-built rather than InputRenderer-driven, same escape hatch as
 * ImportExportPanel.tsx: AI provider configs live in their own
 * `vulopilot_ai_provider_configs` table (AI-ARCHITECTURE.md), not the flat
 * settings option row every other Settings tab auto-saves into.
 */
const AiProvidersPanel = () => {
	const [ configured, setConfigured ] = useState<ConfiguredProvider[]>( [] );
	const [ adapters, setAdapters ] = useState<Record<string, AdapterMeta>>( {} );
	const [ isLoading, setIsLoading ] = useState( true );
	const [ isSaving, setIsSaving ] = useState( false );
	const [ savingProviderId, setSavingProviderId ] = useState<string | null>( null );
	const [ isOtherProvidersOpen, setIsOtherProvidersOpen ] = useState( false );
	const [ newProviderValues, setNewProviderValues ] = useState<
		Record<string, Record<string, unknown>>
	>( {} );
	const [ newProviderPanelKey, setNewProviderPanelKey ] = useState( 0 );
	const newProviderValuesRef = useRef( newProviderValues );
	const isSavingRef = useRef( false );

	const load = () => {
		setIsLoading( true );

		getApiResponse<AiProvidersResponse>(
			getApiLink( appLocalizer, 'ai-providers' ),
			nonceHeaders
		)
			.then( ( response ) => {
				if ( ! response ) {
					return;
				}

				setConfigured( response.configured );
				setAdapters( response.adapters );
			} )
			.finally( () => setIsLoading( false ) );
	};

	useEffect( load, [] );

	const heroProviderIds = Object.keys( HERO_PROVIDERS ).filter( ( id ) => adapters[ id ] );
	const otherAdapterIds = Object.keys( adapters ).filter( ( id ) => ! HERO_PROVIDERS[ id ] );
	const otherConfigured = configured.filter( ( row ) => ! HERO_PROVIDERS[ row.provider ] );
	const otherUnconfiguredIds = otherAdapterIds.filter(
		( id ) => ! configured.some( ( row ) => row.provider === id )
	);
	const anyOtherActive = otherConfigured.some( ( row ) => row.is_active );

	const activeCount = configured.filter( ( row ) => row.is_active ).length;

	const genericUpdate = (
		id: number,
		data: Record<string, unknown>,
		successMessage: string,
		errorMessage: string
	) => {
		setIsSaving( true );

		return sendApiResponse( appLocalizer, getApiLink( appLocalizer, `ai-providers/${ id }` ), data )
			.then( ( response ) => {
				NoticeManager.add( {
					uniqueKey: `vulopilot-ai-provider-${ id }`,
					type: response ? 'success' : 'error',
					position: 'float',
					message: response ? successMessage : errorMessage,
				} );

				if ( response ) {
					load();
				}

				return response;
			} )
			.finally( () => setIsSaving( false ) );
	};

	/** Real `POST /ai-providers` connect, scoped to one hero provider's own card rather than the generic "Add a new provider" picker below. */
	const handleHeroConnect = ( providerId: string, credential: string, defaultModel: string ) => {
		if ( isSavingRef.current ) {
			return;
		}

		isSavingRef.current = true;
		setIsSaving( true );
		setSavingProviderId( providerId );

		sendApiResponse( appLocalizer, getApiLink( appLocalizer, 'ai-providers' ), {
			provider: providerId,
			credential,
			default_model: defaultModel,
		} )
			.then( ( response ) => {
				NoticeManager.add( {
					uniqueKey: 'vulopilot-ai-provider-add',
					type: response ? 'success' : 'error',
					position: 'float',
					message: response
						? __( 'AI provider connected.', 'vulopilot' )
						: __( 'Could not connect this provider — check the key and try again.', 'vulopilot' ),
				} );

				if ( response ) {
					load();
				}
			} )
			.finally( () => {
				isSavingRef.current = false;
				setIsSaving( false );
				setSavingProviderId( null );
			} );
	};

	const handleToggleActive = ( row: ConfiguredProvider ) => {
		genericUpdate(
			row.id,
			{ is_active: ! row.is_active },
			row.is_active ? __( 'Provider disabled.', 'vulopilot' ) : __( 'Provider enabled.', 'vulopilot' ),
			__( 'Could not update this provider.', 'vulopilot' )
		);
	};

	const handleSaveModel = ( row: ConfiguredProvider, model: string ) => {
		if ( '' === model || model === row.default_model ) {
			return;
		}

		genericUpdate(
			row.id,
			{ default_model: model },
			__( 'Default model updated.', 'vulopilot' ),
			__( 'Could not update the default model.', 'vulopilot' )
		);
	};

	/** Re-saves a configured provider's credential — re-encrypts under the site's CURRENT auth salt (see ConfiguredProvider's own `credential_ok` docblock) rather than requiring a full Disconnect + re-Add round trip. */
	const handleReconnect = ( row: ConfiguredProvider, credential: string ) => {
		if ( '' === credential.trim() ) {
			NoticeManager.add( {
				uniqueKey: 'vulopilot-ai-provider-reconnect',
				type: 'error',
				position: 'float',
				message: __( 'Enter the new API key first.', 'vulopilot' ),
			} );
			return;
		}

		genericUpdate(
			row.id,
			{ credential },
			__( 'AI provider reconnected.', 'vulopilot' ),
			__( 'Could not save this key — check it and try again.', 'vulopilot' )
		);
	};

	const handleDisconnect = ( row: ConfiguredProvider ) => {
		if (
			! window.confirm(
				__(
					'Remove this AI provider? Anything relying on it for AI fixes/generation will fall back to another configured provider, if any.',
					'vulopilot'
				)
			)
		) {
			return;
		}

		sendApiResponse( appLocalizer, getApiLink( appLocalizer, `ai-providers/${ row.id }/delete` ), {} ).then(
			( response ) => {
				NoticeManager.add( {
					uniqueKey: 'vulopilot-ai-provider-delete',
					type: response ? 'success' : 'error',
					position: 'float',
					message: response
						? __( 'AI provider removed.', 'vulopilot' )
						: __( 'Could not remove this provider.', 'vulopilot' ),
				} );

				if ( response ) {
					load();
				}
			}
		);
	};

	/** Real `POST /ai-providers/{id}/test` — see this file's own docblock. */
	const handleTest = ( row: ConfiguredProvider ) =>
		sendApiResponse<{ success: boolean; message: string }>(
			appLocalizer,
			getApiLink( appLocalizer, `ai-providers/${ row.id }/test` ),
			{}
		).then(
			( response ) =>
				response ?? {
					success: false,
					message: __( 'Could not reach the server to test this connection.', 'vulopilot' ),
				}
		);

	// --- "Other providers" — the original generic add/edit list, scoped
	// to exclude the two hero providers above.
	const handleAdd = ( provider: string ) => {
		if ( isSavingRef.current ) {
			return;
		}

		const values = newProviderValuesRef.current[ provider ] ?? {};

		isSavingRef.current = true;
		setIsSaving( true );

		sendApiResponse( appLocalizer, getApiLink( appLocalizer, 'ai-providers' ), {
			provider,
			label: values.label ?? '',
			credential: values.credential ?? '',
			default_model: values.default_model ?? '',
		} )
			.then( ( response ) => {
				NoticeManager.add( {
					uniqueKey: 'vulopilot-ai-provider-add',
					type: response ? 'success' : 'error',
					position: 'float',
					message: response
						? __( 'AI provider connected.', 'vulopilot' )
						: __( 'Could not connect this provider — check the key and try again.', 'vulopilot' ),
				} );

				if ( response ) {
					newProviderValuesRef.current = {};
					setNewProviderValues( {} );
					setNewProviderPanelKey( ( key ) => key + 1 );
					load();
				}
			} )
			.finally( () => {
				isSavingRef.current = false;
				setIsSaving( false );
			} );
	};

	const handleNewProviderChange = ( values: Record<string, Record<string, unknown>> ) => {
		newProviderValuesRef.current = values;
		setNewProviderValues( values );
	};

	const newProviderOptions = otherUnconfiguredIds.map( ( id ) => {
		const adapter = adapters[ id ];

		return {
			value: id,
			label: adapter.label,
			template: {
				icon: 'ai',
				label: adapter.label,
				desc: `<span class="admin-badge blue">${ __( 'Not connected', 'vulopilot' ) }</span><span class="vulopilot-provider-summary">${ __( 'Configure this provider with your own credentials.', 'vulopilot' ) }</span>`,
				formFields: [
					{
						key: 'label',
						type: 'text',
						label: __( 'Label', 'vulopilot' ),
						placeholder: adapter.label,
					},
					{
						key: 'credential',
						type: adapter.requires_credential ? 'password' : 'text',
						label: adapter.requires_credential ? __( 'API key', 'vulopilot' ) : __( 'Base URL', 'vulopilot' ),
						desc: adapter.requires_credential
							? undefined
							: __( 'Defaults to http://localhost:11434 if left blank.', 'vulopilot' ),
					},
					...( adapter.available_models.length > 0
						? [
								{
									key: 'default_model',
									type: 'select',
									label: __( 'Default model', 'vulopilot' ),
									options: adapter.available_models.map( ( model ) => ( {
										label: model,
										value: model,
									} ) ),
								},
							]
						: [] ),
					{
						key: 'connect',
						type: 'button',
						label: '',
						text: __( 'Connect provider', 'vulopilot' ),
						disabled: isSaving,
						onClick: () => handleAdd( id ),
					},
				],
			},
		};
	} );

	const otherConfiguredMethods = otherConfigured.map( ( row ) => {
		const providerLabel = row.label || adapters[ row.provider ]?.label || row.provider;
		const needsReconnect = ! row.credential_ok;
		const adapter = adapters[ row.provider ];

		return {
			id: row.provider,
			icon: 'ai',
			label: providerLabel,
			desc: needsReconnect
				? `<span class="admin-badge red">${ __( 'Needs reconnecting', 'vulopilot' ) }</span><span class="vulopilot-provider-summary">${ __( 'This provider stopped working — see below.', 'vulopilot' ) }</span>`
				: `<span class="vulopilot-provider-summary is-connected">${ __( 'Configured with your own credentials.', 'vulopilot' ) }</span>`,
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
							label: adapter?.requires_credential ? __( 'API key', 'vulopilot' ) : __( 'Base URL', 'vulopilot' ),
						},
						{
							key: 'reconnect',
							type: 'button',
							label: '',
							text: __( 'Save key', 'vulopilot' ),
							disabled: isSaving,
							onClick: () => handleReconnect( row, String( newProviderValuesRef.current[ row.provider ]?.credential ?? '' ) ),
						},
						{
							key: 'disconnect',
							type: 'button',
							label: '',
							text: __( 'Disconnect', 'vulopilot' ),
							icon: 'disconnect',
							onClick: () => handleDisconnect( row ),
						},
					]
				: [
						{
							key: 'provider_details',
							type: 'notice',
							label: '',
							noticeType: 'info',
							message: sprintf( __( 'Provider: %s', 'vulopilot' ), providerLabel ),
						},
						...( adapter && adapter.available_models.length > 0
							? [
									{
										key: 'default_model',
										type: 'select',
										label: __( 'Default model', 'vulopilot' ),
										options: adapter.available_models.map( ( model ) => ( {
											label: model,
											value: model,
										} ) ),
									},
									{
										key: 'save_model',
										type: 'button',
										label: '',
										text: __( 'Save model', 'vulopilot' ),
										disabled: isSaving,
										onClick: () =>
											handleSaveModel(
												row,
												String( newProviderValuesRef.current[ row.provider ]?.default_model ?? '' )
											),
									},
								]
							: [] ),
						{
							key: 'disconnect',
							type: 'button',
							label: '',
							text: __( 'Disconnect', 'vulopilot' ),
							icon: 'disconnect',
							onClick: () => handleDisconnect( row ),
						},
					],
		};
	} );

	const otherPanelValues = {
		...newProviderValues,
		...Object.fromEntries(
			otherConfigured.map( ( row ) => [
				row.provider,
				{
					...( newProviderValues[ row.provider ] ?? {} ),
					enable: true,
					title: row.label || adapters[ row.provider ]?.label || row.provider,
					default_model:
						newProviderValues[ row.provider ]?.default_model ?? row.default_model ?? '',
				},
			] )
		),
	};

	return (
		<div className="vulopilot-ai-providers-panel">
			<FormGroupWrapperComponent>
				{ isLoading ? (
					<div className="desc">{ __( 'Loading…', 'vulopilot' ) }</div>
				) : (
					<>
						{ heroProviderIds.map( ( providerId ) => (
							<ProviderCard
								key={ providerId }
								providerId={ providerId }
								adapter={ adapters[ providerId ] }
								config={ configured.find( ( row ) => row.provider === providerId ) ?? null }
								isSaving={ isSaving && savingProviderId === providerId }
								onConnect={ handleHeroConnect }
								onToggleActive={ handleToggleActive }
								onSaveModel={ handleSaveModel }
								onReconnect={ handleReconnect }
								onDisconnect={ handleDisconnect }
								onTest={ handleTest }
							/>
						) ) }

						<div className="ai-provider-card ai-provider-other-card">
							<div
								className="ai-provider-card-header is-clickable"
								onClick={ () => setIsOtherProvidersOpen( ( v ) => ! v ) }
							>
								<div className="ai-provider-card-icon">
									<i className="adminfont-ai" />
								</div>
								<div className="ai-provider-card-title">
									<strong>{ __( 'Other providers', 'vulopilot' ) }</strong>
									<span className="desc">
										{ __( 'Connect with other AI providers.', 'vulopilot' ) }
									</span>
								</div>
								{ /* Plain status text, not a ToggleInput — "Other providers" isn't
								 * one real row with its own is_active to flip; it's a derived
								 * "is anything in here active" summary, so a switch that looked
								 * interactive but didn't actually toggle anything would be
								 * misleading. Enabling/disabling a specific other provider still
								 * happens for real, per-row, once this section is expanded. */ }
								<span
									className={ `ai-provider-connection-status ${ anyOtherActive ? 'is-success' : '' }` }
								>
									{ anyOtherActive ? __( 'Enabled', 'vulopilot' ) : __( 'Disabled', 'vulopilot' ) }
								</span>
								<i className={ `adminfont-arrow-${ isOtherProvidersOpen ? 'up' : 'down' } ai-provider-expand-icon` } />
							</div>

							{ isOtherProvidersOpen && (
								<div className="ai-provider-card-body">
									<FormGroupComponent row label={ __( 'Add and configure other AI providers that are compatible with the OpenAI API format.', 'vulopilot' ) }>
										{ otherConfigured.length > 0 || newProviderOptions.length > 0 ? (
											<ExpandablePanelInput
												key={ `${ newProviderPanelKey }-${ otherConfigured.map( ( { id } ) => id ).join( '-' ) }` }
												name="ai-providers-other"
												methods={ otherConfiguredMethods }
												value={ otherPanelValues }
												onChange={ handleNewProviderChange }
												canAccess
												addNewBtn={ newProviderOptions.length > 0 }
												addNewTemplate={ {
													editableFields: { title: false, description: false },
												} }
												addNewOptions={ newProviderOptions }
											/>
										) : (
											<div className="desc">{ __( 'No other providers configured yet.', 'vulopilot' ) }</div>
										) }
									</FormGroupComponent>
								</div>
							) }
						</div>
					</>
				) }
			</FormGroupWrapperComponent>
			{ activeCount > 1 && (
				<div className="desc settings-metabox-description">
					{ sprintf(
						/* translators: %d is how many AI providers are currently active. */
						__(
							'%d providers are active — if the first one fails or is rate-limited, VuloPilot automatically retries with the next.',
							'vulopilot'
						),
						activeCount
					) }
				</div>
			) }
		</div>
	);
};

export default AiProvidersPanel;
