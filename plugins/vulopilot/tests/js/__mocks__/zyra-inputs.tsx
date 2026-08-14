/**
 * Test double for '@zyra/inputs' — see zyra-core.js's own docblock for why.
 */
import type { MouseEvent } from 'react';

export const TextInput = ( {
	type,
	value,
	onChange,
	placeholder,
}: {
	type?: string;
	value: string | number;
	/* eslint-disable-next-line no-unused-vars -- named param on a type-only call signature; base no-unused-vars doesn't recognize TS call-signature parameters, same as StatWidget.tsx's StatWidgetConfig */
	onChange: ( value: string ) => void;
	placeholder?: string;
} ) => (
	<input
		type={ 'number' === type ? 'number' : 'text' }
		value={ value }
		placeholder={ placeholder }
		onChange={ ( event ) => onChange( event.target.value ) }
	/>
);

interface SelectOption {
	value: string;
	label: string;
}

/** Real usage: HistoryTab.tsx's date-range dropdown (`type="single-select"`). A plain native `<select>` is enough for RTL's accessible queries/`userEvent.selectOptions`. */
export const SelectInput = ( {
	options,
	value,
	onChange,
	placeholder,
}: {
	type?: string;
	options: SelectOption[];
	size?: number;
	value?: string | string[];
	/* eslint-disable-next-line no-unused-vars -- named param on a type-only call signature; base no-unused-vars doesn't recognize TS call-signature parameters. */
	onChange: ( value: string | string[] ) => void;
	placeholder?: string;
	isClearable?: boolean;
} ) => (
	<select
		value={ Array.isArray( value ) ? value[ 0 ] : value }
		onChange={ ( event ) => onChange( event.target.value ) }
	>
		{ placeholder && <option value="">{ placeholder }</option> }
		{ options.map( ( option ) => (
			<option key={ option.value } value={ option.value }>
				{ option.label }
			</option>
		) ) }
	</select>
);

interface ButtonConfig {
	text: string;
	icon?: string;
	/* eslint-disable-next-line no-unused-vars -- named param on a type-only call signature, same reasoning as this file's TextInput onChange above. */
	onClick: ( event?: MouseEvent< HTMLButtonElement > ) => void;
	disabled?: boolean;
}

/** Real ButtonInput takes either one config or an array (RunAuditWidget/AISuggestionsWidget pass an array for multiple buttons in one slot). */
export const ButtonInput = ( {
	buttons,
}: {
	buttons: ButtonConfig | ButtonConfig[];
	position?: string;
} ) => {
	const list = Array.isArray( buttons ) ? buttons : [ buttons ];
	return (
		<>
			{ list.map( ( btn, index ) => (
				<button
					key={ index }
					onClick={ btn.onClick }
					disabled={ btn.disabled }
				>
					{ btn.text }
				</button>
			) ) }
		</>
	);
};
