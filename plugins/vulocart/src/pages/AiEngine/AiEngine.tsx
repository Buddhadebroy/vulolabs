/* global vulocartLocalizer */
import { useEffect, useState } from '@wordpress/element';
import { applyFilters } from '@wordpress/hooks';
import type { ReactNode } from 'react';
import { __ } from '@wordpress/i18n';
import { getApiLink, getApiResponse } from '@zyra/core';
import { EngineScreen, type EngineView } from '../../components/EngineScreen/EngineScreen';
import { ProModuleHint } from '../Products/ProModuleHint';
import './ai-engine.scss';

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
	/** Old `&view=` values that point at this tool. */
	aliases: string[];
}

/** The assistant - the page's main column, like VuloPilot's AI Copilot chat. */
const CHAT: AiTool = {
	id: 'chat',
	module: 'support-ai',
	title: __( 'Chat with VuloCart AI', 'vulocart' ),
	description: __( 'Ask about your products, orders and customers in plain words.', 'vulocart' ),
	aliases: [ 'support' ],
};

/** Focused tools - the side column. */
const TOOLS: AiTool[] = [
	{ id: 'catalog', module: 'catalog-ai', title: __( 'Create a product with AI', 'vulocart' ), description: __( 'Describe it in a sentence; AI drafts the title, description and price.', 'vulocart' ), aliases: [ 'catalog' ] },
	{ id: 'checkout', module: 'checkout-ai', title: __( 'Checkout protection', 'vulocart' ), description: __( 'Every order is scored for fraud risk; risky ones wait for your review.', 'vulocart' ), aliases: [ 'checkout' ] },
	{ id: 'search', module: 'vector-search', title: __( 'Smart search', 'vulocart' ), description: __( 'Shoppers find products by meaning, not exact words.', 'vulocart' ), aliases: [ 'search' ] },
];

const pageHeader: EngineView = {
	title: __( 'AI Copilot', 'vulocart' ),
	description: __( 'Your store assistant: ask questions, draft products, catch risky orders and improve search - all in one place.', 'vulocart' ),
	icon: 'ai',
	module: 'ai',
};

/** One tool's card from its module, or - when the module isn't there - what's missing and the fix. */
function ToolSlot( { tool }: { tool: AiTool } ) {
	const card = applyFilters( 'vulocart_ai_view', null, { view: tool.id, layout: 'card' } ) as ReactNode;

	return (
		<section id={ `vulocart-ai-${ tool.id }` } className="vulocart-ai-slot">
			{ card || (
				<div className="vulocart-ai-card vulocart-ai-card--locked">
					<ProModuleHint module={ tool.module } title={ tool.title } description={ tool.description } />
				</div>
			) }
		</section>
	);
}

/**
 * AI Copilot - one page, laid out like VuloPilot's: the assistant chat in the main column, the focused AI tools
 * (product drafting, checkout protection, smart search) as cards beside it. Free owns the frame and the layout;
 * each card is registered by its vulocart-pro module into `vulocart_ai_view` (`layout: 'card'`). Connecting AI
 * (VuloCloud) is under Settings → Integrations; the header says whether it is connected.
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

	const status =
		null === connected ? null : (
			<a
				className={ `vulocart-ai-status ${ connected ? 'is-online' : 'is-offline' }` }
				href={ `${ vulocartLocalizer.adminUrl }admin.php?page=vulocart#&tab=settings&subtab=integrations` }
				title={ connected ? __( 'Connected to VuloCloud AI', 'vulocart' ) : __( 'Connect VuloCloud AI in Settings → Integrations', 'vulocart' ) }
			>
				<i aria-hidden="true" />
				{ connected ? __( 'Online', 'vulocart' ) : __( 'Offline - connect AI', 'vulocart' ) }
			</a>
		);

	return (
		<EngineScreen view={ pageHeader } headerExtra={ status }>
			<div className="vulocart-ai-grid">
				<div className="vulocart-ai-main">
					<ToolSlot tool={ CHAT } />
				</div>
				<aside className="vulocart-ai-side">
					{ TOOLS.map( ( tool ) => (
						<ToolSlot key={ tool.id } tool={ tool } />
					) ) }
				</aside>
			</div>
		</EngineScreen>
	);
}

export default AiEngine;
