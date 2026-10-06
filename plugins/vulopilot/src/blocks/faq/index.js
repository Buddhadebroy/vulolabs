import { registerBlockType } from '@wordpress/blocks';
import { __ } from '@wordpress/i18n';
import {
	useBlockProps,
	RichText,
	InspectorControls,
	PanelColorSettings,
} from '@wordpress/block-editor';
import { Button, PanelBody, FontSizePicker } from '@wordpress/components';
import metadata from './block.json';

registerBlockType( metadata.name, {
	edit: ( { attributes, setAttributes } ) => {
		const {
			questions,
			questionColor,
			questionFontSize,
			answerColor,
			answerFontSize,
		} = attributes;
		const blockProps = useBlockProps( { className: 'vulopilot-faq' } );

		const updateQuestion = ( index, field, value ) => {
			const next = questions.slice();
			next[ index ] = { ...next[ index ], [ field ]: value };
			setAttributes( { questions: next } );
		};

		const addRow = () =>
			setAttributes( {
				questions: [ ...questions, { question: '', answer: '' } ],
			} );

		const removeRow = ( index ) =>
			setAttributes( {
				questions: questions.filter( ( _row, i ) => i !== index ),
			} );

		const questionStyle = {
			color: questionColor,
			fontSize: questionFontSize,
		};
		const answerStyle = {
			color: answerColor,
			fontSize: answerFontSize,
		};

		return (
			<>
				<InspectorControls>
					<PanelBody
						title={ __( 'Question Style', 'vulopilot' ) }
						initialOpen={ false }
					>
						<FontSizePicker
							value={ questionFontSize }
							onChange={ ( value ) =>
								setAttributes( { questionFontSize: value } )
							}
							__next40pxDefaultSize
						/>
					</PanelBody>
					<PanelColorSettings
						title={ __( 'Question Color', 'vulopilot' ) }
						initialOpen={ false }
						colorSettings={ [
							{
								value: questionColor,
								onChange: ( value ) =>
									setAttributes( { questionColor: value } ),
								label: __( 'Text color', 'vulopilot' ),
							},
						] }
					/>
					<PanelBody
						title={ __( 'Answer Style', 'vulopilot' ) }
						initialOpen={ false }
					>
						<FontSizePicker
							value={ answerFontSize }
							onChange={ ( value ) =>
								setAttributes( { answerFontSize: value } )
							}
							__next40pxDefaultSize
						/>
					</PanelBody>
					<PanelColorSettings
						title={ __( 'Answer Color', 'vulopilot' ) }
						initialOpen={ false }
						colorSettings={ [
							{
								value: answerColor,
								onChange: ( value ) =>
									setAttributes( { answerColor: value } ),
								label: __( 'Text color', 'vulopilot' ),
							},
						] }
					/>
				</InspectorControls>
				{ /* Block-wide margin/padding/border/background/font size - real core
				 * Settings-tab controls `"supports"` in block.json turns on, not
				 * hand-built here. Question/answer color + font size above are the
				 * 2 things that support doesn't cover per-element, so those are
				 * this block's own controls, applied as inline styles below and
				 * mirrored in FaqRenderer::render() for the front end. */ }
				<div { ...blockProps }>
					{ questions.length === 0 && (
						<p className="vulopilot-faq__empty">
							{ __(
								'Add a question below to get started.',
								'vulopilot'
							) }
						</p>
					) }
					{ questions.map( ( item, index ) => (
						<div className="vulopilot-faq__editor-row" key={ index }>
							<RichText
								tagName="div"
								className="vulopilot-faq__question-input"
								style={ questionStyle }
								placeholder={ __( 'Question', 'vulopilot' ) }
								value={ item.question }
								onChange={ ( value ) =>
									updateQuestion( index, 'question', value )
								}
							/>
							<RichText
								tagName="div"
								className="vulopilot-faq__answer-input"
								style={ answerStyle }
								placeholder={ __( 'Answer', 'vulopilot' ) }
								value={ item.answer }
								onChange={ ( value ) =>
									updateQuestion( index, 'answer', value )
								}
							/>
							<Button
								variant="secondary"
								isDestructive
								onClick={ () => removeRow( index ) }
							>
								{ __( 'Remove', 'vulopilot' ) }
							</Button>
						</div>
					) ) }
					<Button variant="primary" onClick={ addRow }>
						{ __( 'Add Question', 'vulopilot' ) }
					</Button>
				</div>
			</>
		);
	},

	// Dynamic block - render.php builds both the visible <details> markup
	// and the real FAQPage JSON-LD from these same attributes, so save()
	// persists nothing.
	save: () => null,
} );
