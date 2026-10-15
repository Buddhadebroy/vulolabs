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
import ShippingEngine from './pages/ShippingEngine/ShippingEngine';
import AiEngine from './pages/AiEngine/AiEngine';
import WorkflowsEngine from './pages/WorkflowsEngine/WorkflowsEngine';
import { registerRestErrorToasts } from './lib/rest-errors';

/**
 * VuloCart's free plugin owns its own React mount - unlike
 * vulopilot's Pro plugin, which only registers
 * `@wordpress/hooks` filters into an already-mounted Free dashboard
 * (react-frontend.md), VuloCart has no existing dashboard to extend, so
 * this mounts directly into `#admin-main-wrapper` (classes/Admin/Menu.php) -
 * same id+class vulopilot's own `#admin-main-wrapper` mount point uses, so
 * zyra's shared layout rules (full-height page, `#wpcontent` padding reset)
 * apply here the same way they do there.
 *
 * Further, separate top-level WP admin menus ("Orders", "Products", "Customers",
 * "Inventory", "Shipping", "AI", "Workflows", "Analytics") mount the exact same
 * bundle into different root element ids PHP prints
 * (`#vulocart-orders-admin-root`, `#vulocart-products-admin-root`, ...) - which
 * `standaloneRoot()` renames to `#admin-main-wrapper` at mount, so they get the same
 * layout rules as the main app - all
 * get their own dedicated space rather than being one more VuloCart tab
 * (Menu.php's `add_orders_menu()`/`add_products_menu()` docblocks).
 * Rather than a second/third webpack entry, this file renders a
 * different, self-contained tree per root - "never mix multiple modules
 * into one screen" holds either way, since neither screen ever renders
 * Modules/Settings.
 *
 * Both apps read `action`/`id` straight from `window.location.search` once,
 * at mount time - not via client-side routing. Every transition between
 * list/add/edit is a real full-page navigation to a distinct
 * `admin.php?page=...` URL (row/button links use plain `<a href>`/
 * `window.location.href`, see OrdersList.tsx/ProductsList.tsx), matching
 * WooCommerce's own Orders/Products edit screens rather than a SPA route
 * or a popup - so a fresh mount re-reading the URL on every load is
 * exactly the right model, not a shortcut.
 *
 * `configureZyra()` feeds zyra's internal config (apiUrl/restUrl/nonce/
 * khali_dabba/etc, see global.d.ts) to every zyra component this app
 * renders (Modules/Settings/Dashboard pages). `initializeModules()`
 * seeds zyra's own `useModules()` store with the real active-module list
 * - `force_vulocart_context_reload` mirrors vulopilot's
 * app.tsx pattern of setting this unconditionally on every load so the
 * store never goes stale.
 *
 * `BrowserRouter`, not `HashRouter` - App.tsx's tab system reads the raw
 * `location.hash` (`#&tab=...`) itself; `HashRouter` would instead treat
 * everything after `#` as its own routed pathname, which isn't what
 * App.tsx's `Route` component expects (confirmed the hard way once
 * already this session - see App.tsx's docblock).
 *
 * Every `render()` call below runs inside `mount()`, called on
 * `DOMContentLoaded` (or immediately if that's already fired) rather
 * than inline at script-eval time - load-order-sensitive, found the hard
 * way: `vulocart-pro-admin` declares `vulocart-admin` as its own script
 * dependency (VuloCartPro.php's own `enqueue_admin_script()`), which
 * makes WordPress output THIS script's tag before Pro's in the page. A
 * plain `setTimeout(fn, 0)` deferral was tried first and wasn't enough -
 * confirmed empirically (a real headless-browser check, not just "the
 * script tag is present") that a same-task macrotask can still fire
 * before a second, separately-fetched `<script src>` tag has finished
 * its own "fetch a classic script" step and executed, since that step is
 * itself asynchronous per the HTML spec even for a parser-blocking
 * script. `DOMContentLoaded` doesn't have that race: it only fires once
 * the parser has finished the ENTIRE document, including running every
 * parser-blocking script it encountered - so by the time `mount()` runs,
 * vulocart-pro's own bundle (and every active Pro module's own
 * top-level `addFilter()` calls) has unconditionally already executed.
 * Without this, `render()` (and therefore every `applyFilters(...)` call
 * a page like `Products`/`Customers`/`InventoryEngine`/`ShippingEngine`
 * makes on its very first synchronous render) ran to completion before
 * any Pro-registered filter existed, so every Pro-registered `view`
 * (Suppliers, Groups/Segments, the entire Inventory/Shipping Engine
 * screens, ...) silently fell through to `previousValue` and never
 * rendered - and nothing here subscribes to "a hook was registered," so
 * a first render that missed a filter never got a second chance.
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
			<ShippingEngine view={ urlView } />
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
