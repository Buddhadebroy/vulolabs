/* global vulocartLocalizer */
import { useEffect, useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import axios from 'axios';
import { CardComponent } from '@zyra/components';

interface SdkConfig {
	siteUrl: string;
	features: {
		popupCheckout: boolean;
		drawerCheckout: boolean;
	};
}

type Mode = 'buy-button' | 'embedded-cart' | 'embedded-checkout' | 'popup-checkout-trigger' | 'drawer-checkout-trigger';

const client = axios.create( {
	baseURL: `${ vulocartLocalizer.apiUrl }/${ vulocartLocalizer.restUrl }`,
} );

/**
 * "Generate embed code automatically" (Phase 4's own requirement) — a
 * Free-tier section on the Offering edit page (rendered directly, not
 * through `vulocart_offering_edit_sections` — that filter is Free's own
 * extension point FOR Pro, this is Free's own baseline UI, same posture
 * Shipping Estimation's own inline addition to Checkout.tsx already
 * takes). Buy Button is the only mode that's genuinely offering-specific
 * (needs this offering's own id); Embedded Cart/Embedded Checkout/Popup/
 * Drawer all trigger off the shopper's ambient cart, so their snippets
 * are the same regardless of which offering page you're looking at —
 * shown here anyway, for convenience, since this is the natural place a
 * merchant is already looking when they want to start selling something.
 * Popup/Drawer only appear when their own Pro module is active — read
 * from `GET /sdk/config`'s own `features` flags (Sdk.php), the same
 * capability check the SDK itself uses, rather than a second, separate
 * "is this Pro module active" query this component would otherwise need.
 */
export function EmbedCodeSection( { offeringId }: { offeringId: number } ) {
	const [ config, setConfig ] = useState< SdkConfig | null >( null );
	const [ mode, setMode ] = useState< Mode >( 'buy-button' );
	const [ copied, setCopied ] = useState< 'html' | 'react' | null >( null );

	useEffect( () => {
		client.get< SdkConfig >( '/sdk/config' ).then( ( response ) => setConfig( response.data ) );
	}, [] );

	if ( ! config ) {
		return null;
	}

	const scriptTag = `<script src="${ config.siteUrl }wp-content/plugins/vulocart/assets/js/vulocart-sdk.js"></script>`;

	const snippets: Record< Mode, { label: string; html: string; react: string; available: boolean } > = {
		'buy-button': {
			label: __( 'Buy Button', 'vulocart' ),
			html: `${ scriptTag }\n<button data-vulocart-buy-button data-offering-id="${ offeringId }">Buy Now</button>`,
			react: `import { BuyButton } from '@vulocart/react';\n\n<BuyButton offeringId={ ${ offeringId } }>Buy Now</BuyButton>`,
			available: true,
		},
		'embedded-cart': {
			label: __( 'Embedded Cart', 'vulocart' ),
			html: `${ scriptTag }\n<div data-vulocart-embedded-cart></div>`,
			react: `import { EmbeddedCart } from '@vulocart/react';\n\n<EmbeddedCart />`,
			available: true,
		},
		'embedded-checkout': {
			label: __( 'Embedded Checkout', 'vulocart' ),
			html: `${ scriptTag }\n<div data-vulocart-embedded-checkout></div>`,
			react: `import { EmbeddedCheckout } from '@vulocart/react';\n\n<EmbeddedCheckout cartToken={ cartToken } />`,
			available: true,
		},
		'popup-checkout-trigger': {
			label: __( 'Popup Checkout (Pro)', 'vulocart' ),
			html: `${ scriptTag }\n<button data-vulocart-popup-checkout-trigger>Checkout</button>`,
			react: __( 'Not available as a React component yet — use the HTML snippet.', 'vulocart' ),
			available: config.features.popupCheckout,
		},
		'drawer-checkout-trigger': {
			label: __( 'Drawer Checkout (Pro)', 'vulocart' ),
			html: `${ scriptTag }\n<button data-vulocart-drawer-checkout-trigger>Checkout</button>`,
			react: __( 'Not available as a React component yet — use the HTML snippet.', 'vulocart' ),
			available: config.features.drawerCheckout,
		},
	};

	const availableModes = ( Object.keys( snippets ) as Mode[] ).filter( ( key ) => snippets[ key ].available );
	const activeMode = availableModes.includes( mode ) ? mode : availableModes[ 0 ];
	const active = snippets[ activeMode ];

	const copy = ( kind: 'html' | 'react', text: string ) => {
		navigator.clipboard.writeText( text ).then( () => {
			setCopied( kind );
			setTimeout( () => setCopied( null ), 2000 );
		} );
	};

	return (
		<CardComponent title={ __( 'Embed code', 'vulocart' ) }>
			<div className="vulocart-embed-code-section">
				<p className="vulocart-field-hint">
					{ __( 'Sell this offering anywhere — a landing page, a Next.js app, plain HTML — with the VuloCart SDK.', 'vulocart' ) }
				</p>

				<div className="vulocart-embed-code-modes">
					{ availableModes.map( ( key ) => (
						<button
							key={ key }
							type="button"
							className={ key === activeMode ? 'is-active' : '' }
							onClick={ () => setMode( key ) }
						>
							{ snippets[ key ].label }
						</button>
					) ) }
				</div>

				<div className="vulocart-embed-code-block">
					<div className="vulocart-embed-code-block-header">
						<span>{ __( 'Plain HTML / any site', 'vulocart' ) }</span>
						<button type="button" onClick={ () => copy( 'html', active.html ) }>
							{ 'html' === copied ? __( 'Copied!', 'vulocart' ) : __( 'Copy', 'vulocart' ) }
						</button>
					</div>
					<pre>{ active.html }</pre>
				</div>

				<div className="vulocart-embed-code-block">
					<div className="vulocart-embed-code-block-header">
						<span>{ __( 'React / Next.js (@vulocart/react)', 'vulocart' ) }</span>
						<button type="button" onClick={ () => copy( 'react', active.react ) }>
							{ 'react' === copied ? __( 'Copied!', 'vulocart' ) : __( 'Copy', 'vulocart' ) }
						</button>
					</div>
					<pre>{ active.react }</pre>
				</div>
			</div>
		</CardComponent>
	);
}
