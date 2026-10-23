import { __ } from '@wordpress/i18n';
import type { EngineView } from '../../components/EngineScreen/EngineScreen';
import { EngineTabs } from '../../components/EngineScreen/EngineTabs';
import { InventoryOverview } from './InventoryOverview';
import { InventoryPage } from '../Inventory/InventoryPage';
import { inventoryExtraViews } from '../Products/extraViews';

interface InventoryEngineProps {
	/** `overview`|`stock`|`warehouses`|`purchase-orders`|`transfers`|`reservations`|`suppliers`|`history` (vulocart-pro's own Inventory module) - anything else shows the first one. */
	view: string | null;
}

const moduleId = 'inventory';

const views: Record< string, EngineView > = {
	overview: {
		title: __( 'Overview', 'vulocart' ),
		description: __( 'Where stock stands, what needs attention, and what will run out next.', 'vulocart' ),
		icon: 'store-inventory',
		module: moduleId,
	},
	stock: {
		title: __( 'Stock Levels', 'vulocart' ),
		description: __( 'Stock for every physical, rental, bundle and gift card product.', 'vulocart' ),
		icon: 'store-inventory',
		module: moduleId,
	},
	warehouses: {
		title: __( 'Warehouses', 'vulocart' ),
		description: __( 'Every stock location this store fulfills from - orders decrement from the default warehouse.', 'vulocart' ),
		icon: 'store-inventory',
		module: moduleId,
		pro: true,
	},
	...inventoryExtraViews,
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
	history: {
		title: __( 'Inventory History', 'vulocart' ),
		description: __( 'Every stock-affecting event across every product and warehouse, most recent first.', 'vulocart' ),
		icon: 'store-inventory',
		module: moduleId,
		pro: true,
	},
};

const pageHeader: EngineView = {
	title: __( 'Inventory', 'vulocart' ),
	description: __( 'Stock levels, warehouses, suppliers, purchase orders and transfers.', 'vulocart' ),
	icon: 'store-inventory',
	module: moduleId,
};

/**
 * One Inventory page with a tab per area. Free owns the frame, the Overview dashboard and the Stock Levels tab; every other tab is
 * registered by vulocart-pro's Inventory and Suppliers modules into `vulocart_inventory_view`. With no
 * module (or no license) a tab shows the "module required" state instead of an empty page.
 */
export function InventoryEngine( { view }: InventoryEngineProps ) {
	return <EngineTabs header={ pageHeader } views={ views } filterName="vulocart_inventory_view" view={ view } own={ { overview: <InventoryOverview />, stock: <InventoryPage embedded /> } } />;
}

export default InventoryEngine;
