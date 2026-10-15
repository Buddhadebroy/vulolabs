import { applyFilters } from '@wordpress/hooks';
import { useState } from '@wordpress/element';
import type { ReactNode } from 'react';
import { EngineScreen, ModuleRequired, type EngineView } from './EngineScreen';

interface EngineTabsProps {
	/** The page's own header; the tabs sit under it. */
	header: EngineView;
	/** One entry per tab, in tab order. `title` is the tab label. */
	views: Record< string, EngineView >;
	/** `vulocart_{engine}_view` - what modules register their tab's content into. */
	filterName: string;
	/** The tab the URL's `&view=` asked for; unknown or empty falls back to the first tab. */
	view: string | null;
	/** Content Free renders itself for a tab (e.g. Inventory's stock levels), instead of asking the filter. */
	own?: Record< string, ReactNode >;
}

/**
 * One engine menu page with a tab per feature, in place of a WordPress submenu entry per feature. Free owns
 * the frame and the tab bar; each tab is either content Free passes in (`own`) or whatever a Pro module
 * registered into the page's view filter, or the "module required" state. The active tab follows `&view=`
 * and is written back to the URL, so a tab can be linked and survives a reload.
 */
export function EngineTabs( { header, views, filterName, view, own = {} }: EngineTabsProps ) {
	const first = Object.keys( views )[ 0 ];
	const [ active, setActive ] = useState( view && views[ view ] ? view : first );

	const select = ( key: string ) => {
		setActive( key );

		const url = new URL( window.location.href );
		url.searchParams.set( 'view', key );
		window.history.replaceState( null, '', url.toString() );
	};

	const content = active in own ? own[ active ] : ( applyFilters( filterName, null, { view: active } ) as ReactNode );

	return (
		<EngineScreen view={ header }>
			<div className="vulocart-engine-tabs" role="tablist">
				{ Object.entries( views ).map( ( [ key, tab ] ) => (
					<button key={ key } type="button" role="tab" aria-selected={ active === key } className={ active === key ? 'is-active' : '' } onClick={ () => select( key ) }>
						{ tab.title }
					</button>
				) ) }
			</div>

			{ /* Remount per tab so one feature's state never leaks into the next. */ }
			<div key={ active }>{ content || <ModuleRequired view={ views[ active ] } /> }</div>
		</EngineScreen>
	);
}

export default EngineTabs;
