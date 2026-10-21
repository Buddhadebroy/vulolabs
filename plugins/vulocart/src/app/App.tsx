/* global vulocartLocalizer */
import { useEffect, useState } from '@wordpress/element';
import { useLocation } from 'react-router-dom';
import SearchHeader from '../components/Header/SearchHeader';
import '../routeRegistry';
import '../routes';
import './app.scss';

/**
 * Root of the admin app.
 *
 * Tabs are admin sidebar submenu entries (`add_submenu_page()` in classes/Admin/Menu.php), each pointing to
 * `vulocart#&tab={tab}`. The `Route` component reads `tab` from `location.hash` (through `useLocation()` of
 * `BrowserRouter`; see src/index.tsx) and renders the component registered for that tab in routes.ts. Clicking a
 * submenu entry only changes the hash, so it is a same-document navigation and not a page reload.
 */
const Route = () => {
	const location = useLocation();
	const [ routes, setRoutes ] = useState( [ ...window.VULOCART_ROUTES ] );

	useEffect( () => {
		const updateRoutes = () => setRoutes( [ ...window.VULOCART_ROUTES ] );

		window.addEventListener( 'vulocart-routes', updateRoutes );

		return () => window.removeEventListener( 'vulocart-routes', updateRoutes );
	}, [] );

	const tab = new URLSearchParams( location.hash ).get( 'tab' ) || 'dashboard';
	const route = routes.find( ( r ) => r.tab === tab );
	const Component = route?.component;

	// The submenu entries are hash tabs (`vulocart#&tab=x`), which WordPress can't match on the server,
	// so mark the one for the open tab here.
	useEffect( () => {
		document.querySelectorAll( '#toplevel_page_vulocart .wp-submenu li' ).forEach( ( item ) => {
			const link = item.querySelector( 'a' );
			const isCurrent = !! link?.getAttribute( 'href' )?.endsWith( `#&tab=${ tab }` );

			item.classList.toggle( 'current', isCurrent );
			link?.classList.toggle( 'current', isCurrent );
		} );
	}, [ tab ] );

	if ( ! Component ) {
		return null;
	}

	return <Component />;
};

/** Root component of the admin app: the search header and the router that picks the screen. */
export function App() {
	return (
		<>
			<SearchHeader />
			<Route />
		</>
	);
}
