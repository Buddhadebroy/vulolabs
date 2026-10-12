/* global vuloformBlock */
import { registerBlockType } from '@wordpress/blocks';
import { useBlockProps } from '@wordpress/block-editor';
import { Placeholder, SelectControl } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import metadata from './block.json';

/**
 * The VuloForm block: pick a published form. The form itself is rendered on the server by the same
 * code as the shortcode, so the editor only shows which form is selected.
 */
registerBlockType( metadata.name, {
	edit: ( { attributes, setAttributes } ) => {
		const forms = ( window.vuloformBlock && vuloformBlock.forms ) || [];
		const selected = forms.find( ( form ) => Number( form.id ) === attributes.formId );

		return (
			<div { ...useBlockProps() }>
				<Placeholder
					icon="feedback"
					label={ __( 'VuloForm', 'vuloform' ) }
					instructions={
						forms.length
							? __( 'Choose the form to show here.', 'vuloform' )
							: __( 'You have no published forms yet. Create and publish one in VuloForm first.', 'vuloform' )
					}
				>
					{ forms.length > 0 && (
						<SelectControl
							__nextHasNoMarginBottom
							label={ __( 'Form', 'vuloform' ) }
							value={ attributes.formId }
							options={ [
								{ value: 0, label: __( 'Select a form…', 'vuloform' ) },
								...forms.map( ( form ) => ( { value: Number( form.id ), label: form.title } ) ),
							] }
							onChange={ ( value ) => setAttributes( { formId: Number( value ) } ) }
						/>
					) }
					{ attributes.formId > 0 && ! selected && (
						<p>{ __( 'The selected form is no longer published.', 'vuloform' ) }</p>
					) }
				</Placeholder>
			</div>
		);
	},
	save: () => null,
} );
