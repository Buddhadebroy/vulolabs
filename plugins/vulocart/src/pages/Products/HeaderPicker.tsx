import { useEffect, useRef, useState } from '@wordpress/element';

export interface PickerOption {
	value: string;
	label: string;
	hint?: string;
}

interface HeaderPickerProps {
	caption: string;
	ariaLabel: string;
	options: PickerOption[];
	value: string;
	onSelect: ( value: string ) => void;
}

/** A small captioned dropdown for the card header (Type, Subtype): current choice on the button, one line of help per option. */
export function HeaderPicker( { caption, ariaLabel, options, value, onSelect }: HeaderPickerProps ) {
	const [ isOpen, setIsOpen ] = useState( false );
	const rootRef = useRef< HTMLDivElement >( null );

	useEffect( () => {
		if ( ! isOpen ) {
			return undefined;
		}

		const onPointerDown = ( event: MouseEvent ) => {
			if ( rootRef.current && ! rootRef.current.contains( event.target as Node ) ) {
				setIsOpen( false );
			}
		};
		const onKeyDown = ( event: KeyboardEvent ) => {
			if ( 'Escape' === event.key ) {
				setIsOpen( false );
			}
		};

		document.addEventListener( 'mousedown', onPointerDown );
		document.addEventListener( 'keydown', onKeyDown );

		return () => {
			document.removeEventListener( 'mousedown', onPointerDown );
			document.removeEventListener( 'keydown', onKeyDown );
		};
	}, [ isOpen ] );

	return (
		<div className="vulocart-type-picker" ref={ rootRef }>
			<span className="vulocart-type-caption">{ caption }</span>
			<button
				type="button"
				className={ `vulocart-type-button${ isOpen ? ' is-open' : '' }` }
				aria-haspopup="listbox"
				aria-expanded={ isOpen }
				onClick={ () => setIsOpen( ! isOpen ) }
			>
				<span>{ options.find( ( option ) => option.value === value )?.label ?? value }</span>
				<i className="adminfont-keyboard-arrow-down" aria-hidden="true" />
			</button>
			{ isOpen && (
				<ul className="vulocart-status-menu vulocart-type-menu vulocart-type-menu--described" role="listbox" aria-label={ ariaLabel }>
					{ options.map( ( option ) => (
						<li key={ option.value }>
							<button
								type="button"
								role="option"
								aria-selected={ option.value === value }
								className={ option.value === value ? 'is-active' : '' }
								onClick={ () => {
									onSelect( option.value );
									setIsOpen( false );
								} }
							>
								<span className="vulocart-type-option">
									<strong>{ option.label }</strong>
									{ option.hint ? <small>{ option.hint }</small> : null }
								</span>
								{ option.value === value && <i className="adminfont-check" aria-hidden="true" /> }
							</button>
						</li>
					) ) }
				</ul>
			) }
		</div>
	);
}
