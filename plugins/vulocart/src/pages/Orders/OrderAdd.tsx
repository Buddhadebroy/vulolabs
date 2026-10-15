/* global vulocartLocalizer */
import { useEffect, useMemo, useRef, useState } from '@wordpress/element';
import { __, sprintf } from '@wordpress/i18n';
import axios from 'axios';
import { getApiLink } from '@zyra/core';
import { CardComponent, FormGroupWrapperComponent, FormGroupComponent } from '@zyra/components';
import { TextInput, ButtonInput } from '@zyra/inputs';
import { showErrorToast, errorMessageOf } from '../../lib/rest-errors';
import './orders-page.scss';
import '../Products/products-page.scss';

interface ProductSummary {
	id: number;
	title: string;
	sku?: string | null;
	type?: string;
	price: number | null;
	currency: string | null;
}

interface DraftLine {
	product_id: number;
	title: string;
	sku?: string | null;
	quantity: number;
	unit_price: number | null;
	currency: string | null;
}

interface CustomerSummary {
	id: number;
	name: string | null;
	email: string;
	total_orders?: number;
}

const headers = () => ( { 'X-WP-Nonce': vulocartLocalizer.nonce } );

/**
 * The "Add New" order page - an admin building an order on a customer's behalf (a phone or email order)
 * with no cart involved. Same shell as the order and product edit pages. It saves a draft order
 * (`FulfillmentStatus::DRAFT`) and lands on its edit page, where payment, fulfilment, addresses and
 * documents are handled.
 *
 * - Items: search the catalogue, click to add, set quantities; the total updates as you go.
 * - Customer: pick an existing customer or just type an email and name for a one-off.
 * - Tags: applied right after the order is created.
 */
