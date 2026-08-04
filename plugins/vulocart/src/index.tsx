/* global vulocartLocalizer */
import { render } from '@wordpress/element';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { configureZyra, initializeModules } from '@zyra/core';
import { HeaderComponent } from '@zyra/components';
import { App } from './app/App';
import Orders from './pages/Orders/Orders';
import Offerings from './pages/Offerings/Offerings';
import Customers from './pages/Customers/Customers';
import InventoryEngine from './pages/InventoryEngine/InventoryEngine';
import ShippingEngine from './pages/ShippingEngine/ShippingEngine';
import AiEngine from './pages/AiEngine/AiEngine';
import WorkflowsEngine from './pages/WorkflowsEngine/WorkflowsEngine';
import AnalyticsEngine from './pages/AnalyticsEngine/AnalyticsEngine';
import Brand from './assets/images/vulocart-logo.svg';

/**
 * VuloCart's free plugin owns its own React mount — unlike
 * vulopilot's Pro plugin, which only registers
 * `@wordpress/hooks` filters into an already-mounted Free dashboard
 * (react-frontend.md), VuloCart has no existing dashboard to extend, so
 * this mounts directly into `#vulocart-admin-root` (classes/Admin/Menu.php).
 *
 * Two further, separate top-level WP admin menus ("Orders", "Offerings")
 * mount the exact same bundle into different root element ids
 * (`#vulocart-orders-admin-root`, `#vulocart-offerings-admin-root`) — both
 * get their own dedicated space rather than being one more VuloCart tab
 * (Menu.php's `add_orders_menu()`/`add_offerings_menu()` docblocks).
 * Rather than a second/third webpack entry, this file renders a
 * different, self-contained tree per root — "never mix multiple modules
 * into one screen" holds either way, since neither screen ever renders
 * Modules/Settings.
 *
 * Both apps read `action`/`id` straight from `window.location.search` once,
 * at mount time — not via client-side routing. Every transition between
 * list/add/edit is a real full-page navigation to a distinct
 * `admin.php?page=...` URL (row/button links use plain `<a href>`/
 * `window.location.href`, see OrdersList.tsx/OfferingsList.tsx), matching
 * WooCommerce's own Orders/Products edit screens rather than a SPA route
 * or a popup — so a fresh mount re-reading the URL on every load is
 * exactly the right model, not a shortcut.
 *
 * `configureZyra()` feeds zyra's internal config (apiUrl/restUrl/nonce/
 * khali_dabba/etc, see global.d.ts) to every zyra component this app
 * renders (Modules/Settings/Dashboard pages). `initializeModules()`
 * seeds zyra's own `useModules()` store with the real active-module list
 * — `force_vulocart_context_reload` mirrors vulopilot's
 * app.tsx pattern of setting this unconditionally on every load so the
 * store never goes stale.
 *
 * `BrowserRouter`, not `HashRouter` — App.tsx's tab system reads the raw
 * `location.hash` (`#&tab=...`) itself; `HashRouter` would instead treat
 * everything after `#` as its own routed pathname, which isn't what
 * App.tsx's `Route` component expects (confirmed the hard way once
 * already this session — see App.tsx's docblock).
 *
 * Every `render()` call below runs inside `mount()`, called on
 * `DOMContentLoaded` (or immediately if that's already fired) rather
 * than inline at script-eval time — load-order-sensitive, found the hard
 * way: `vulocart-pro-admin` declares `vulocart-admin` as its own script
 * dependency (VuloCartPro.php's own `enqueue_admin_script()`), which
 * makes WordPress output THIS script's tag before Pro's in the page. A
 * plain `setTimeout(fn, 0)` deferral was tried first and wasn't enough —
 * confirmed empirically (a real headless-browser check, not just "the
 * script tag is present") that a same-task macrotask can still fire
 * before a second, separately-fetched `<script src>` tag has finished
 * its own "fetch a classic script" step and executed, since that step is
 * itself asynchronous per the HTML spec even for a parser-blocking
 * script. `DOMContentLoaded` doesn't have that race: it only fires once
 * the parser has finished the ENTIRE document, including running every
 * parser-blocking script it encountered — so by the time `mount()` runs,
 * vulocart-pro's own bundle (and every active Pro module's own
 * top-level `addFilter()` calls) has unconditionally already executed.
 * Without this, `render()` (and therefore every `applyFilters(...)` call
 * a page like `Offerings`/`Customers`/`InventoryEngine`/`ShippingEngine`
 * makes on its very first synchronous render) ran to completion before
 * any Pro-registered filter existed, so every Pro-registered `view`
 * (Suppliers, Groups/Segments, the entire Inventory/Shipping Engine
 * screens, ...) silently fell through to `previousValue` and never
 * rendered — and nothing here subscribes to "a hook was registered," so
 * a first render that missed a filter never got a second chance.
 */
localStorage.setItem( 'force_vulocart_context_reload', 'true' );

configureZyra( vulocartLocalizer );
initializeModules( 'vulocart', 'free', 'modules' );

const queryClient = new QueryClient();

