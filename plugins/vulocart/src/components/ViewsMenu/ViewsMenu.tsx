import { useEffect, useRef, useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import './views-menu.scss';

export interface ViewsConfig {
	/** Whether the Views row is shown at all. */
	enabled: boolean;
	/** Ids of built-in views the merchant switched off. */
	hidden: string[];
}

const DEFAULT_CONFIG: ViewsConfig = { enabled: true, hidden: [] };

/**
 * Per-screen Views settings, kept in this browser (same low-stakes home as the saved views themselves).
 * `storageKey` is one per list screen.
 */
export function useViewsConfig( storageKey: string ): [ ViewsConfig, ( next: ViewsConfig ) => void, () => void ] {
	const [ config, setConfig ] = useState< ViewsConfig >( () => {
		try {
			const raw = window.localStorage.getItem( storageKey );
			const parsed = raw ? JSON.parse( raw ) : null;

			return parsed && 'object' === typeof parsed
				? { enabled: false !== parsed.enabled, hidden: Array.isArray( parsed.hidden ) ? parsed.hidden : [] }
				: DEFAULT_CONFIG;
		} catch {
			return DEFAULT_CONFIG;
		}
	} );

	const save = ( next: ViewsConfig ) => {
		setConfig( next );

		try {
			window.localStorage.setItem( storageKey, JSON.stringify( next ) );
		} catch {
			// Storage unavailable - the choice just lasts until reload.
		}
	};

	return [ config, save, () => save( DEFAULT_CONFIG ) ];
}

/**
 * The three-dots menu at the end of a Views row: turn the whole row on or off, switch each built-in view on or
 * off, and put everything back to the defaults.
 */
export function ViewsMenu( {
	builtIns,
	config,
	onChange,
	onRestore,
}: {
	builtIns: { id: string; label: string }[];
	config: ViewsConfig;
	onChange: ( next: ViewsConfig ) => void;
	onRestore: () => void;
} ) {
	const [ open, setOpen ] = useState( false );
	const ref = useRef< HTMLDivElement >( null );

	useEffect( () => {
		if ( ! open ) {
			return undefined;
		}

		const close = ( event: MouseEvent ) => {
			if ( ref.current && ! ref.current.contains( event.target as Node ) ) {
				setOpen( false );
			}
		};
		const escape = ( event: KeyboardEvent ) => {
			if ( 'Escape' === event.key ) {
				setOpen( false );
			}
		};

		document.addEventListener( 'mousedown', close );
		document.addEventListener( 'keydown', escape );

		return () => {
			document.removeEventListener( 'mousedown', close );
			document.removeEventListener( 'keydown', escape );
		};
	}, [ open ] );

	const isDefault = config.enabled && 0 === config.hidden.length;

	return (
		<div className="vulocart-views-menu" ref={ ref }>
			<button
				type="button"
				className="vulocart-views-menu-button"
				aria-haspopup="menu"
				aria-expanded={ open }
				aria-label={ __( 'Views options', 'vulocart' ) }
				title={ __( 'Views options', 'vulocart' ) }
				onClick={ () => setOpen( ! open ) }
			>
				<i className="adminfont-more-vertical" aria-hidden="true" />
			</button>

			{ open && (
				<div className="vulocart-views-menu-panel" role="menu">
					<label className="vulocart-views-menu-row is-main">
						<input type="checkbox" checked={ config.enabled } onChange={ ( e ) => onChange( { ...config, enabled: e.target.checked } ) } />
						<span>{ __( 'Show views', 'vulocart' ) }</span>
					</label>

					<div className="vulocart-views-menu-label">{ __( 'Built-in views', 'vulocart' ) }</div>
					{ builtIns.map( ( view ) => (
						<label key={ view.id } className={ `vulocart-views-menu-row${ config.enabled ? '' : ' is-disabled' }` }>
							<input
								type="checkbox"
								disabled={ ! config.enabled }
								checked={ ! config.hidden.includes( view.id ) }
								onChange={ ( e ) =>
									onChange( {
										...config,
										hidden: e.target.checked ? config.hidden.filter( ( id ) => id !== view.id ) : [ ...config.hidden, view.id ],
									} )
								}
							/>
							<span>{ view.label }</span>
						</label>
					) ) }

					<button
						type="button"
						className="vulocart-views-menu-restore"
						disabled={ isDefault }
						onClick={ () => {
							onRestore();
							setOpen( false );
						} }
					>
						<i className="adminfont-refresh" aria-hidden="true" />
						{ __( 'Restore defaults', 'vulocart' ) }
					</button>
				</div>
			) }
		</div>
	);
}
