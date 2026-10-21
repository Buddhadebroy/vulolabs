import { useState } from '@wordpress/element';
import { __, sprintf } from '@wordpress/i18n';
import { TextAreaInput, TextInput } from '@zyra/inputs';
import type { ReactNode } from 'react';

export interface SpecRow {
	key: string;
	value: string;
}

export interface FaqRow {
	question: string;
	answer: string;
}

export interface Translation {
	title: string;
	short_description: string;
	full_description: string;
}

/** A labelled block with room on the right for an action - where an AI button sits beside its own setting. */
export function ContentBlock( { title, hint, action, onAdd, addLabel, children }: { title: string; hint?: string; action?: ReactNode; onAdd?: () => void; addLabel?: string; children: ReactNode } ) {
	return (
		<section className="vulocart-content-block">
			<header>
				<div>
					<h4>{ title }</h4>
					{ hint && <p>{ hint }</p> }
				</div>
				<div className="vulocart-content-block-actions">
					{ onAdd && (
						<button type="button" className="vulocart-add-link" onClick={ onAdd }>
							<i className="adminfont-plus" aria-hidden="true" />
							{ addLabel || __( 'Add', 'vulocart' ) }
						</button>
					) }
					{ action }
				</div>
			</header>
			{ children }
		</section>
	);
}

/** Title and description as they will read in a search result, with the length each is meant to stay under. */
export function SeoFields( {
	title,
	description,
	fallbackTitle,
	onChange,
}: {
	title: string;
	description: string;
	fallbackTitle: string;
	onChange: ( patch: { seoTitle?: string; seoDescription?: string } ) => void;
} ) {
	const counter = ( length: number, max: number ) => <span className={ `vulocart-counter${ length > max ? ' is-over' : '' }` }>{ length }/{ max }</span>;

	return (
		<>
			<div className="vulocart-content-field">
				<label htmlFor="vulocart-seo-title">
					{ __( 'SEO title', 'vulocart' ) } { counter( title.length, 60 ) }
				</label>
				<TextInput name="seoTitle" value={ title } placeholder={ fallbackTitle } onChange={ ( value ) => onChange( { seoTitle: String( value ) } ) } />
			</div>
			<div className="vulocart-content-field">
				<label htmlFor="vulocart-seo-description">
					{ __( 'Meta description', 'vulocart' ) } { counter( description.length, 160 ) }
				</label>
				<TextAreaInput name="seoDescription" rowNumber={ 2 } value={ description } onChange={ ( value ) => onChange( { seoDescription: value } ) } />
			</div>
			<div className="vulocart-serp" aria-label={ __( 'Search result preview', 'vulocart' ) }>
				<span>{ __( 'Search result preview', 'vulocart' ) }</span>
				<strong>{ title || fallbackTitle || __( 'Your product title', 'vulocart' ) }</strong>
				<p>{ description || __( 'Your meta description appears here.', 'vulocart' ) }</p>
			</div>
		</>
	);
}

/** Editor for the product's specification rows (name and value). */
export function SpecsEditor( { rows, onChange }: { rows: SpecRow[]; onChange: ( rows: SpecRow[] ) => void } ) {
	return (
		<div className="vulocart-rows">
			{ rows.map( ( row, index ) => (
				<div className="vulocart-row is-spec" key={ index }>
					<TextInput
						name={ `spec-key-${ index }` }
						placeholder={ __( 'Name, e.g. Weight', 'vulocart' ) }
						value={ row.key }
						onChange={ ( value ) => onChange( rows.map( ( current, at ) => ( at === index ? { ...current, key: String( value ) } : current ) ) ) }
					/>
					<TextInput
						name={ `spec-value-${ index }` }
						placeholder={ __( 'Value, e.g. 1.2 kg', 'vulocart' ) }
						value={ row.value }
						onChange={ ( value ) => onChange( rows.map( ( current, at ) => ( at === index ? { ...current, value: String( value ) } : current ) ) ) }
					/>
					<button type="button" className="vulocart-row-remove" aria-label={ __( 'Remove row', 'vulocart' ) } onClick={ () => onChange( rows.filter( ( _, at ) => at !== index ) ) }>
						<i className="adminfont-close" aria-hidden="true" />
					</button>
				</div>
			) ) }
		</div>
	);
}

