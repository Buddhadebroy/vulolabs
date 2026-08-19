import { registerBlockType } from '@wordpress/blocks';
import { __ } from '@wordpress/i18n';
import { useBlockProps, RichText, PlainText } from '@wordpress/block-editor';
import { Button } from '@wordpress/components';
import metadata from './block.json';

registerBlockType( metadata.name, {
	edit: ( { attributes, setAttributes } ) => {
		const { questions } = attributes;
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

		return (
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
						<PlainText
							className="vulopilot-faq__question-input"
							placeholder={ __( 'Question', 'vulopilot' ) }
							value={ item.question }
							onChange={ ( value ) =>
								updateQuestion( index, 'question', value )
							}
						/>
						<RichText
							tagName="div"
							className="vulopilot-faq__answer-input"
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
		);
	},

	// Dynamic block — render.php builds both the visible <details> markup
	// and the real FAQPage JSON-LD from these same attributes, so save()
	// persists nothing.
	save: () => null,
} );
