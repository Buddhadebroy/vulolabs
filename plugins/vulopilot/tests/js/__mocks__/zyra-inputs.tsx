/**
 * Test double for '@zyra/inputs' — see zyra-core.js's own docblock for why.
 */
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

export const ButtonInput = ( {
	buttons,
}: {
	buttons: {
		text: string;
		icon?: string;
		onClick: () => void;
		disabled?: boolean;
	};
} ) => (
	<button onClick={ buttons.onClick } disabled={ buttons.disabled }>
		{ buttons.text }
	</button>
);
