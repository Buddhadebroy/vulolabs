/* global vulocartLocalizer */
import { useState } from '@wordpress/element';
import { __, sprintf } from '@wordpress/i18n';
import axios from 'axios';
import MODULES_CATALOG, { isModuleCatalogEntry } from '../../modules-config';

interface ProModuleHintProps {
	/** Module id (`Modules::camel_to_kebab()` of the folder), e.g. `pricing-rules`. */
	module: string;
	title: string;
	description: string;
}

/**
 * A compact line inside a product card where a Pro module's block would be, shown while that block isn't
 * there: it says what's missing and offers the one fix - upgrade (no Pro), Licensing (Pro, no license) or
 * switching the module on in place. Same decision `EngineScreen`'s `ModuleRequired` makes for whole pages.
 */
export function ProModuleHint( { module, title, description }: ProModuleHintProps ) {
	const [ busy, setBusy ] = useState( false );
	const [ failed, setFailed ] = useState( false );

	const moduleName = MODULES_CATALOG.modules.filter( isModuleCatalogEntry ).find( ( entry ) => entry.id === module )?.name;
	const hasPro = !! vulocartLocalizer.pro_version;
	const licensed = !! vulocartLocalizer.khali_dabba;
	const settingsUrl = `${ vulocartLocalizer.adminUrl }admin.php?page=vulocart#&tab=settings&subtab=`;

	const activate = () => {
		setBusy( true );
		setFailed( false );

		axios
			.post(
				`${ vulocartLocalizer.apiUrl }/${ vulocartLocalizer.restUrl }/modules`,
				{ id: module, action: 'activate' },
				{ headers: { 'X-WP-Nonce': vulocartLocalizer.nonce } }
			)
			.then( () => window.location.reload() )
			.catch( () => {
				setBusy( false );
				setFailed( true );
			} );
	};

	let action;

	if ( ! hasPro ) {
		action = (
			<a className="vulocart-pro-hint-button" href={ vulocartLocalizer.shop_url } target="_blank" rel="noreferrer">
				{ __( 'Upgrade to Pro', 'vulocart' ) }
			</a>
		);
	} else if ( ! licensed ) {
		action = (
			<a className="vulocart-pro-hint-button" href={ `${ settingsUrl }licensing` }>
				{ __( 'Activate license', 'vulocart' ) }
			</a>
		);
	} else {
		action = (
			<button type="button" className="vulocart-pro-hint-button" disabled={ busy } onClick={ activate }>
				{ busy ? __( 'Turning on…', 'vulocart' ) : moduleName ? sprintf( /* translators: %s: module name. */ __( 'Turn on %s', 'vulocart' ), moduleName ) : __( 'Turn on', 'vulocart' ) }
			</button>
		);
	}

	return (
		<div className="vulocart-pro-hint">
			<i className="adminfont-lock" aria-hidden="true" />
			<div className="vulocart-pro-hint-text">
				<strong>{ title }</strong>
				<span>{ failed ? moduleName ? sprintf( /* translators: %s: module name. */ __( 'Could not turn on the %s module. Try again from Settings → Modules.', 'vulocart' ), moduleName ) : __( 'Could not turn this on. Try again from Settings → Modules.', 'vulocart' ) : description }</span>
			</div>
			{ action }
		</div>
	);
}

export default ProModuleHint;