const adminRoot = document.getElementById( 'vulocart-admin-root' );
const ordersAdminRoot = document.getElementById( 'vulocart-orders-admin-root' );
const offeringsAdminRoot = document.getElementById( 'vulocart-offerings-admin-root' );
const customersAdminRoot = document.getElementById( 'vulocart-customers-admin-root' );
const inventoryAdminRoot = document.getElementById( 'vulocart-inventory-admin-root' );
const shippingAdminRoot = document.getElementById( 'vulocart-shipping-admin-root' );
const aiAdminRoot = document.getElementById( 'vulocart-ai-admin-root' );
const workflowsAdminRoot = document.getElementById( 'vulocart-workflows-admin-root' );
const analyticsAdminRoot = document.getElementById( 'vulocart-analytics-admin-root' );

const urlParams = new URLSearchParams( window.location.search );
const urlAction = urlParams.get( 'action' );
const urlId = urlParams.get( 'id' ) ? Number( urlParams.get( 'id' ) ) : null;
const urlFilter = urlParams.get( 'filter' );
const urlView = urlParams.get( 'view' );

function mount() {

if ( adminRoot ) {
	render(
		<QueryClientProvider client={ queryClient }>
			<BrowserRouter>
				<App />
			</BrowserRouter>
		</QueryClientProvider>,
		adminRoot
	);
}

if ( ordersAdminRoot ) {
	render(
		<QueryClientProvider client={ queryClient }>
			<HeaderComponent
				brandImg={ Brand }
				free={ vulocartLocalizer.version }
				pro={ vulocartLocalizer.pro_version ?? undefined }
				onQueryUpdate={ () => {} }
				onResultClick={ () => {} }
			/>
			<div className="admin-main-wrapper">
				<Orders action={ urlAction } id={ urlId } filter={ urlFilter } />
			</div>
		</QueryClientProvider>,
		ordersAdminRoot
	);
}

if ( offeringsAdminRoot ) {
	render(
		<QueryClientProvider client={ queryClient }>
			<HeaderComponent
				brandImg={ Brand }
				free={ vulocartLocalizer.version }
				pro={ vulocartLocalizer.pro_version ?? undefined }
				onQueryUpdate={ () => {} }
				onResultClick={ () => {} }
			/>
			<div className="admin-main-wrapper">
				<Offerings action={ urlAction } id={ urlId } view={ urlView } />
			</div>
		</QueryClientProvider>,
		offeringsAdminRoot
	);
}

if ( customersAdminRoot ) {
	render(
		<QueryClientProvider client={ queryClient }>
			<HeaderComponent
				brandImg={ Brand }
				free={ vulocartLocalizer.version }
				pro={ vulocartLocalizer.pro_version ?? undefined }
				onQueryUpdate={ () => {} }
				onResultClick={ () => {} }
			/>
			<div className="admin-main-wrapper">
				<Customers action={ urlAction } id={ urlId } view={ urlView } />
			</div>
		</QueryClientProvider>,
		customersAdminRoot
	);
}

if ( inventoryAdminRoot ) {
	render(
		<QueryClientProvider client={ queryClient }>
			<HeaderComponent
				brandImg={ Brand }
				free={ vulocartLocalizer.version }
				pro={ vulocartLocalizer.pro_version ?? undefined }
				onQueryUpdate={ () => {} }
				onResultClick={ () => {} }
			/>
			<div className="admin-main-wrapper">
				<InventoryEngine view={ urlView } />
			</div>
		</QueryClientProvider>,
		inventoryAdminRoot
	);
}

if ( shippingAdminRoot ) {
	render(
		<QueryClientProvider client={ queryClient }>
			<HeaderComponent
				brandImg={ Brand }
				free={ vulocartLocalizer.version }
				pro={ vulocartLocalizer.pro_version ?? undefined }
				onQueryUpdate={ () => {} }
				onResultClick={ () => {} }
			/>
			<div className="admin-main-wrapper">
				<ShippingEngine view={ urlView } />
			</div>
		</QueryClientProvider>,
		shippingAdminRoot
	);
}

if ( aiAdminRoot ) {
	render(
		<QueryClientProvider client={ queryClient }>
			<HeaderComponent
				brandImg={ Brand }
				free={ vulocartLocalizer.version }
				pro={ vulocartLocalizer.pro_version ?? undefined }
				onQueryUpdate={ () => {} }
				onResultClick={ () => {} }
			/>
			<div className="admin-main-wrapper">
				<AiEngine view={ urlView } />
			</div>
		</QueryClientProvider>,
		aiAdminRoot
	);
}

if ( workflowsAdminRoot ) {
	render(
		<QueryClientProvider client={ queryClient }>
			<HeaderComponent
				brandImg={ Brand }
				free={ vulocartLocalizer.version }
				pro={ vulocartLocalizer.pro_version ?? undefined }
				onQueryUpdate={ () => {} }
				onResultClick={ () => {} }
			/>
			<div className="admin-main-wrapper">
				<WorkflowsEngine view={ urlView } />
			</div>
		</QueryClientProvider>,
		workflowsAdminRoot
	);
}

if ( analyticsAdminRoot ) {
	render(
		<QueryClientProvider client={ queryClient }>
			<HeaderComponent
				brandImg={ Brand }
				free={ vulocartLocalizer.version }
				pro={ vulocartLocalizer.pro_version ?? undefined }
				onQueryUpdate={ () => {} }
				onResultClick={ () => {} }
			/>
			<div className="admin-main-wrapper">
				<AnalyticsEngine view={ urlView } />
			</div>
		</QueryClientProvider>,
		analyticsAdminRoot
	);
}

}

if ( 'loading' === document.readyState ) {
	document.addEventListener( 'DOMContentLoaded', mount );
} else {
	mount();
}
