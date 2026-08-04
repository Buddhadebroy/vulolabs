import { applyFilters } from '@wordpress/hooks';
import { ProvidersSettings } from './ProvidersSettings';

interface AiEngineProps {
	/** `settings` (this module's own BYOK config screen) or one of `catalog`|`checkout`|`support`|`search` (vulocart-pro's own AI feature modules) — anything else falls back to Settings. */
	view: string | null;
}

/**
 * Free owns this top-level menu's chrome AND its own "Settings" view
 * (BYOK provider configuration, `ProvidersSettings` — the real API-key
 * screen the `Ai` module's original docblock always intended to slot in
 * here) — same "Pro fills it in via a filtered router" shape
 * `ShippingEngine.tsx`/`InventoryEngine.tsx` already establish for their
 * own top-level menus, just with one view Free itself owns rather than
 * zero.
 */
export function AiEngine( { view }: AiEngineProps ) {
	const resolvedView = view || 'settings';

	if ( 'settings' === resolvedView ) {
		return <ProvidersSettings />;
	}

	const extra = applyFilters( 'vulocart_ai_view', null, { view: resolvedView } );

	if ( extra ) {
		return <>{ extra }</>;
	}

	return <ProvidersSettings />;
}

export default AiEngine;