export function OrderAdd() {
	const [ products, setProducts ] = useState< ProductSummary[] >( [] );
	const [ productsLoaded, setProductsLoaded ] = useState( false );
	const [ productQuery, setProductQuery ] = useState( '' );
	const [ lines, setLines ] = useState< DraftLine[] >( [] );

	const [ customerEmail, setCustomerEmail ] = useState( '' );
	const [ customerName, setCustomerName ] = useState( '' );
	const [ linkedCustomer, setLinkedCustomer ] = useState< CustomerSummary | null >( null );
	const [ customerQuery, setCustomerQuery ] = useState( '' );
	const [ customerResults, setCustomerResults ] = useState< CustomerSummary[] >( [] );
	const [ showCustomerResults, setShowCustomerResults ] = useState( false );
	const customerBox = useRef< HTMLDivElement >( null );

	const [ tags, setTags ] = useState< string[] >( [] );
	const [ tagDraft, setTagDraft ] = useState( '' );
	const [ isSaving, setIsSaving ] = useState( false );

	useEffect( () => {
		axios
			.get< ProductSummary[] >( getApiLink( vulocartLocalizer, 'products' ), { headers: headers(), params: { per_page: 100 } } )
			.then( ( response ) => setProducts( response.data || [] ) )
			.catch( ( error ) => showErrorToast( errorMessageOf( error ) ) )
			.finally( () => setProductsLoaded( true ) );
	}, [] );

	// Existing customers, searched as you type.
	useEffect( () => {
		if ( customerQuery.trim().length < 2 ) {
			setCustomerResults( [] );

			return undefined;
		}

		const timer = window.setTimeout( () => {
			axios
				.get< CustomerSummary[] >( getApiLink( vulocartLocalizer, 'customers' ), {
					headers: headers(),
					params: { search: customerQuery.trim(), per_page: 6 },
				} )
				.then( ( response ) => setCustomerResults( response.data || [] ) )
				.catch( () => setCustomerResults( [] ) );
		}, 250 );

		return () => window.clearTimeout( timer );
	}, [ customerQuery ] );

	useEffect( () => {
		const close = ( event: MouseEvent ) => {
			if ( customerBox.current && ! customerBox.current.contains( event.target as Node ) ) {
				setShowCustomerResults( false );
			}
		};

		document.addEventListener( 'mousedown', close );

		return () => document.removeEventListener( 'mousedown', close );
	}, [] );

	const matches = useMemo( () => {
		const needle = productQuery.trim().toLowerCase();
		const taken = new Set( lines.map( ( line ) => line.product_id ) );

		return products
			.filter( ( product ) => ! taken.has( product.id ) )
			.filter( ( product ) => ! needle || `${ product.title } ${ product.sku ?? '' }`.toLowerCase().includes( needle ) )
			.slice( 0, 8 );
	}, [ products, productQuery, lines ] );

	const addLine = ( product: ProductSummary ) => {
		setLines( ( current ) => [
			...current,
			{ product_id: product.id, title: product.title, sku: product.sku, quantity: 1, unit_price: product.price, currency: product.currency },
		] );
		setProductQuery( '' );
	};

	const setQuantity = ( productId: number, quantity: number ) => {
		if ( quantity <= 0 ) {
			setLines( ( current ) => current.filter( ( line ) => line.product_id !== productId ) );

			return;
		}

		setLines( ( current ) => current.map( ( line ) => ( line.product_id === productId ? { ...line, quantity } : line ) ) );
	};

	const total = lines.reduce( ( sum, line ) => sum + ( line.unit_price ?? 0 ) * line.quantity, 0 );
	const units = lines.reduce( ( sum, line ) => sum + line.quantity, 0 );
	const currency = lines[ 0 ]?.currency ?? '';

	const chooseCustomer = ( customer: CustomerSummary ) => {
		setLinkedCustomer( customer );
		setCustomerEmail( customer.email );
		setCustomerName( customer.name || '' );
		setCustomerQuery( '' );
		setShowCustomerResults( false );
	};

	const clearCustomer = () => {
		setLinkedCustomer( null );
		setCustomerEmail( '' );
		setCustomerName( '' );
	};

	const addTag = () => {
		const tag = tagDraft.trim();

		if ( tag && ! tags.includes( tag ) ) {
			setTags( [ ...tags, tag ] );
		}

		setTagDraft( '' );
	};

	const isDirty = lines.length > 0 || !! customerEmail || !! customerName || tags.length > 0;

	useEffect( () => {
		if ( ! isDirty || isSaving ) {
			return undefined;
		}

		const warn = ( event: BeforeUnloadEvent ) => {
			event.preventDefault();
			event.returnValue = '';
		};

		window.addEventListener( 'beforeunload', warn );

		return () => window.removeEventListener( 'beforeunload', warn );
	}, [ isDirty, isSaving ] );

	const handleSave = () => {
		if ( 0 === lines.length ) {
			showErrorToast( __( 'Add at least one item first.', 'vulocart' ) );

			return;
		}

		setIsSaving( true );

		axios
			.post(
				getApiLink( vulocartLocalizer, 'orders/manual' ),
				{
					items: lines.map( ( line ) => ( { product_id: line.product_id, quantity: line.quantity } ) ),
					customer_email: customerEmail || undefined,
					customer_name: customerName || undefined,
				},
				{ headers: headers() }
			)
			.then( ( response ) => {
				const go = () => {
					window.location.href = `admin.php?page=vulocart-orders&action=edit&id=${ response.data.id }`;
				};

				if ( 0 === tags.length ) {
					go();

					return undefined;
				}

				return axios.patch( getApiLink( vulocartLocalizer, `orders/${ response.data.id }` ), { tags }, { headers: headers() } ).finally( go );
			} )
			.catch( ( error ) => {
				showErrorToast( errorMessageOf( error ) );
				setIsSaving( false );
			} );
	};

	return (
		<div className="vulocart-product-edit-page vulocart-order-edit-page">
			<div className="vulocart-product-edit-topbar">
				<div>
					<nav className="vulocart-breadcrumbs" aria-label={ __( 'Breadcrumb', 'vulocart' ) }>
						<a href="admin.php?page=vulocart-orders">{ __( 'Orders', 'vulocart' ) }</a>
						<i className="adminfont-pagination-next-arrow" aria-hidden="true" />
						<span aria-current="page">{ __( 'Add Order', 'vulocart' ) }</span>
					</nav>
					<h1 className="vulocart-edit-page-title">{ __( 'New order', 'vulocart' ) }</h1>
					<div className="vulocart-title-meta">
						<span className="vulocart-status-tag is-draft">
							<i aria-hidden="true" />
							{ __( 'Draft', 'vulocart' ) }
						</span>
						<span className="vulocart-pill is-kind">{ __( 'Created by you', 'vulocart' ) }</span>
					</div>
				</div>

				<div className="vulocart-topbar-actions">
					{ isDirty && (
						<span className="vulocart-unsaved" role="status">
							<i aria-hidden="true" />
							{ __( 'Unsaved changes', 'vulocart' ) }
						</span>
					) }
					<ButtonInput
						buttons={ [
							{
								icon: 'save',
								text: isSaving ? __( 'Saving…', 'vulocart' ) : __( 'Save as draft', 'vulocart' ),
								onClick: handleSave,
								disabled: isSaving || 0 === lines.length,
							},
						] }
					/>
				</div>
			</div>

			<div className="vulocart-product-edit-grid">
				<div className="vulocart-product-edit-col vulocart-product-edit-col--center">
					<CardComponent
						titleIcon="catalog"
						title={ __( 'Items', 'vulocart' ) }
						desc={ lines.length > 0 ? sprintf( /* translators: %d: number of units. */ __( '%d item(s) on this order.', 'vulocart' ), units ) : __( 'Search your catalogue and click a product to add it.', 'vulocart' ) }
					>
						<div className="vulocart-order-add-search">
							<i className="adminfont-search" aria-hidden="true" />
							<input
								type="text"
								value={ productQuery }
								placeholder={ __( 'Search products by name or SKU…', 'vulocart' ) }
								onChange={ ( event ) => setProductQuery( event.target.value ) }
							/>
						</div>

						{ productsLoaded && 0 === products.length ? (
							<p className="vulocart-field-hint">
								{ __( 'Your catalogue is empty.', 'vulocart' ) }{ ' ' }
								<a className="vulocart-order-missing" href="admin.php?page=vulocart-products&action=add">
									<i className="adminfont-plus" aria-hidden="true" />
									{ __( 'Add a product', 'vulocart' ) }
								</a>
							</p>
						) : (
							matches.length > 0 && (
								<ul className="vulocart-order-add-results">
									{ matches.map( ( product ) => (
										<li key={ product.id }>
											<button type="button" onClick={ () => addLine( product ) }>
												<span>
													<strong>{ product.title }</strong>
													{ product.sku && <small>{ product.sku }</small> }
												</span>
												<em>{ null !== product.price ? `${ product.price } ${ product.currency ?? '' }` : '—' }</em>
												<i className="adminfont-plus" aria-hidden="true" />
											</button>
										</li>
									) ) }
								</ul>
							)
						) }
						{ productsLoaded && products.length > 0 && productQuery && 0 === matches.length && (
							<p className="vulocart-field-hint">{ __( 'No product matches that search.', 'vulocart' ) }</p>
						) }

						{ lines.length > 0 && (
							<table className="vulocart-order-items-table vulocart-order-add-table">
								<thead>
									<tr>
										<th>{ __( 'Item', 'vulocart' ) }</th>
										<th>{ __( 'Price', 'vulocart' ) }</th>
										<th>{ __( 'Qty', 'vulocart' ) }</th>
										<th>{ __( 'Total', 'vulocart' ) }</th>
										<th />
									</tr>
								</thead>
								<tbody>
									{ lines.map( ( line ) => (
										<tr key={ line.product_id }>
											<td>
												<strong>{ line.title }</strong>
												{ line.sku && <small className="vulocart-order-add-sku">{ line.sku }</small> }
											</td>
											<td>{ ( line.unit_price ?? 0 ).toFixed( 2 ) }</td>
											<td>
												<div className="vulocart-order-add-stepper">
													<button type="button" aria-label={ __( 'Decrease quantity', 'vulocart' ) } onClick={ () => setQuantity( line.product_id, line.quantity - 1 ) }>
														−
													</button>
													<span>{ line.quantity }</span>
													<button type="button" aria-label={ __( 'Increase quantity', 'vulocart' ) } onClick={ () => setQuantity( line.product_id, line.quantity + 1 ) }>
														+
													</button>
												</div>
											</td>
											<td>
												{ ( ( line.unit_price ?? 0 ) * line.quantity ).toFixed( 2 ) } { line.currency }
											</td>
											<td>
												<button type="button" className="vulocart-order-add-remove" aria-label={ __( 'Remove item', 'vulocart' ) } onClick={ () => setQuantity( line.product_id, 0 ) }>
													×
												</button>
											</td>
										</tr>
									) ) }
								</tbody>
							</table>
						) }

						{ lines.length > 0 && (
							<div className="vulocart-order-summary-rows">
								<div className="vulocart-order-summary-row vulocart-order-summary-row--total">
									<strong>{ __( 'Subtotal', 'vulocart' ) }</strong>
									<strong>
										{ total.toFixed( 2 ) } { currency }
									</strong>
								</div>
								<p className="vulocart-field-hint">{ __( 'Shipping, tax and discounts are worked out once the order is saved.', 'vulocart' ) }</p>
							</div>
						) }
					</CardComponent>
				</div>

				<div className="vulocart-product-edit-col vulocart-product-edit-col--right">
					<CardComponent titleIcon="user" title={ __( 'Customer', 'vulocart' ) } desc={ __( 'Who is this order for?', 'vulocart' ) }>
						{ linkedCustomer ? (
							<div className="vulocart-order-customer-head">
								<span className="vulocart-order-avatar" aria-hidden="true">
									{ ( linkedCustomer.name || linkedCustomer.email ).charAt( 0 ).toUpperCase() }
								</span>
								<div>
									<p className="vulocart-order-customer-name">{ linkedCustomer.name || linkedCustomer.email }</p>
									<span className="vulocart-order-customer-email">{ linkedCustomer.email }</span>
								</div>
								<button type="button" className="vulocart-order-add-remove" aria-label={ __( 'Use a different customer', 'vulocart' ) } onClick={ clearCustomer }>
									×
								</button>
							</div>
						) : (
							<>
								<div className="vulocart-order-add-customer" ref={ customerBox }>
									<div className="vulocart-order-add-search">
										<i className="adminfont-search" aria-hidden="true" />
										<input
											type="text"
											value={ customerQuery }
											placeholder={ __( 'Find an existing customer…', 'vulocart' ) }
											onFocus={ () => setShowCustomerResults( true ) }
											onChange={ ( event ) => {
												setCustomerQuery( event.target.value );
												setShowCustomerResults( true );
											} }
										/>
									</div>
									{ showCustomerResults && customerQuery.trim().length >= 2 && (
										<ul className="vulocart-order-add-results is-floating">
											{ customerResults.length > 0 ? (
												customerResults.map( ( customer ) => (
													<li key={ customer.id }>
														<button type="button" onClick={ () => chooseCustomer( customer ) }>
															<span>
																<strong>{ customer.name || customer.email }</strong>
																{ customer.name && <small>{ customer.email }</small> }
															</span>
														</button>
													</li>
												) )
											) : (
												<li className="vulocart-field-hint">{ __( 'No customer found - fill in the details below for a one-off.', 'vulocart' ) }</li>
											) }
										</ul>
									) }
								</div>

								<p className="vulocart-order-add-or">{ __( 'or enter details', 'vulocart' ) }</p>

								<FormGroupWrapperComponent>
									<FormGroupComponent label={ __( 'Email', 'vulocart' ) } htmlFor="vulocart-order-add-email">
										<TextInput id="vulocart-order-add-email" name="customer_email" type="email" value={ customerEmail } onChange={ ( value ) => setCustomerEmail( value as string ) } />
									</FormGroupComponent>
									<FormGroupComponent label={ __( 'Name', 'vulocart' ) } htmlFor="vulocart-order-add-name">
										<TextInput id="vulocart-order-add-name" name="customer_name" type="text" value={ customerName } onChange={ ( value ) => setCustomerName( value as string ) } />
									</FormGroupComponent>
								</FormGroupWrapperComponent>
								<p className="vulocart-field-hint">{ __( 'Optional - leave blank for an anonymous order.', 'vulocart' ) }</p>
							</>
						) }
					</CardComponent>

					<CardComponent titleIcon="tag" title={ __( 'Tags', 'vulocart' ) }>
						<div className="vulocart-order-tags">
							{ tags.map( ( tag ) => (
								<span key={ tag } className="vulocart-order-tag">
									{ tag }
									<button type="button" aria-label={ sprintf( /* translators: %s: tag. */ __( 'Remove %s', 'vulocart' ), tag ) } onClick={ () => setTags( tags.filter( ( t ) => t !== tag ) ) }>
										×
									</button>
								</span>
							) ) }
						</div>
						<input
							type="text"
							className="vulocart-order-tag-input"
							value={ tagDraft }
							placeholder={ __( 'Add a tag and press Enter', 'vulocart' ) }
							onChange={ ( event ) => setTagDraft( event.target.value ) }
							onKeyDown={ ( event ) => {
								if ( 'Enter' === event.key ) {
									event.preventDefault();
									addTag();
								}
							} }
						/>
					</CardComponent>

					<CardComponent titleIcon="clock" title={ __( 'What happens next', 'vulocart' ) }>
						<ol className="vulocart-order-add-next">
							<li>{ __( 'The order is saved as a draft - nothing is charged.', 'vulocart' ) }</li>
							<li>{ __( 'On the next screen, set the payment and fulfillment status, add addresses and create a shipment.', 'vulocart' ) }</li>
							<li>{ __( 'Print the invoice or packing slip from the Documents card.', 'vulocart' ) }</li>
						</ol>
					</CardComponent>
				</div>
			</div>
		</div>
	);
}

export default OrderAdd;
