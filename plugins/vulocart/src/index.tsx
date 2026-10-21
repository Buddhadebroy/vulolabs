/* global vulocartLocalizer */
import { render } from '@wordpress/element';
import { BrowserRouter } from 'react-router-dom';
import { configureZyra, initializeModules } from '@zyra/core';
import SearchHeader from './components/Header/SearchHeader';
import { App } from './app/App';
import Orders from './pages/Orders/Orders';
import Products from './pages/Products/Products';
import Customers from './pages/Customers/Customers';
import InventoryEngine from './pages/InventoryEngine/InventoryEngine';
import MarketingEngine from './pages/MarketingEngine/MarketingEngine';
import FulfillmentEngine from './pages/FulfillmentEngine/FulfillmentEngine';
import AiEngine from './pages/AiEngine/AiEngine';
import WorkflowsEngine from './pages/WorkflowsEngine/WorkflowsEngine';
import { registerRestErrorToasts } from './lib/rest-errors';

/**
 * Entry point of the admin app.
 *
 * The main menu mounts into `#admin-main-wrapper` (classes/Admin/Menu.php). The other screens (Orders, Products,
 * Customers, Inventory, Shipping, AI, Workflows, Marketing) mount the same bundle into root elements printed by PHP
 * (`#vulocart-orders-admin-root`, `#vulocart-products-admin-root`, ...). `standaloneRoot()` renames them to
 * `#admin-main-wrapper` at mount time so the shared layout rules (full-height page, `#wpcontent` padding reset)
 * apply. There is a single webpack entry; this file renders a different tree for each root.
 *
 * Orders and Products read `action` and `id` from `window.location.search` once, when they mount. Moving between
 * list, add and edit is a full page load to a different `admin.php?page=...` URL (plain links), so reading the URL on
 * every load is correct.
 *
 * `configureZyra()` gives zyra the localized settings (apiUrl, restUrl, nonce, khali_dabba and so on; see
 * global.d.ts). `initializeModules()` seeds zyra's `useModules()` store with the active module list.
 *
 * The app uses `BrowserRouter`, not `HashRouter`, because App.tsx reads the raw `location.hash` (`#&tab=...`) itself.
 *
 * Every `render()` runs inside `mount()` on `DOMContentLoaded`, not when the script is evaluated.
 * `vulocart-pro-admin` depends on `vulocart-admin`, so WordPress prints this script's tag first. If the app rendered
 * immediately, the first render would call `applyFilters()` before Pro's bundle had registered its filters, and every
 * Pro view (Suppliers, Groups and Segments, the Inventory and Fulfillment screens) would be missing with no second
 * chance, because nothing re-renders when a filter is added. `DOMContentLoaded` fires only after the parser has run
 * every parser-blocking script, including Pro's.
 */
localStorage.setItem( 'force_vulocart_context_reload', 'true' );

configureZyra( vulocartLocalizer );
registerRestErrorToasts();
initializeModules( 'vulocart', 'free', 'modules' );

/**
 * Finds a standalone screen's mount point and gives it the identity of the main app's: id
 * `admin-main-wrapper` and class `admin-main-wrapper`. zyra's shared layout rules key off exactly
 * that (`#wpcontent:has(#admin-main-wrapper)` removes WordPress's own padding and sets the page
 * background, `#admin-main-wrapper` makes the page full height, `.admin-main-wrapper` carries the
 * font and form-control styles), so a root with any other id gets a header pushed in from the edge,
 * a grey page and unstyled controls. The screens are found by their own ids (Pro modules print the
 * same ones), then renamed here, so no PHP that prints a root has to change. A page has one screen,
 * so the id stays unique.
 *
 * @param id The root's id as printed by PHP.
 */
const standaloneRoot = ( id: string ) => {
	const root = document.getElementById( id );

	if ( root ) {
		root.id = 'admin-main-wrapper';
		root.classList.add( 'admin-main-wrapper' );
		root.dataset.vulocartScreen = id.replace( /^vulocart-|-admin-root$/g, '' );
	}

	return root;
};

const adminRoot = document.getElementById( 'admin-main-wrapper' );
const ordersAdminRoot = standaloneRoot( 'vulocart-orders-admin-root' );
const productsAdminRoot = standaloneRoot( 'vulocart-products-admin-root' );
const customersAdminRoot = standaloneRoot( 'vulocart-customers-admin-root' );
const inventoryAdminRoot = standaloneRoot( 'vulocart-inventory-admin-root' );
const shippingAdminRoot = standaloneRoot( 'vulocart-shipping-admin-root' );
const aiAdminRoot = standaloneRoot( 'vulocart-ai-admin-root' );
const workflowsAdminRoot = standaloneRoot( 'vulocart-workflows-admin-root' );
const marketingAdminRoot = standaloneRoot( 'vulocart-marketing-admin-root' );

const urlParams = new URLSearchParams( window.location.search );
const urlAction = urlParams.get( 'action' );
const urlId = urlParams.get( 'id' ) ? Number( urlParams.get( 'id' ) ) : null;
const urlFilter = urlParams.get( 'filter' );
const urlView = urlParams.get( 'view' );

/** Mounts the React admin app into the root element of the current VuloCart admin screen. */
function mount() {

if ( adminRoot ) {
	render(
		<BrowserRouter>
			<App />
		</BrowserRouter>,
		adminRoot
	);
}

if ( ordersAdminRoot ) {
	render(
		<>
			<SearchHeader />
			<Orders action={ urlAction } id={ urlId } filter={ urlFilter } view={ urlView } />
		</>,
		ordersAdminRoot
	);
}

if ( productsAdminRoot ) {
	render(
		<>
			<SearchHeader />
			<Products action={ urlAction } id={ urlId } view={ urlView } />
		</>,
		productsAdminRoot
	);
}

if ( customersAdminRoot ) {
	render(
		<>
			<SearchHeader />
			<Customers action={ urlAction } id={ urlId } view={ urlView } />
		</>,
		customersAdminRoot
	);
}

if ( inventoryAdminRoot ) {
	render(
		<>
			<SearchHeader />
			<InventoryEngine view={ urlView } />
		</>,
		inventoryAdminRoot
	);
}

if ( marketingAdminRoot ) {
	render(
		<>
			<SearchHeader />
			<MarketingEngine view={ urlView } />
		</>,
		marketingAdminRoot
	);
}

if ( shippingAdminRoot ) {
	render(
		<>
			<SearchHeader />
			<FulfillmentEngine view={ urlView } />
		</>,
		shippingAdminRoot
	);
}

if ( aiAdminRoot ) {
	render(
		<>
			<SearchHeader />
			<AiEngine view={ urlView } />
		</>,
		aiAdminRoot
	);
}

if ( workflowsAdminRoot ) {
	render(
		<>
			<SearchHeader />
			<WorkflowsEngine view={ urlView } />
		</>,
		workflowsAdminRoot
	);
}

}

if ( 'loading' === document.readyState ) {
	document.addEventListener( 'DOMContentLoaded', mount );
} else {
	mount();
}
