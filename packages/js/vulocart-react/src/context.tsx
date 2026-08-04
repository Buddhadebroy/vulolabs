import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { getConfig, init } from '@vulocart/sdk';
import type { SdkConfig } from '@vulocart/sdk';

interface VuloCartContextValue {
	storeUrl: string;
	config: SdkConfig | null;
}

const VuloCartContext = createContext< VuloCartContextValue | null >( null );

export interface VuloCartProviderProps {
	/** Origin of the WordPress site running VuloCart, e.g. `https://mystore.com`. */
	storeUrl: string;
	children: ReactNode;
}

/**
 * Boots `@vulocart/sdk` once for the whole React tree —
 * `skipAutoScan: true` (index.ts's own `InitOptions`) since this adapter
 * never uses `data-vulocart-*` DOM scanning at all; every widget below is
 * a real React component managing its own state/render, not the vanilla
 * core's imperative DOM widgets. Required for a Next.js app, which has no
 * single `<script>` tag for the SDK core to auto-discover its own store
 * from (the vanilla core's `auto.ts` trick, `@vulocart/sdk`'s own
 * README) — `storeUrl` is explicit here for exactly that reason.
 */
export function VuloCartProvider( { storeUrl, children }: VuloCartProviderProps ) {
	const [ config, setConfig ] = useState< SdkConfig | null >( null );

	useEffect( () => {
		init( { storeUrl, skipAutoScan: true } );
		getConfig()
			.then( setConfig )
			.catch( () => undefined );
	}, [ storeUrl ] );

	return <VuloCartContext.Provider value={ { storeUrl, config } }>{ children }</VuloCartContext.Provider>;
}

export function useVuloCart(): VuloCartContextValue {
	const context = useContext( VuloCartContext );

	if ( ! context ) {
		throw new Error( '@vulocart/react components must be rendered inside a <VuloCartProvider storeUrl="...">.' );
	}

	return context;
}
