import { __ } from '@wordpress/i18n';
import { TYPE_PROFILES } from './typeProfiles';

/**
 * The first screen of "Add Product": what are you selling? One card per type with a line of help. Picking one opens the
 * editor with that type (and its first kind) already chosen, so nobody has to find the Type dropdown. "Skip" opens the
 * editor with the default type.
 */
export function TypeChooser( { onChoose, onSkip }: { onChoose: ( type: string ) => void; onSkip: () => void } ) {
	return (
		<div className="vulocart-product-edit-page vulocart-type-chooser">
			<a className="vulocart-back-link" href="admin.php?page=vulocart-products">
				{ __( '← Back to Products', 'vulocart' ) }
			</a>

			<header>
				<h1 className="vulocart-edit-page-title">{ __( 'What are you selling?', 'vulocart' ) }</h1>
				<p className="vulocart-product-edit-subtitle">{ __( 'Pick the closest match. It sets up the right fields, and you can change it later.', 'vulocart' ) }</p>
			</header>

			<ul className="vulocart-type-grid">
				{ TYPE_PROFILES.filter( ( profile ) => 'license' !== profile.value ).map( ( profile ) => (
					<li key={ profile.value }>
						<button type="button" onClick={ () => onChoose( profile.value ) }>
							<span className="vulocart-type-icon">
								<i className={ `adminfont-${ profile.icon }` } aria-hidden="true" />
							</span>
							<strong>{ profile.label }</strong>
							<small>{ profile.hint }</small>
							{ profile.subtypes.length > 1 && (
								<em>{ profile.subtypes.map( ( subtype ) => subtype.label ).join( ' · ' ) }</em>
							) }
						</button>
					</li>
				) ) }
			</ul>

			<p className="vulocart-type-skip">
				<button type="button" onClick={ onSkip }>
					{ __( 'Skip - start with a physical product', 'vulocart' ) }
				</button>
			</p>
		</div>
	);
}
