import { useEffect, useRef, useState } from '@wordpress/element';
import { __, sprintf } from '@wordpress/i18n';

export interface TermOption {
	value: string;
	label: string;
}

interface TermPickerProps {
	/** Section heading, e.g. "Category". */
	label: string;
	/** Lower-case singular noun for placeholders and messages, e.g. "category". */
	noun: string;
	/** Its plural, for the empty state, e.g. "categories". */
	plural: string;
	options: TermOption[];
	/** Selected slugs. In `single` mode zero or one. */
	value: string[];
	onChange: ( value: string[] ) => void;
	/** Creates a new term from a typed name; resolves to its option, or null if it could not be created. */
	onCreate: ( name: string ) => Promise< TermOption | null >;
	/** One choice only (brand, supplier): picking replaces the current one. */
	single?: boolean;
}

/** Child categories arrive indented with "- " prefixes for the old checkbox list; chips show just the name. */
const plain = ( label: string ) => label.replace( /^(- )+/, '' );

/**
 * One line per taxonomy: the chosen terms as chips, then a quiet "+ Add" button. Clicking it opens a single input with
 * a short list underneath - pick an existing term, or type a new name and press Enter to create it on the spot. The
 * input closes after a pick (or when you click away), so the card stays compact. Shared by categories, tags, brand,
 * collections and the Pro supplier field.
 */
export function TermPicker( { label, noun, plural, options, value, onChange, onCreate, single = false }: TermPickerProps ) {
	const [ isOpen, setIsOpen ] = useState( false );
	const [ query, setQuery ] = useState( '' );
	const [ isCreating, setIsCreating ] = useState( false );
	const rootRef = useRef< HTMLDivElement >( null );
	const inputRef = useRef< HTMLInputElement >( null );

	const typed = query.trim();
	const selected = value.map( ( slug ) => options.find( ( option ) => option.value === slug ) ?? { value: slug, label: slug } );
	const available = options.filter( ( option ) => ! value.includes( option.value ) );
	const matches = typed ? available.filter( ( option ) => plain( option.label ).toLowerCase().includes( typed.toLowerCase() ) ) : available;
	const exact = options.find( ( option ) => plain( option.label ).toLowerCase() === typed.toLowerCase() );

	const close = () => {
		setIsOpen( false );
		setQuery( '' );
	};

	useEffect( () => {
		if ( ! isOpen ) {
			return;
		}

		inputRef.current?.focus();

		const onPointerDown = ( event: MouseEvent ) => {
			if ( rootRef.current && ! rootRef.current.contains( event.target as Node ) ) {
				close();
			}
		};

		document.addEventListener( 'mousedown', onPointerDown );
		return () => document.removeEventListener( 'mousedown', onPointerDown );
	}, [ isOpen ] );

	const choose = ( slug: string ) => {
		onChange( single ? [ slug ] : [ ...value, slug ] );
		setQuery( '' );

		if ( single ) {
			close();
		} else {
			inputRef.current?.focus();
		}
	};

	const create = () => {
		if ( ! typed || isCreating ) {
			return;
		}

		if ( exact ) {
			if ( ! value.includes( exact.value ) ) {
				choose( exact.value );
			}

			setQuery( '' );
			return;
		}

		setIsCreating( true );

		onCreate( typed )
			.then( ( created ) => {
				if ( created ) {
					choose( created.value );
				}
			} )
			.finally( () => setIsCreating( false ) );
	};

	return (
		<div className="vulocart-term-picker" ref={ rootRef }>
			<div className="vulocart-term-head">
				<h4>{ label }</h4>
				{ ! isOpen && (
					<button type="button" className="vulocart-term-add" onClick={ () => setIsOpen( true ) }>
						<i className="adminfont-plus" aria-hidden="true" />
						{ sprintf( single && selected.length > 0 ? /* translators: %s: noun. */ __( 'Change %s', 'vulocart' ) : /* translators: %s: noun. */ __( 'Add %s', 'vulocart' ), noun ) }
					</button>
				) }
			</div>

			{ selected.length > 0 ? (
				<div className="vulocart-term-line">
					{ selected.map( ( option ) => (
						<span className="vulocart-term-chip" key={ option.value }>
							{ plain( option.label ) }
							<button
								type="button"
								aria-label={ sprintf( /* translators: %s: term name. */ __( 'Remove %s', 'vulocart' ), plain( option.label ) ) }
								onClick={ () => onChange( value.filter( ( slug ) => slug !== option.value ) ) }
							>
								<i className="adminfont-close" aria-hidden="true" />
							</button>
						</span>
					) ) }
				</div>
			) : (
				! isOpen && <p className="vulocart-term-hint">{ sprintf( /* translators: %s: plural noun. */ __( 'No %s added', 'vulocart' ), plural ) }</p>
			) }

			{ isOpen && (
				<div className="vulocart-term-pop">
					<div className="vulocart-term-search">
						<i className="adminfont-search" aria-hidden="true" />
						<input
							ref={ inputRef }
							type="text"
							value={ query }
							disabled={ isCreating }
							placeholder={ sprintf( /* translators: %s: noun. */ __( 'Search or type a new %s…', 'vulocart' ), noun ) }
							aria-label={ sprintf( /* translators: %s: noun. */ __( 'Search or add a %s', 'vulocart' ), noun ) }
							onChange={ ( event ) => setQuery( event.target.value ) }
							onKeyDown={ ( event ) => {
								if ( 'Enter' === event.key ) {
									event.preventDefault();

									create();
								}

								if ( 'Escape' === event.key ) {
									close();
								}
							} }
						/>
						<button type="button" className="vulocart-term-done" onClick={ close }>
							{ __( 'Done', 'vulocart' ) }
						</button>
					</div>

					<ul className="vulocart-term-list" role="listbox" aria-label={ sprintf( /* translators: %s: noun. */ __( 'Available %s', 'vulocart' ), noun ) }>
						{ matches.map( ( option ) => (
							<li key={ option.value }>
								<button type="button" onClick={ () => choose( option.value ) }>
									{ plain( option.label ) }
								</button>
							</li>
						) ) }

						{ typed && ! exact && (
							<li className="is-create">
								<button type="button" disabled={ isCreating } onClick={ create }>
									<i className="adminfont-plus" aria-hidden="true" />
									{ isCreating ? __( 'Adding…', 'vulocart' ) : sprintf( /* translators: %s: typed name. */ __( 'Create “%s”', 'vulocart' ), typed ) }
								</button>
							</li>
						) }

						{ ! typed && 0 === matches.length && (
							<li className="is-empty">
								{ 0 === options.length
									? sprintf( /* translators: %s: plural noun. */ __( 'No %s yet - type a name to create the first one.', 'vulocart' ), plural )
									: __( 'Everything is already added.', 'vulocart' ) }
							</li>
						) }
					</ul>
				</div>
			) }
		</div>
	);
}

export default TermPicker;
