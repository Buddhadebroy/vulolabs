import { useEffect, useRef, useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { SelectInput, TextInput } from '@zyra/inputs';
import { billingText, priceName } from '../../lib/priceText';
import { getPriceTypes, newPrice, priceProblem } from './prices';
import type { EditablePrice, PriceTypeDef } from './prices';

interface PriceListProps {
	prices: EditablePrice[];
	onChange: ( prices: EditablePrice[] ) => void;
	/** The currency symbol shown in front of amount inputs. */
	symbol: string;
	money: ( amount: number ) => string;
}

/**
 * The product's prices as a list: one collapsible row per price (type tag, name, amount, billing text, default
 * marker, a menu), and "Add another price". One-time ships in Free; a plugin adds the other types and their inputs
 * through `getPriceTypes()`'s filter, and this list renders whatever it is given - it never names a type.
 */
export function PriceList( { prices, onChange, symbol, money }: PriceListProps ) {
	const types = getPriceTypes();
	const typeOf = ( value: string ): PriceTypeDef | undefined => types.find( ( type ) => type.value === value );

	const [ openId, setOpenId ] = useState< string | null >( prices.length > 1 ? null : prices[ 0 ]?.id ?? null );
	const [ menuId, setMenuId ] = useState< string | null >( null );
	const [ addOpen, setAddOpen ] = useState( false );
	const rootRef = useRef< HTMLDivElement >( null );

	// Menus close on an outside click or Escape.
	useEffect( () => {
		if ( ! menuId && ! addOpen ) {
			return undefined;
		}

		const onPointerDown = ( event: MouseEvent ) => {
			if ( rootRef.current && ! rootRef.current.contains( event.target as Node ) ) {
				setMenuId( null );
				setAddOpen( false );
			}
		};
		const onKeyDown = ( event: KeyboardEvent ) => {
			if ( 'Escape' === event.key ) {
				setMenuId( null );
				setAddOpen( false );
			}
		};

		document.addEventListener( 'mousedown', onPointerDown );
		document.addEventListener( 'keydown', onKeyDown );

		return () => {
			document.removeEventListener( 'mousedown', onPointerDown );
			document.removeEventListener( 'keydown', onKeyDown );
		};
	}, [ menuId, addOpen ] );

	const patch = ( id: string, changes: Partial< EditablePrice > ) =>
		onChange( prices.map( ( price ) => ( price.id === id ? { ...price, ...changes } : price ) ) );

	const makeDefault = ( id: string ) => {
		onChange( prices.map( ( price ) => ( { ...price, is_default: price.id === id, active: price.id === id ? true : price.active } ) ) );
		setMenuId( null );
	};

	const toggleActive = ( id: string ) => {
		const target = prices.find( ( price ) => price.id === id );

		if ( ! target ) {
			return;
		}

		if ( target.active ) {
			const fallback = prices.find( ( price ) => price.id !== id && price.active );

			// A price list needs at least one price that can be bought.
			if ( ! fallback ) {
				return;
			}

			onChange(
				prices.map( ( price ) =>
					price.id === id ? { ...price, active: false, is_default: false } : { ...price, is_default: target.is_default ? price.id === fallback.id : price.is_default }
				)
			);
		} else {
			patch( id, { active: true } );
		}

		setMenuId( null );
	};

	const duplicate = ( id: string ) => {
		const index = prices.findIndex( ( price ) => price.id === id );
		const source = prices[ index ];
		const copy: EditablePrice = { ...source, id: newPrice( types[ 0 ] ).id, label: source.label ? `${ source.label } (copy)` : '', is_default: false };

		onChange( [ ...prices.slice( 0, index + 1 ), copy, ...prices.slice( index + 1 ) ] );
		setOpenId( copy.id );
		setMenuId( null );
	};

	const remove = ( id: string ) => {
		if ( prices.length < 2 ) {
			return;
		}

		const remaining = prices.filter( ( price ) => price.id !== id );
		const removedDefault = prices.find( ( price ) => price.id === id )?.is_default;

		onChange( remaining.map( ( price, index ) => ( removedDefault ? { ...price, is_default: 0 === index } : price ) ) );
		setMenuId( null );
		setOpenId( null );
	};

	const add = ( type: PriceTypeDef ) => {
		const created = newPrice( type, { is_default: 0 === prices.length } );

		onChange( [ ...prices, created ] );
		setOpenId( created.id );
		setAddOpen( false );
	};

	const changeType = ( price: EditablePrice, next: PriceTypeDef ) =>
		patch( price.id, { type: next.value, interval: '', interval_count: '1', payments: '', trial_days: '0', ...next.defaults } );

	const toNumber = ( value: string ) => Number( value ) || 0;

	return (
		<div className="vulocart-prices" ref={ rootRef }>
			<div className="vulocart-price-head">
				<h4>{ __( 'Prices', 'vulocart' ) }</h4>
			<div className="vulocart-price-add">
				{ types.length > 1 ? (
					<>
						<button type="button" className="vulocart-add-link" aria-haspopup="menu" aria-expanded={ addOpen } onClick={ () => setAddOpen( ! addOpen ) }>
							<i className="adminfont-plus" aria-hidden="true" />
							{ __( 'Add price', 'vulocart' ) }
						</button>
						{ addOpen && (
							<ul className="vulocart-status-menu vulocart-price-menu vulocart-price-add-menu" role="menu">
								{ types.map( ( type ) => (
									<li key={ type.value }>
										<button type="button" role="menuitem" onClick={ () => add( type ) }>
											<span className={ `vulocart-price-tag ${ type.tone }` }>{ type.label }</span>
											<small>{ type.description }</small>
										</button>
									</li>
								) ) }
							</ul>
						) }
					</>
				) : (
					<button type="button" className="vulocart-add-link" onClick={ () => add( types[ 0 ] ) }>
						<i className="adminfont-plus" aria-hidden="true" />
							{ __( 'Add price', 'vulocart' ) }
					</button>
				) }
			</div>
			</div>

			<ul className="vulocart-price-rows">
				{ prices.map( ( price ) => {
					const def = typeOf( price.type );
					const isOpen = openId === price.id;
					const problem = priceProblem( price, def );
					const hasSale = Number( price.sale_amount ) > 0 && Number( price.sale_amount ) < Number( price.amount );
					const billing = billingText( { type: price.type, interval: price.interval, interval_count: price.interval_count, payments: price.payments } );

					return (
						<li
							key={ price.id }
							className={ `vulocart-price-row${ isOpen ? ' is-open' : '' }${ price.active ? '' : ' is-off' }${ problem ? ' has-problem' : '' }` }
						>
							<div className="vulocart-price-row-head">
								<button
									type="button"
									className="vulocart-price-row-toggle"
									aria-expanded={ isOpen }
									onClick={ () => setOpenId( isOpen ? null : price.id ) }
								>
									<span className={ `vulocart-price-tag ${ def?.tone ?? 'is-unknown' }` }>{ def?.label ?? price.type.replace( /_/g, ' ' ) }</span>
									<span className="vulocart-price-row-line">
										<strong>{ priceName( price.label ) }</strong>
										<span className="vulocart-price-row-amount">
											{ price.amount ? money( toNumber( hasSale ? price.sale_amount : price.amount ) ) : __( 'No amount yet', 'vulocart' ) }
											{ hasSale && <s>{ money( toNumber( price.amount ) ) }</s> }
										</span>
										{ billing && <em>{ billing }</em> }
									</span>
								</button>

								<span className="vulocart-price-row-badges">
									{ price.is_default && <span className="vulocart-price-default">{ __( 'Default', 'vulocart' ) }</span> }
									{ ! price.active && <span className="vulocart-price-inactive">{ __( 'Inactive', 'vulocart' ) }</span> }
									{ ! def && <span className="vulocart-price-inactive">{ __( 'Plugin inactive', 'vulocart' ) }</span> }
								</span>

								<div className="vulocart-price-row-actions">
									<button
										type="button"
										className="vulocart-price-icon"
										aria-haspopup="menu"
										aria-expanded={ menuId === price.id }
										aria-label={ __( 'Price options', 'vulocart' ) }
										onClick={ () => setMenuId( menuId === price.id ? null : price.id ) }
									>
										<i className="adminfont-more-vertical" aria-hidden="true" />
									</button>
									<button
										type="button"
										className="vulocart-price-icon"
										aria-label={ isOpen ? __( 'Collapse price', 'vulocart' ) : __( 'Edit price', 'vulocart' ) }
										onClick={ () => setOpenId( isOpen ? null : price.id ) }
									>
										<i className={ `adminfont-keyboard-arrow-down${ isOpen ? ' is-flipped' : '' }` } aria-hidden="true" />
									</button>

									{ menuId === price.id && (
										<ul className="vulocart-status-menu vulocart-price-menu" role="menu">
											{ ! price.is_default && (
												<li>
													<button type="button" role="menuitem" onClick={ () => makeDefault( price.id ) }>
														{ __( 'Make default', 'vulocart' ) }
													</button>
												</li>
											) }
											<li>
												<button type="button" role="menuitem" onClick={ () => duplicate( price.id ) }>
													{ __( 'Duplicate', 'vulocart' ) }
												</button>
											</li>
											<li>
												<button type="button" role="menuitem" onClick={ () => toggleActive( price.id ) }>
													{ price.active ? __( 'Deactivate', 'vulocart' ) : __( 'Activate', 'vulocart' ) }
												</button>
											</li>
											<li>
												<button type="button" role="menuitem" className="is-danger" disabled={ prices.length < 2 } onClick={ () => remove( price.id ) }>
													{ __( 'Delete', 'vulocart' ) }
												</button>
											</li>
										</ul>
									) }
								</div>
							</div>

							{ isOpen && (
								<div className="vulocart-price-row-body">
									<div className="vulocart-price-edit-grid">
										<div className="vulocart-price-field is-wide">
											<label htmlFor={ `${ price.id }-label` }>
												{ __( 'Name', 'vulocart' ) }
												<em>{ __( 'shown to customers', 'vulocart' ) }</em>
											</label>
											<TextInput
												name={ `${ price.id }-label` }
												placeholder={ __( 'e.g. Standard, Team, Lifetime', 'vulocart' ) }
												value={ price.label }
												onChange={ ( value ) => patch( price.id, { label: String( value ) } ) }
											/>
										</div>

										{ types.length > 1 && (
											<div className="vulocart-price-field">
												<label htmlFor={ `${ price.id }-type` }>{ __( 'Type', 'vulocart' ) }</label>
												<SelectInput
													name={ `${ price.id }-type` }
													type="single-select"
													options={ types.map( ( type ) => ( { label: type.label, value: type.value } ) ) }
													value={ price.type }
													onChange={ ( value ) => {
														const next = typeOf( value as string );

														if ( next ) {
															changeType( price, next );
														}
													} }
												/>
											</div>
										) }

										<div className="vulocart-price-field">
											<label htmlFor={ `${ price.id }-amount` }>
												{ 'one_time' === price.type ? __( 'Regular price', 'vulocart' ) : __( 'Amount', 'vulocart' ) }
											</label>
											<div className="vulocart-money">
												<span aria-hidden="true">{ symbol }</span>
												<TextInput
													type="number"
													name={ `${ price.id }-amount` }
													placeholder="0.00"
													value={ price.amount }
													onChange={ ( value ) => patch( price.id, { amount: String( value ) } ) }
												/>
											</div>
										</div>

										<div className="vulocart-price-field">
											<label htmlFor={ `${ price.id }-sale` }>
												{ __( 'Sale price', 'vulocart' ) }
												<em>{ __( 'optional', 'vulocart' ) }</em>
											</label>
											<div className={ `vulocart-money${ problem && price.sale_amount ? ' has-error' : '' }` }>
												<span aria-hidden="true">{ symbol }</span>
												<TextInput
													type="number"
													name={ `${ price.id }-sale` }
													placeholder="0.00"
													value={ price.sale_amount }
													onChange={ ( value ) => patch( price.id, { sale_amount: String( value ) } ) }
												/>
												{ hasSale && (
													<b className="vulocart-money-badge">-{ Math.round( ( 1 - toNumber( price.sale_amount ) / toNumber( price.amount ) ) * 100 ) }%</b>
												) }
											</div>
										</div>

										{ def?.fields.map( ( field ) => (
											<div className="vulocart-price-field" key={ field.key }>
												<label htmlFor={ `${ price.id }-${ field.key }` }>{ field.label }</label>
												{ 'select' === field.kind ? (
													<SelectInput
														name={ `${ price.id }-${ field.key }` }
														type="single-select"
														options={ field.options ?? [] }
														value={ price[ field.key ] }
														onChange={ ( value ) => patch( price.id, { [ field.key ]: value as string } ) }
													/>
												) : (
													<TextInput
														type="number"
														name={ `${ price.id }-${ field.key }` }
														value={ price[ field.key ] }
														onChange={ ( value ) => patch( price.id, { [ field.key ]: String( value ) } ) }
													/>
												) }
												{ field.hint && <p className="vulocart-field-hint">{ field.hint }</p> }
											</div>
										) ) }
									</div>

									{ problem && <p className="vulocart-price-problem">{ problem }</p> }
									{ def?.description && <p className="vulocart-price-type-note">{ def.description }</p> }
								</div>
							) }
						</li>
					);
				} ) }
			</ul>

		</div>
	);
}

export default PriceList;
