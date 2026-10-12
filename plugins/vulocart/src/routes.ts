import { registerVuloCartRoute } from './routeRegistry';

import Dashboard from './pages/Dashboard/Dashboard';
import Settings from './pages/Settings/Settings';

// Orders and Offerings are not VuloCart tabs - both are mounted as their
// own standalone top-level WP admin menus instead (src/index.tsx,
// classes/Admin/Menu.php's add_orders_menu()/add_offerings_menu()), so
// neither is registered here.
//
// No standalone `tab: 'modules'` route any more - moved inside Settings as
// its own subtab (settings/Modules.ts, components/Settings/ModulesPanel.tsx),
// same migration vulopilot's own routes.ts already made.
registerVuloCartRoute( { tab: 'dashboard', component: Dashboard } );
registerVuloCartRoute( { tab: 'settings', component: Settings } );