/** Editor for the product's question and answer rows. */
export function FaqEditor( { rows, onChange }: { rows: FaqRow[]; onChange: ( rows: FaqRow[] ) => void } ) {
	return (
		<div className="vulocart-rows">
			{ rows.map( ( row, index ) => (
				<div className="vulocart-row is-faq" key={ index }>
					<div>
						<TextInput
							name={ `faq-q-${ index }` }
							placeholder={ __( 'Question', 'vulocart' ) }
							value={ row.question }
							onChange={ ( value ) => onChange( rows.map( ( current, at ) => ( at === index ? { ...current, question: String( value ) } : current ) ) ) }
						/>
						<TextAreaInput
							name={ `faq-a-${ index }` }
							rowNumber={ 2 }
							value={ row.answer }
							onChange={ ( value ) => onChange( rows.map( ( current, at ) => ( at === index ? { ...current, answer: value } : current ) ) ) }
						/>
					</div>
					<button type="button" className="vulocart-row-remove" aria-label={ __( 'Remove question', 'vulocart' ) } onClick={ () => onChange( rows.filter( ( _, at ) => at !== index ) ) }>
						<i className="adminfont-close" aria-hidden="true" />
					</button>
				</div>
			) ) }
		</div>
	);
}

/** One chip per language the listing has been translated into; opening a chip edits that translation. */
export function TranslationsEditor( {
	translations,
	onChange,
}: {
	translations: Record< string, Translation >;
	onChange: ( translations: Record< string, Translation > ) => void;
} ) {
	const locales = Object.keys( translations );
	const [ openLocale, setOpenLocale ] = useState< string | null >( null );

	if ( 0 === locales.length ) {
		return <p className="vulocart-content-empty">{ __( 'No translations yet. Use the AI button to translate this listing into another language.', 'vulocart' ) }</p>;
	}

	const patch = ( locale: string, changes: Partial< Translation > ) => onChange( { ...translations, [ locale ]: { ...translations[ locale ], ...changes } } );

	return (
		<div className="vulocart-translations">
			<ul>
				{ locales.map( ( locale ) => (
					<li key={ locale } className={ openLocale === locale ? 'is-open' : '' }>
						<button type="button" onClick={ () => setOpenLocale( openLocale === locale ? null : locale ) } aria-expanded={ openLocale === locale }>
							<b>{ locale.toUpperCase() }</b>
							<span>{ translations[ locale ].title || __( '(no title)', 'vulocart' ) }</span>
						</button>
						<button
							type="button"
							className="vulocart-row-remove"
							aria-label={ sprintf( /* translators: %s: language code. */ __( 'Remove %s translation', 'vulocart' ), locale.toUpperCase() ) }
							onClick={ () => {
								const next = { ...translations };

								delete next[ locale ];
								onChange( next );
								setOpenLocale( null );
							} }
						>
							<i className="adminfont-close" aria-hidden="true" />
						</button>
					</li>
				) ) }
			</ul>

			{ openLocale && translations[ openLocale ] && (
				<div className="vulocart-translation-edit">
					<div className="vulocart-content-field">
						<label>{ __( 'Title', 'vulocart' ) }</label>
						<TextInput name={ `t-title-${ openLocale }` } value={ translations[ openLocale ].title } onChange={ ( value ) => patch( openLocale, { title: String( value ) } ) } />
					</div>
					<div className="vulocart-content-field">
						<label>{ __( 'Short description', 'vulocart' ) }</label>
						<TextAreaInput name={ `t-short-${ openLocale }` } rowNumber={ 2 } value={ translations[ openLocale ].short_description } onChange={ ( value ) => patch( openLocale, { short_description: value } ) } />
					</div>
					<div className="vulocart-content-field">
						<label>{ __( 'Full description', 'vulocart' ) }</label>
						<TextAreaInput name={ `t-full-${ openLocale }` } rowNumber={ 4 } value={ translations[ openLocale ].full_description } onChange={ ( value ) => patch( openLocale, { full_description: value } ) } />
					</div>
				</div>
			) }
		</div>
	);
}
