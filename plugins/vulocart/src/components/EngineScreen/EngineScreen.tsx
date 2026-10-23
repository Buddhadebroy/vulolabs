/* global vulocartLocalizer */
import { useEffect, useState } from '@wordpress/element';
import type { ReactNode } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import MODULES_CATALOG, { isModuleCatalogEntry, moduleCardId } from '../../modules-config';
import { applyFilters } from '@wordpress/hooks';
import axios from 'axios';
import { ContainerComponent, ColumnComponent, NavigatorHeaderComponent } from '@zyra/components';
import './engine-screen.scss';

/** What an engine menu knows about one of its views before any module has registered it. */
export interface EngineView {
	title: string;
	description: string;
	icon: string;
	/** Id of the module that provides this view (`Modules::camel_to_kebab()` of its folder). */
	module: string;
	/** True when the module ships in vulocart-pro, so it also needs an active license. */
	pro?: boolean;
	/** The registered page draws its own header (breadcrumb, title, actions), so the frame omits the standard one. */
	bare?: boolean;
}

interface EngineScreenProps {
	/** A view's own header. Omit when the view renders one itself. */
	view?: EngineView;
	/** Shown in the header's top-right, before any button a page put there (e.g. a status badge). */
	headerExtra?: ReactNode;
	children: ReactNode;
}

/**
 * A page inside the frame (most of them live in vulocart-pro, a separate bundle) puts its primary
 * button - "Add New" - in the header's top-right corner by calling
 * `window.vulocartEngineHeader.set( node )`; `set( null )` clears it. A window global because the
 * page and the frame are built into different bundles; the node is an ordinary React element, so
 * its click handlers keep working.
 */
interface EngineHeaderChannel {
	node: ReactNode;
	listeners: Set< () => void >;
	set: ( node: ReactNode ) => void;
}

const headerChannel: EngineHeaderChannel = ( window as unknown as { vulocartEngineHeader?: EngineHeaderChannel } ).vulocartEngineHeader ?? {
	node: null,
	listeners: new Set(),
	set( node ) {
		this.node = node;
		this.listeners.forEach( ( listener ) => listener() );
	},
};

( window as unknown as { vulocartEngineHeader: EngineHeaderChannel } ).vulocartEngineHeader = headerChannel;

/**
 * The standard frame for every top-level VuloCart menu that isn't a zyra settings screen
 * (Inventory, Shipping, AI, Workflows, Analytics, and the Pro pages plugged into Products/
 * Customers). Same container/column/header trio `TermsPage` uses, plus a
 * `.vulocart-engine-page` scope whose stylesheet gives the plain markup Pro modules render
 * (headings, forms, tables, buttons, badges) the same look as the zyra screens, so a module
 * doesn't have to restyle itself.
 */
export function EngineScreen( { view, headerExtra, children }: EngineScreenProps ) {
	const [ headerAction, setHeaderAction ] = useState< ReactNode >( headerChannel.node );

	useEffect( () => {
		const update = () => setHeaderAction( headerChannel.node );

		headerChannel.listeners.add( update );
		update();

		return () => {
			headerChannel.listeners.delete( update );
		};
	}, [] );

	return (
		<ContainerComponent general>
			<ColumnComponent>
				{ view && (
					<NavigatorHeaderComponent
							headerIcon={ view.icon }
							headerTitle={ view.title }
							headerDescription={ view.description }
							headerCustomContent={ headerExtra ? <>{ headerExtra }{ headerAction }</> : headerAction }
						/>
				) }
				<div className={ `vulocart-engine-page${ view ? ' has-header' : '' }` }>{ children }</div>
			</ColumnComponent>
		</ContainerComponent>
	);
}

/**
 * Resolves what a router-style menu (`vulocart_{engine}_view`) shows for a view: whatever a module
 * registered into the filter, wrapped in the standard frame, or - when nothing did - the
 * "module required" state for that view.
 */
export function renderEngineView(
	filterName: string,
	views: Record< string, EngineView >,
	view: string,
	context: Record< string, unknown > = {}
) {
	const extra = applyFilters( filterName, null, { view, ...context } );

	const meta = views[ view ] ?? Object.values( views )[ 0 ];

	if ( extra ) {
		return <EngineScreen view={ views[ view ]?.bare ? undefined : views[ view ] }>{ extra as ReactNode }</EngineScreen>;
	}

	return (
		<EngineScreen view={ meta }>
			<ModuleRequired view={ meta } />
		</EngineScreen>
	);
}

