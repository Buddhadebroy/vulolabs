import { applyFilters } from '@wordpress/hooks';
import { __ } from '@wordpress/i18n';

interface InventoryEngineProps {
	/** `warehouses`|`purchase-orders`|`transfers`|`reservations`|`stock-alerts`|`history`|`forecasting` (vulocart-pro's own Inventory module) — anything else falls back to the empty state below. */
	view: string | null;
}

/**
 * Free owns this top-level menu's chrome only (Menu.php's own
 * `add_inventory_menu()` docblock) — every real view is registered by
 * vulocart-pro's Inventory module into `vulocart_inventory_view`, the same
 * "Pro extends Free via a filtered router" shape `vulocart_offerings_extra_view`/
 * `vulocart_customers_extra_view` already establish. Unlike those two, there
 * is no Free-owned fallback list to show when nothing matches — Free has no
 * Inventory-engine entity of its own — so an unmatched/missing view (module
 * not active, or a fresh install with no `view` yet) shows a plain
 * activation prompt instead of silently rendering nothing.
 */
export function InventoryEngine( { view }: InventoryEngineProps ) {
	const resolvedView = view || 'warehouses';
	const extra = applyFilters( 'vulocart_inventory_view', null, { view: resolvedView } );

	if ( extra ) {
		return <>{ extra }</>;
	}

	return (
		<div className="vulocart-inventory-empty-state">
			<h1>{ __( 'Inventory', 'vulocart' ) }</h1>
			<p>
				{ __(
					'Warehouses, purchase orders, transfers, reservations, batch/serial tracking, and forecasting live in the Inventory module — activate it from Modules to use this page.',
					'vulocart'
				) }
			</p>
		</div>
	);
}

export default InventoryEngine;
