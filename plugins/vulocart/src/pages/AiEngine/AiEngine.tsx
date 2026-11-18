/* global vulocartLocalizer */
import { useEffect, useState } from '@wordpress/element';
import { applyFilters } from '@wordpress/hooks';
import type { ReactNode } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import axios from 'axios';
import { getApiLink, getApiResponse } from '@zyra/core';
import { EngineScreen, ModuleRequired, type EngineView } from '../../components/EngineScreen/EngineScreen';
import MODULES_CATALOG, { isModuleCatalogEntry, moduleCardId } from '../../modules-config';
import './ai-engine.scss';
import { AI_SAMPLES } from './AiSamples';

interface AiEngineProps {
	/** An old tab link (`catalog`|`checkout`|`support`|`search`): the page scrolls to that tool. */
	view: string | null;
}

interface AiTool {
	/** Asked of `vulocart_ai_view` as `{ view: id, layout: 'card' }`. */
	id: string;
	/** Module that provides the card (`Modules::camel_to_kebab()` of its folder). */
	module: string;
	title: string;
	description: string;
	/** `adminfont-*` icon for the card shown while the tool's module is not there. */
	icon: string;
	/** Old `&view=` values that point at this tool. */
	aliases: string[];
}

/** The assistant: the main column of the page. */
const CHAT: AiTool = {
	id: 'chat',
	module: 'support-ai',
	title: __( 'Chat with VuloCart AI', 'vulocart' ),
	description: __( 'Ask about your products, orders and customers in plain words.', 'vulocart' ),
	icon: 'support',
	aliases: [ 'support' ],
};

/** Focused tools - the side column. */
const TOOLS: AiTool[] = [
	{ id: 'catalog', module: 'catalog-ai', title: __( 'Create a product with AI', 'vulocart' ), description: __( 'Describe it in a sentence; AI drafts the title, description and price.', 'vulocart' ), icon: 'add-product', aliases: [ 'catalog' ] },
	{ id: 'checkout', module: 'checkout-ai', title: __( 'Checkout protection', 'vulocart' ), description: __( 'Every order is scored for fraud risk; risky ones wait for your review.', 'vulocart' ), icon: 'security', aliases: [ 'checkout' ] },
	{ id: 'search', module: 'vector-search', title: __( 'Smart search', 'vulocart' ), description: __( 'Shoppers find products by meaning, not exact words.', 'vulocart' ), icon: 'search-discovery', aliases: [ 'search' ] },
];

const pageHeader: EngineView = {
	title: __( 'AI Copilot', 'vulocart' ),
	description: __( 'Ask about your store, draft products and catch risky orders.', 'vulocart' ),
	icon: 'ai',
	module: 'ai',
};

/** The card a tool's module registers, or null when that module is not there. */
const moduleCard = ( tool: AiTool ) => applyFilters( 'vulocart_ai_view', null, { view: tool.id, layout: 'card' } ) as ReactNode;

/**
 * A tool whose module is missing while the others are on (the AI modules switch together, so this is only a module the
 * loader dropped): the tool's card drawn with sample data, dimmed, with a
 * button over it that switches the module on - so the owner sees what they get before turning it on.
 */
function SampleSlot( { tool }: { tool: AiTool } ) {
	const [ busy, setBusy ] = useState( false );
	const [ failed, setFailed ] = useState( false );
	const moduleName = MODULES_CATALOG.modules.filter( isModuleCatalogEntry ).find( ( entry ) => entry.id === moduleCardId( tool.module ) )?.name;
	const Sample = AI_SAMPLES[ tool.id ];

	const activate = () => {
		setBusy( true );
		setFailed( false );

		axios
			.post( `${ vulocartLocalizer.apiUrl }/${ vulocartLocalizer.restUrl }/modules`, { id: tool.module, action: 'activate' }, { headers: { 'X-WP-Nonce': vulocartLocalizer.nonce } } )
			.then( () => window.location.reload() )
			.catch( () => {
				setBusy( false );
				setFailed( true );
			} );
	};

	return (
		<section id={ `vulocart-ai-${ tool.id }` } className="vulocart-ai-slot vulocart-ai-sample">
			<div className="vulocart-ai-sample-card" aria-hidden="true" { ...( { inert: true } as Record< string, unknown > ) }>
				<Sample />
			</div>
			<div className="vulocart-ai-sample-cta">
				<span className="vulocart-ai-sample-tag">{ __( 'Sample data', 'vulocart' ) }</span>
				<button type="button" className="vulocart-ai-button" disabled={ busy } onClick={ activate }>
					<i className="adminfont-ai" aria-hidden="true" />{ ' ' }
					{ busy
						? __( 'Turning on…', 'vulocart' )
						: moduleName
						? sprintf( /* translators: %s: module name. */ __( 'Turn on %s', 'vulocart' ), moduleName )
						: __( 'Turn on', 'vulocart' ) }
				</button>
				{ failed && <span className="vulocart-ai-sample-error">{ __( 'Could not turn this on. Try again from Settings → Modules.', 'vulocart' ) }</span> }
			</div>
		</section>
	);
}

