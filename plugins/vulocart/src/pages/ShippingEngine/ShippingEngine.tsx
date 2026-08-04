import { applyFilters } from '@wordpress/hooks';
import { __ } from '@wordpress/i18n';

interface ShippingEngineProps {
	/** `zones`|`packaging`|`shipments`|`returns`|`pickup` (vulocart-pro's own ShippingEngine module) — anything else falls back to the empty state below. */
	view: string | null;
}

/**
 * Free owns this top-level menu's chrome only (Menu.php's own
 * `add_shipping_menu()` docblock) — same "Pro fills it in via a filtered
 * router" shape `InventoryEngine.tsx` already establishes for the
 * Inventory menu. Free's own flat-rate Shipping module has no admin
 * screen of its own (it's a Settings-tab toggle, not a page) — every real
 * view here is registered by vulocart-pro's ShippingEngine module.
 */
export function ShippingEngine( { view }: ShippingEngineProps ) {
	const resolvedView = view || 'zones';
	const extra = applyFilters( 'vulocart_shipping_view', null, { view: resolvedView } );

	if ( extra ) {
		return <>{ extra }</>;
	}

	return (
		<div className="vulocart-shipping-empty-state">
			<h1>{ __( 'Shipping', 'vulocart' ) }</h1>
			<p>
				{ __(
					'Zones, rates, packaging, shipments, labels, returns, and local pickup live in the Shipping Engine module — activate it from Modules to use this page.',
					'vulocart'
				) }
			</p>
		</div>
	);
}

export default ShippingEngine;
