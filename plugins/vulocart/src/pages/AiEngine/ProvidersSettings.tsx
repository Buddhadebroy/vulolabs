/* global vulocartLocalizer */
import { useEffect, useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import axios from 'axios';

const client = axios.create( {
	baseURL: `${ vulocartLocalizer.apiUrl }/${ vulocartLocalizer.restUrl }`,
	headers: { 'X-WP-Nonce': vulocartLocalizer.nonce },
} );

interface ProviderRow {
	id: string;
	label: string;
	available_models: string[];
	is_configured: boolean;
	model: string;
	is_active: boolean;
}

interface UsageSummary {
	total_calls: number;
	total_prompt_tokens: number;
	total_completion_tokens: number;
	failed_calls: number;
}

/**
 * The BYOK provider configuration screen — pick a provider, choose a
 * model, paste an API key (never re-displayed once saved,
 * `Rest::get_providers()` only ever returns `is_configured`, not the
 * key itself), and toggle it active. Only one provider is meant to be
 * active at a time (`ProviderRegistry::get_active_provider()`'s own
 * docblock) — activating a second one here doesn't deactivate the
 * first automatically, matching that the backend takes whichever active
 * row it finds first rather than enforcing single-select itself.
 */
export function ProvidersSettings() {
	const [ providers, setProviders ] = useState< ProviderRow[] >( [] );
	const [ usage, setUsage ] = useState< UsageSummary | null >( null );
	const [ apiKeys, setApiKeys ] = useState< Record< string, string > >( {} );
	const [ models, setModels ] = useState< Record< string, string > >( {} );
	const [ status, setStatus ] = useState< Record< string, 'idle' | 'saving' | 'saved' | 'error' > >( {} );

	const load = () => {
		client.get< ProviderRow[] >( '/ai/providers' ).then( ( r ) => {
			setProviders( r.data );

			const initialModels: Record< string, string > = {};
			r.data.forEach( ( provider ) => {
				initialModels[ provider.id ] = provider.model || provider.available_models[ 0 ] || '';
			} );
			setModels( ( prev ) => ( { ...initialModels, ...prev } ) );
		} );
		client.get< { summary: UsageSummary } >( '/ai/usage' ).then( ( r ) => setUsage( r.data.summary ) );
	};

	useEffect( load, [] );

	const save = ( provider: ProviderRow ) => {
		setStatus( ( prev ) => ( { ...prev, [ provider.id ]: 'saving' } ) );

		client
			.post( `/ai/providers/${ provider.id }`, {
				api_key: apiKeys[ provider.id ] || '',
				model: models[ provider.id ] || provider.available_models[ 0 ],
				is_active: true,
			} )
			.then( () => {
				setStatus( ( prev ) => ( { ...prev, [ provider.id ]: 'saved' } ) );
				setApiKeys( ( prev ) => ( { ...prev, [ provider.id ]: '' } ) );
				load();
			} )
			.catch( () => setStatus( ( prev ) => ( { ...prev, [ provider.id ]: 'error' } ) ) );
	};

	const remove = ( provider: ProviderRow ) => {
		client.delete( `/ai/providers/${ provider.id }` ).then( load );
	};

	return (
		<div className="vulocart-ai-settings">
			<h1>{ __( 'AI', 'vulocart' ) }</h1>
			<p className="vulocart-ai-settings-subtitle">
				{ __( 'Connect your own OpenAI or Anthropic API key to power Catalog AI, Checkout AI, Support AI, and Vector Search.', 'vulocart' ) }
			</p>

			{ providers.map( ( provider ) => (
				<div className="card-content" key={ provider.id }>
					<div className="card-header">
						<div className="left">
							<div className="title">
								{ provider.label }
								{ provider.is_configured && provider.is_active && (
									<span className="vulocart-ai-badge vulocart-ai-badge-active">{ __( 'Active', 'vulocart' ) }</span>
								) }
							</div>
						</div>
						{ provider.is_configured && (
							<div className="right">
								<a href="#remove" onClick={ ( e ) => { e.preventDefault(); remove( provider ); } }>{ __( 'Remove', 'vulocart' ) }</a>
							</div>
						) }
					</div>
					<div className="card-body">
						<label>{ __( 'Model', 'vulocart' ) }</label>
						<select
							value={ models[ provider.id ] || '' }
							onChange={ ( e ) => setModels( ( prev ) => ( { ...prev, [ provider.id ]: e.target.value } ) ) }
						>
							{ provider.available_models.map( ( model ) => <option key={ model } value={ model }>{ model }</option> ) }
						</select>
						<label>{ __( 'API key', 'vulocart' ) }</label>
						<input
							type="password"
							placeholder={ provider.is_configured ? __( '••••••••  (leave blank to keep the current key)', 'vulocart' ) : __( 'sk-...', 'vulocart' ) }
							value={ apiKeys[ provider.id ] || '' }
							onChange={ ( e ) => setApiKeys( ( prev ) => ( { ...prev, [ provider.id ]: e.target.value } ) ) }
						/>
						<button type="button" onClick={ () => save( provider ) }>
							{ 'saving' === status[ provider.id ] ? __( 'Saving…', 'vulocart' ) : __( 'Save', 'vulocart' ) }
						</button>
						{ 'saved' === status[ provider.id ] && <span className="vulocart-ai-status-ok">{ __( 'Saved', 'vulocart' ) }</span> }
						{ 'error' === status[ provider.id ] && <span className="vulocart-ai-status-error">{ __( 'Could not save.', 'vulocart' ) }</span> }
					</div>
				</div>
			) ) }

			{ usage && (
				<div className="card-content">
					<div className="card-header">
						<div className="left"><div className="title">{ __( 'Usage', 'vulocart' ) }</div></div>
					</div>
					<div className="card-body">
						<p>
							{ __( 'Calls made:', 'vulocart' ) } { usage.total_calls } · { __( 'Failed:', 'vulocart' ) } { usage.failed_calls } · { __( 'Prompt tokens:', 'vulocart' ) } { usage.total_prompt_tokens } · { __( 'Completion tokens:', 'vulocart' ) } { usage.total_completion_tokens }
						</p>
					</div>
				</div>
			) }
		</div>
	);
}

export default ProvidersSettings;