/** The page's layout - the chat in the main column, the tools beside it - with whatever goes in each slot. */
const aiGrid = ( slots: ReactNode[] ) => (
	<div className="vulocart-ai-grid">
		<div className="vulocart-ai-main">{ slots[ 0 ] }</div>
		<aside className="vulocart-ai-side">{ slots.slice( 1 ) }</aside>
	</div>
);

/**
 * AI screen: the assistant chat in the main column and the focused AI tools (product drafting, checkout protection,
 * smart search) as cards beside it. The free plugin owns the frame and the layout; each card is registered by its
 * vulocart-pro module into `vulocart_ai_view` (`layout: 'card'`). Connecting AI (VuloCloud) is under Settings →
 * Integrations; the header says whether it is connected.
 */
export function AiEngine( { view }: AiEngineProps ) {
	const [ connected, setConnected ] = useState< boolean | null >( null );

	useEffect( () => {
		getApiResponse< { vulocloud_status: { connected: boolean } } >( getApiLink( vulocartLocalizer, 'vulocloud-ai-connection' ), {
			headers: { 'X-WP-Nonce': vulocartLocalizer.nonce },
		} ).then( ( response ) => setConnected( !! response?.vulocloud_status?.connected ) );
	}, [] );

	// Old tab links land on the matching tool.
	useEffect( () => {
		const tool = [ CHAT, ...TOOLS ].find( ( candidate ) => view && candidate.aliases.includes( view ) );

		if ( tool && 'chat' !== tool.id ) {
			window.setTimeout( () => document.getElementById( `vulocart-ai-${ tool.id }` )?.scrollIntoView( { behavior: 'smooth', block: 'start' } ), 400 );
		}
	}, [ view ] );

	const licensed = !! vulocartLocalizer.khali_dabba;
	const tools = [ CHAT, ...TOOLS ];
	const cards = tools.map( ( tool ) => ( { tool, card: moduleCard( tool ) } ) );
	const anyAvailable = cards.some( ( { card } ) => !! card );

	// Without Pro, without a license, or with the AI modules off (one "AI" card switches all four), every tool is
	// locked for the same reason: the whole page is drawn with sample data behind one card that says so, as on the
	// other Pro pages. `support-ai` stands for the group - activating it turns the whole card on.
	if ( ! licensed || ! anyAvailable ) {
		const samples = tools.map( ( tool ) => {
			const Sample = AI_SAMPLES[ tool.id ];

			return (
				<section key={ tool.id } className="vulocart-ai-slot">
					<Sample />
				</section>
			);
		} );

		return (
			<EngineScreen view={ pageHeader }>
				<ModuleRequired view={ { ...pageHeader, module: CHAT.module, pro: true } } previewNode={ aiGrid( samples ) } />
			</EngineScreen>
		);
	}

	// Whether VuloCloud AI is connected only matters once there is a tool to use it.
	const status =
		null === connected ? null : (
			<a
				className={ `vulocart-ai-status ${ connected ? 'is-online' : 'is-offline' }` }
				href={ `${ vulocartLocalizer.adminUrl }admin.php?page=vulocart#&tab=settings&subtab=integrations` }
				title={ connected ? __( 'Connected to VuloCloud AI', 'vulocart' ) : __( 'Connect VuloCloud AI in Settings → Integrations', 'vulocart' ) }
			>
				<i aria-hidden="true" />
				{ connected ? __( 'AI connected', 'vulocart' ) : __( 'Connect AI', 'vulocart' ) }
			</a>
		);

	return (
		<EngineScreen view={ pageHeader } headerExtra={ status }>
			{ aiGrid(
				cards.map( ( { tool, card } ) =>
					card ? (
						<section key={ tool.id } id={ `vulocart-ai-${ tool.id }` } className="vulocart-ai-slot">
							{ card }
						</section>
					) : (
						<SampleSlot key={ tool.id } tool={ tool } />
					)
				)
			) }
		</EngineScreen>
	);
}

export default AiEngine;
