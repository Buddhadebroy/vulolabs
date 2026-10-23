import type { ReactNode } from 'react';

interface BaseProps {
	label: string;
	value: string;
	onChange: ( value: string ) => void;
	autoComplete?: string;
	required?: boolean;
}

/**
 * A text input with a floating label: the label sits inside the field and lifts when it has a value or focus.
 * The placeholder is a single space so `:placeholder-shown` can tell "empty" from "filled" without any state.
 */
export function TextField( { label, value, onChange, autoComplete, required, type = 'text' }: BaseProps & { type?: string } ) {
	return (
		<label className="vulocart-field">
			<input type={ type } placeholder=" " autoComplete={ autoComplete } required={ required } value={ value } onChange={ ( event ) => onChange( event.target.value ) } />
			<span>{ label }</span>
		</label>
	);
}

/** A select with the same floating label, which always rests lifted (a select is never visually empty). */
export function SelectField( { label, value, onChange, autoComplete, required, children }: BaseProps & { children: ReactNode } ) {
	return (
		<label className="vulocart-field is-select">
			<select autoComplete={ autoComplete } required={ required } value={ value } onChange={ ( event ) => onChange( event.target.value ) }>
				{ children }
			</select>
			<span>{ label }</span>
		</label>
	);
}
