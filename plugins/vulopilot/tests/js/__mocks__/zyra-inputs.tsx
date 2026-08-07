/**
 * Test double for '@zyra/inputs' — see zyra-core.js's own docblock for why.
 */
import type { MouseEvent } from 'react';

export const TextInput = ( {
	type,
	value,
	onChange,
}: {
	type?: string;
	value: string | number;
	/* eslint-disable-next-line no-unused-vars -- named param on a type-only call signature; base no-unused-vars doesn't recognize TS call-signature parameters, same as StatWidget.tsx's StatWidgetConfig */
	onChange: ( value: string ) => void;
} ) => (
	<input
		type={ 'number' === type ? 'number' : 'text' }
		value={ value }
		onChange={ ( event ) => onChange( event.target.value ) }
	/>
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
