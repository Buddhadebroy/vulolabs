import { registerBlockType } from '@wordpress/blocks';
import { __ } from '@wordpress/i18n';
import { InspectorControls, useBlockProps } from '@wordpress/block-editor';
import { PanelBody, SelectControl } from '@wordpress/components';

registerBlockType( 'vulocart/offerings', {
	edit: ( { attributes, setAttributes } ) => {
		const blockProps = useBlockProps( {
			style: {
				border: '1px dashed #8c8f94',
				padding: '24px',
				textAlign: 'center',
				color: '#50575e',
			},
		} );

		return (
			<>
				<InspectorControls>
					<PanelBody title={ __( 'Listing template', 'vulocart' ) } initialOpen>
						<SelectControl
							label={ __( 'Template', 'vulocart' ) }
							help={ __( 'Overrides Settings → Templates for this page only.', 'vulocart' ) }
							value={ attributes.template }
							options={ [
								{ label: __( 'Use the site setting', 'vulocart' ), value: '' },
								{ label: __( 'Grid', 'vulocart' ), value: 'grid' },
								{ label: __( 'Compact', 'vulocart' ), value: 'compact' },
								{ label: __( 'List', 'vulocart' ), value: 'list' },
								{ label: __( 'Showcase', 'vulocart' ), value: 'showcase' },
							] }
							onChange={ ( template ) => setAttributes( { template } ) }
						/>
						{ 'list' !== attributes.template && (
							<SelectControl
								label={ __( 'Columns', 'vulocart' ) }
								value={ attributes.columns }
								options={ [
									{ label: __( 'Use the site setting', 'vulocart' ), value: '' },
									{ label: '2', value: '2' },
									{ label: '3', value: '3' },
									{ label: '4', value: '4' },
									{ label: '5', value: '5' },
								] }
								onChange={ ( columns ) => setAttributes( { columns } ) }
							/>
						) }
					</PanelBody>
				</InspectorControls>
				<div { ...blockProps }>
					{ __(
						'VuloCart Offerings - renders the catalog listing (or a single offering\'s detail page, via ?offering=) on the published page.',
						'vulocart'
					) }
				</div>
			</>
		);
	},

	save: ( { attributes } ) => {
		const blockProps = useBlockProps.save();

		return (
			<div { ...blockProps }>
				<div
					className="vulocart-offerings-block"
					data-template={ attributes.template || undefined }
					data-columns={ attributes.columns || undefined }
				></div>
			</div>
		);
	},
} );
