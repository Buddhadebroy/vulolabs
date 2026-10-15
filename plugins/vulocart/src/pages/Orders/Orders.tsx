import { OrdersList } from './OrdersList';
import { OrderEdit } from './OrderEdit';
import { OrderAdd } from './OrderAdd';
import { renderEngineView } from '../../components/EngineScreen/EngineScreen';
import { ordersExtraViews } from '../Products/extraViews';

interface OrdersProps {
	action: string | null;
	id: number | null;
	filter: string | null;
	/** A Pro page in this menu (`subscriptions`); anything else is the orders list. */
	view?: string | null;
}

/**
 * Branches between the list, the manual "Add New" page, and the dedicated
 * order-detail page based on the `action`/`id`/`filter` query params
 * src/index.tsx parses from `location.search` on mount - see Menu.php's
 * `add_orders_menu()`/ProductsList.tsx's sibling docblock for why this is
 * query-string-driven rather than a client-side route or a popup: every
 * transition here is a real browser navigation to a distinct
 * `admin.php?page=vulocart-orders...` URL, matching WooCommerce's own
 * order edit screen. `filter` (`draft`/`refunds`) backs the "Draft
 * Orders"/"Refunds" submenus - passed straight through to OrdersList,
 * which turns it into the right `fulfillment_status`/`payment_status`
 * REST param.
 */
export function Orders( { action, id, filter, view }: OrdersProps ) {
	if ( view && ordersExtraViews[ view ] ) {
		return renderEngineView( 'vulocart_orders_view', ordersExtraViews, view );
	}

	if ( 'edit' === action && null !== id ) {
		return <OrderEdit id={ id } />;
	}

	if ( 'add' === action ) {
		return <OrderAdd />;
	}

	return <OrdersList filter={ filter } />;
}

export default Orders;
