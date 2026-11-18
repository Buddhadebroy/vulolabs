import { useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { PopupComponent } from '@zyra/components';
import Popup, { type ProFeature } from './Popup';

interface UpgradeToProProps {
	className?: string;
	label?: string;
	icon?: string;
	/** The page or feature this button sits on; the popup lists it first. */
	feature?: ProFeature;
}

/**
 * Every "Upgrade to Pro" in the admin: opens the Pro popup (what Pro adds, with the buy button) in place, instead of
 * sending the store owner off to the shop before they have seen what they would get. The same popup zyra opens for a
 * locked setting (Popup.tsx's default branch).
 */
export function UpgradeToPro( { className = 'vulocart-engine-button', label = __( 'Upgrade to Pro', 'vulocart' ), icon, feature }: UpgradeToProProps ) {
	const [ open, setOpen ] = useState( false );

	return (
		<>
			<button type="button" className={ className } onClick={ () => setOpen( true ) }>
				{ icon && <i className={ `adminfont-${ icon }` } aria-hidden="true" /> }
				{ label }
			</button>
			{ open && (
				<PopupComponent position="lightbox" open onClose={ () => setOpen( false ) } width={ 46 } height="auto">
					<Popup feature={ feature } />
				</PopupComponent>
			) }
		</>
	);
}

export default UpgradeToPro;
