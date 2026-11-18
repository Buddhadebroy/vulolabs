/* global vulocartLocalizer */
import type { ReactNode } from 'react';
import { useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { PopupComponent } from '@zyra/components';
import Popup, { type ProFeature } from './Popup';
import './pro-sample.scss';

interface ProSampleProps {
	/** What the section would show with Pro: made-up content in the real screen's shape. */
	children: ReactNode;
	/** The feature this section is; the Pro popup lists it first. */
	feature: ProFeature;
	/** One line beside the Pro tag. */
	text: string;
	/** The button, e.g. "Unlock zone rates". */
	cta: string;
}

/**
 * A Pro-only section while VuloCart Pro can't provide it (not installed or not licensed): the section's sample
 * content (faded, marked "Sample data"), then a strip with the Pro tag, one line and one button. The content and the
 * button both open the Pro popup. Used in place of a "needs Pro" or "activate your license" card, so a store owner
 * sees what the section does instead of being told it is locked.
 */
export function ProSample( { children, feature, text, cta }: ProSampleProps ) {
	const [ open, setOpen ] = useState( false );

	return (
		<div className="vc-sample">
			<div
				className="vc-sample-preview"
				role="button"
				tabIndex={ 0 }
				aria-label={ `${ feature.title }: ${ __( 'see what VuloCart Pro adds', 'vulocart' ) }` }
				onClick={ () => setOpen( true ) }
				onKeyDown={ ( event ) => {
					if ( 'Enter' === event.key || ' ' === event.key ) {
						event.preventDefault();
						setOpen( true );
					}
				} }
			>
				<div className="vc-sample-content" aria-hidden="true">
					{ children }
				</div>
				<span className="vc-sample-label">{ __( 'Sample data', 'vulocart' ) }</span>
			</div>

			<div className="vc-sample-bar">
				<span className="admin-tag pro-tag">
					<i className="adminfont-pro-tag" aria-hidden="true" />
					{ __( 'Pro', 'vulocart' ) }
				</span>
				<p>{ text }</p>
				<button type="button" className="vulocart-engine-button" onClick={ () => setOpen( true ) }>
					{ cta }
				</button>
			</div>

			{ open && (
				<PopupComponent position="lightbox" open onClose={ () => setOpen( false ) } width={ 46 } height="auto">
					<Popup feature={ feature } />
				</PopupComponent>
			) }
		</div>
	);
}

/** True while VuloCart Pro can't provide its features here: not installed, or installed without an active license. */
export function proLocked(): boolean {
	return ! vulocartLocalizer.pro_version || ! vulocartLocalizer.khali_dabba;
}

export default ProSample;
