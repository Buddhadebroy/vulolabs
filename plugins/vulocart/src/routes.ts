import { registerVuloCartRoute } from './routeRegistry';

import Dashboard from './pages/Dashboard/Dashboard';
import Settings from './pages/Settings/Settings';
import { ReviewsPage } from './pages/Reviews/ReviewsPage';

// Orders, Products and the other store areas are not tabs of the main VuloCart menu. Each is a separate admin page
// with its own root element (src/index.tsx, classes/Admin/Menu.php), so none is registered here.
//
// Modules is not a route either: it is a sub-tab of Settings (settings/Modules.ts,
// components/Settings/ModulesPanel.tsx).
registerVuloCartRoute( { tab: 'dashboard', component: Dashboard } );
registerVuloCartRoute( { tab: 'settings', component: Settings } );

// Reviews moved out of Products into the VuloCart menu (`vulocart#&tab=reviews`).
registerVuloCartRoute( { tab: 'reviews', component: ReviewsPage } );