/**
 * Shown where a module's page would be: tells the user which module powers the page and gives
 * the one action that fixes it - activating a free module in place, upgrading when Pro isn't installed,
 * or going to the Licensing tab for a Pro one while no license is active.
 */
export function ModuleRequired( { view }: { view: EngineView } ) {
	const [ busy, setBusy ] = useState( false );
	const [ failed, setFailed ] = useState( false );
	// `pro_version` is set only while vulocart-pro is active; `khali_dabba` is true when it is also licensed
	// (Utill::is_khali_dabba()). No Pro at all is an upgrade, Pro without a license is an activation.
	const needsUpgrade = !! view.pro && ! vulocartLocalizer.pro_version;
	const needsLicense = !! view.pro && ! needsUpgrade && ! vulocartLocalizer.khali_dabba;
	// The name Settings → Modules shows for it, so the message says exactly which module to switch on.
	const moduleName = MODULES_CATALOG.modules.filter( isModuleCatalogEntry ).find( ( module ) => module.id === moduleCardId( view.module ) )?.name;
	const settingsUrl = `${ vulocartLocalizer.adminUrl }admin.php?page=vulocart#&tab=settings&subtab=`;

	const activate = () => {
		setBusy( true );
		setFailed( false );

		axios
			.post(
				`${ vulocartLocalizer.apiUrl }/${ vulocartLocalizer.restUrl }/modules`,
				{ id: view.module, action: 'activate' },
				{ headers: { 'X-WP-Nonce': vulocartLocalizer.nonce } }
			)
			// The response is the active list after the loader ran; a module it dropped (not
			// available, `is_compatible()` false) isn't in it, and reloading would just show this card again.
			.then( ( { data } ) => {
				if ( ! Array.isArray( data ) || ! data.includes( view.module ) ) {
					throw new Error( 'not activated' );
				}

				window.location.reload();
			} )
			.catch( () => {
				setBusy( false );
				setFailed( true );
			} );
	};

	return (
		<div className="vulocart-engine-required">
			<i className={ `adminfont-${ needsUpgrade || needsLicense ? 'lock' : view.icon }` } />
			<h2>
				{ needsUpgrade
					? __( 'This page is part of VuloCart Pro', 'vulocart' )
					: needsLicense
					? __( 'This page needs an active VuloCart Pro license', 'vulocart' )
					: moduleName
					? sprintf( /* translators: %s: module name. */ __( 'Turn on the %s module', 'vulocart' ), moduleName )
					: __( 'Turn on the module behind this page', 'vulocart' ) }
			</h2>
			<p>{ view.description }</p>
			{ needsUpgrade ? (
				<a className="vulocart-engine-button" href={ vulocartLocalizer.shop_url } target="_blank" rel="noreferrer">
					{ __( 'Upgrade to Pro', 'vulocart' ) }
				</a>
			) : needsLicense ? (
				<a className="vulocart-engine-button" href={ `${ settingsUrl }licensing` }>
					{ __( 'Activate license', 'vulocart' ) }
				</a>
			) : (
				<div>
					<button type="button" className="vulocart-engine-button" disabled={ busy } onClick={ activate }>
						{ busy ? __( 'Activating…', 'vulocart' ) : moduleName ? sprintf( /* translators: %s: module name. */ __( 'Activate %s', 'vulocart' ), moduleName ) : __( 'Activate module', 'vulocart' ) }
					</button>
					<a className="vulocart-engine-link" href={ `${ settingsUrl }modules` }>
						{ __( 'Manage modules', 'vulocart' ) }
					</a>
				</div>
			) }
			{ failed && <p className="vulocart-engine-error">{ moduleName ? sprintf( /* translators: %s: module name. */ __( 'Could not activate the %s module. Try again from Settings → Modules.', 'vulocart' ), moduleName ) : __( 'Could not activate the module.', 'vulocart' ) }</p> }
		</div>
	);
}

export default EngineScreen;
