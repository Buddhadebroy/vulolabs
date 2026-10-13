import { __ } from '@wordpress/i18n';
import { renderEngineView, type EngineView } from '../../components/EngineScreen/EngineScreen';
import { InventoryPage } from '../Inventory/InventoryPage';
import { inventoryExtraViews } from '../Offerings/extraViews';

interface InventoryEngineProps {
	/** `warehouses`|`purchase-orders`|`transfers`|`reservations`|`stock-alerts`|`history`|`forecasting` (vulocart-pro's own Inventory module) - anything else shows the first one. */
	view: string | null;
}

const moduleId = 'inventory';

const views: Record< string, EngineView > = {
	...inventoryExtraViews,
	warehouses: {
		title: __( 'Warehouses', 'vulocart' ),
		description: __( 'Every stock location this store fulfills from - orders decrement from the default warehouse.', 'vulocart' ),
		icon: 'store-inventory',
		module: moduleId,
		pro: true,
	},
	'purchase-orders': {
		title: __( 'Purchase Orders', 'vulocart' ),
		description: __( 'Order stock from suppliers and receive it into a warehouse.', 'vulocart' ),
		icon: 'cart',
		module: moduleId,
		pro: true,
	},
	transfers: {
		title: __( 'Transfers', 'vulocart' ),
		description: __( 'Move stock between warehouses.', 'vulocart' ),
		icon: 'store-inventory',
		module: moduleId,
		pro: true,
	},
	reservations: {
		title: __( 'Reservations', 'vulocart' ),
		description: __( 'Hold stock for an order or customer so it cannot be sold twice.', 'vulocart' ),
		icon: 'store-inventory',
		module: moduleId,
		pro: true,
	},
	'stock-alerts': {
		title: __( 'Stock Alerts', 'vulocart' ),
		description: __( 'Offerings that are low on stock or out of stock.', 'vulocart' ),
		icon: 'store-inventory',
		module: moduleId,
		pro: true,
	},
	history: {
		title: __( 'Inventory History', 'vulocart' ),
		description: __( 'Every stock-affecting event across every offering and warehouse, most recent first.', 'vulocart' ),
		icon: 'store-inventory',
		module: moduleId,
		pro: true,
	},
	forecasting: {
		title: __( 'Forecasting', 'vulocart' ),
		description: __( 'Projected days of stock remaining, based on each offering\'s sales rate over the trailing 30 days.', 'vulocart' ),
		icon: 'store-inventory',
		module: moduleId,
		pro: true,
	},
};

/**
 * Free owns this top-level menu's frame only - every real view is registered by vulocart-pro's
 * Inventory module into `vulocart_inventory_view`. With no module (or no license) the view shows
 * the "module required" state instead of an empty page.
 */
export function InventoryEngine( { view }: InventoryEngineProps ) {
	// Free's own simple stock-level editor; every other view is a vulocart-pro page.
	if ( ! view || 'stock' === view ) {
		return <InventoryPage />;
	}

	return renderEngineView( 'vulocart_inventory_view', views, views[ view ] ? view : 'warehouses' );
}

export default InventoryEngine;
