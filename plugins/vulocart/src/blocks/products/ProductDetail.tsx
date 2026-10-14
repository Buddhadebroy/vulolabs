/* global vulocartFrontendData */
import { useEffect, useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { client, getOrCreateCartToken } from '../shared/cart';
import { billingText, priceName } from '../../lib/priceText';
import { formatAmount, formatPrice, humanizeKey, purchasablePrices } from '../shared/product';
import type { ProductSummary, MediaItem } from '../shared/product';
import { ctaLabel } from '../shared/cta';

interface ProductDetailProps {
	id: number;
}

/**
 * The single-product "product page" - `GET /products/{id}` (public,
 * published-only for a logged-out visitor). Reachable regardless of
 * `catalog_visibility` (including `hidden`/`search_only`, which only
 * `ProductsListing.tsx`'s grid excludes) - same WooCommerce-style
 * "unlisted but directly linkable" semantics `../shared/product.ts`'s
 * `isVisibleInListing()` docblock explains.
 *
 * "Add to cart" posts to the same `/cart/items` endpoint and shares the
 * same client-held cart token (`../shared/cart.ts`) as
 * `src/blocks/checkout/Checkout.tsx` - an item added here shows up in
 * that block's cart review, and vice versa. Gated on
 * `vulocartFrontendData.cartCheckoutEnabled` (the Frontend tab's "Enable
 * cart & checkout" toggle) the same way Checkout.tsx's whole flow is -
 * off means "Add to cart" is replaced with a plain notice rather than a
 * button nobody can complete a purchase from anyway.
 */
export function ProductDetail( { id }: ProductDetailProps ) {
	const [ product, setProduct ] = useState< ProductSummary | null >( null );
	const [ notFound, setNotFound ] = useState( false );
	const [ activeImage, setActiveImage ] = useState< MediaItem | null >( null );
	const [ quantity, setQuantity ] = useState( 1 );
	const [ isAdding, setIsAdding ] = useState( false );
	const [ added, setAdded ] = useState( false );
	const [ priceId, setPriceId ] = useState< string | null >( null );

	useEffect( () => {
		client
			.get< ProductSummary >( `/products/${ id }` )
			.then( ( response ) => {
				setProduct( response.data );
				setActiveImage( response.data.meta?.featured_image ?? null );
			} )
			.catch( () => setNotFound( true ) );
		// eslint-disable-next-line react-hooks/exhaustive-deps -- id is fixed for this page's lifetime (a different ?product= is a fresh page load).
	}, [] );

	const backUrl = () => {
		const url = new URL( window.location.href );
		url.searchParams.delete( 'product' );
		return url.toString();
	};

	const buyable = product ? purchasablePrices( product ) : [];
	// The visitor's pick, else the default price.
	const chosenPrice = buyable.find( ( price ) => price.id === priceId ) ?? buyable[ 0 ] ?? null;

	const addToCart = () => {
		if ( ! product ) {
			return;
		}

		setIsAdding( true );
		setAdded( false );

		const token = getOrCreateCartToken();

		client
			.post(
				'/cart/items',
				{ product_id: product.id, quantity, ...( chosenPrice ? { price_id: chosenPrice.id } : {} ) },
				{ headers: { 'X-Cart-Token': token } }
			)
			.then( () => setAdded( true ) )
			.finally( () => setIsAdding( false ) );
	};

	if ( notFound ) {
		return (
			<div>
				<p>{ __( 'This product could not be found.', 'vulocart' ) }</p>
				<a href={ backUrl() }>{ __( '← Back to products', 'vulocart' ) }</a>
			</div>
		);
	}

	if ( ! product ) {
		return <p>{ __( 'Loading…', 'vulocart' ) }</p>;
	}

	const price = formatPrice( product );
	const outOfStock = product.meta?.stock_management && 'out_of_stock' === product.meta?.stock_status;
	const gallery = [ product.meta?.featured_image, ...( product.meta?.gallery ?? [] ) ].filter(
		( item ): item is MediaItem => Boolean( item )
	);
	const typeDetails = Object.entries( product.meta?.type_details ?? {} ).filter(
		( [ , value ] ) => '' !== value && null !== value && undefined !== value
	);

	return (
		<div>
			<a href={ backUrl() } style={ { display: 'inline-block', marginBottom: '16px' } }>
				{ __( '← Back to products', 'vulocart' ) }
			</a>

			<div style={ { display: 'flex', gap: '32px', flexWrap: 'wrap' } }>
				<div style={ { flex: '1 1 320px' } }>
					<div
						style={ {
							aspectRatio: '1 / 1',
							background: '#f3f4f6',
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'center',
							borderRadius: '8px',
							overflow: 'hidden',
							marginBottom: '10px',
						} }
					>
						{ activeImage ? (
							<img
								src={ activeImage.url }
								alt={ product.title }
								style={ { width: '100%', height: '100%', objectFit: 'cover' } }
							/>
						) : (
							<span style={ { color: '#9ca3af' } }>{ __( 'No image', 'vulocart' ) }</span>
						) }
					</div>

					{ gallery.length > 1 && (
						<div style={ { display: 'flex', gap: '8px', flexWrap: 'wrap' } }>
							{ gallery.map( ( item ) => (
								<button
									key={ item.id }
									type="button"
									onClick={ () => setActiveImage( item ) }
									style={ {
										width: '56px',
										height: '56px',
										padding: 0,
										border:
											activeImage?.id === item.id
												? '2px solid #4338ca'
												: '1px solid #e5e7eb',
										borderRadius: '6px',
										overflow: 'hidden',
										cursor: 'pointer',
									} }
								>
									<img
										src={ item.url }
										alt=""
										style={ { width: '100%', height: '100%', objectFit: 'cover' } }
									/>
								</button>
							) ) }
						</div>
					) }
				</div>

				<div style={ { flex: '1 1 320px' } }>
					<div
						style={ {
							fontSize: '11px',
							textTransform: 'uppercase',
							letterSpacing: '0.04em',
							color: '#6b7280',
							marginBottom: '6px',
						} }
					>
						{ product.type }
					</div>
					<h1 style={ { fontSize: '26px', margin: '0 0 10px' } }>{ product.title }</h1>

					<div style={ { fontSize: '20px', fontWeight: 700, marginBottom: '12px' } }>
						{ outOfStock ? (
							<span style={ { color: '#dc2626' } }>{ __( 'Out of stock', 'vulocart' ) }</span>
						) : chosenPrice ? (
							<>
								{ formatAmount( chosenPrice.display_amount, product.currency ) }
								{ chosenPrice.display_amount < chosenPrice.amount && (
									<s style={ { marginLeft: '8px', fontSize: '14px', fontWeight: 400, color: '#9ca3af' } }>
										{ formatAmount( chosenPrice.amount, product.currency ) }
									</s>
								) }
								{ billingText( chosenPrice ) && (
									<span style={ { marginLeft: '8px', fontSize: '14px', fontWeight: 400, color: '#6b7280' } }>
										{ billingText( chosenPrice ) }
									</span>
								) }
							</>
						) : (
							price ?? __( 'Price not set', 'vulocart' )
						) }
					</div>

					{ buyable.length > 1 && (
						<div role="radiogroup" aria-label={ __( 'Choose a price', 'vulocart' ) } style={ { display: 'grid', gap: '8px', margin: '0 0 16px' } }>
							{ buyable.map( ( option ) => {
								const selected = chosenPrice?.id === option.id;

								return (
									<button
										key={ option.id }
										type="button"
										role="radio"
										aria-checked={ selected }
										onClick={ () => setPriceId( option.id ) }
										style={ {
											display: 'flex',
											justifyContent: 'space-between',
											alignItems: 'center',
											gap: '12px',
											padding: '10px 14px',
											textAlign: 'left',
											background: selected ? '#eef2ff' : '#fff',
											border: selected ? '2px solid #4338ca' : '1px solid #e5e7eb',
											borderRadius: '8px',
											cursor: 'pointer',
										} }
									>
										<span>
											<strong>{ priceName( option.label ) }</strong>
											{ billingText( option ) && (
												<small style={ { display: 'block', color: '#6b7280' } }>{ billingText( option ) }</small>
											) }
										</span>
										<span style={ { fontWeight: 700 } }>{ formatAmount( option.display_amount, product.currency ) }</span>
									</button>
								);
							} ) }
						</div>
					) }

					{ product.meta?.short_description && (
						<p style={ { color: '#374151' } }>{ product.meta.short_description }</p>
					) }

					{ ! vulocartFrontendData.cartCheckoutEnabled ? (
						<p style={ { color: '#6b7280' } }>
							{ __( 'Ordering is currently unavailable.', 'vulocart' ) }
						</p>
					) : outOfStock ? null : (
						<div style={ { display: 'flex', alignItems: 'center', gap: '10px', margin: '16px 0' } }>
							<div style={ { display: 'flex', alignItems: 'center', gap: '8px' } }>
								<button
									type="button"
									onClick={ () => setQuantity( Math.max( 1, quantity - 1 ) ) }
								>
									−
								</button>
								<span>{ quantity }</span>
								<button type="button" onClick={ () => setQuantity( quantity + 1 ) }>
									+
								</button>
							</div>
							<button
								type="button"
								onClick={ addToCart }
								disabled={ isAdding }
								style={ { padding: '10px 18px', fontWeight: 700 } }
							>
								{ isAdding ? __( 'Adding…', 'vulocart' ) : ctaLabel( product.type ) }
							</button>
						</div>
					) }

					{ added && (
						<p style={ { color: '#16a34a' } }>
							{ __( 'Added to cart!', 'vulocart' ) }{ ' ' }
							{ vulocartFrontendData.checkoutPageUrl && (
								<a href={ vulocartFrontendData.checkoutPageUrl }>
									{ __( 'Go to checkout →', 'vulocart' ) }
								</a>
							) }
						</p>
					) }

					{ typeDetails.length > 0 && (
						<div style={ { marginTop: '20px' } }>
							<h3 style={ { fontSize: '15px' } }>{ __( 'Details', 'vulocart' ) }</h3>
							<table style={ { width: '100%', borderCollapse: 'collapse' } }>
								<tbody>
									{ typeDetails.map( ( [ key, value ] ) => (
										<tr key={ key } style={ { borderTop: '1px solid #e5e7eb' } }>
											<td style={ { padding: '6px 0', color: '#6b7280', width: '50%' } }>
												{ humanizeKey( key ) }
											</td>
											<td style={ { padding: '6px 0' } }>{ String( value ) }</td>
										</tr>
									) ) }
								</tbody>
							</table>
						</div>
					) }

					{ ( product.meta?.specifications ?? [] ).some( ( row ) => row.key ) && (
						<div style={ { marginTop: '20px' } }>
							<h3 style={ { fontSize: '15px' } }>{ __( 'Specifications', 'vulocart' ) }</h3>
							<table style={ { width: '100%', borderCollapse: 'collapse' } }>
								<tbody>
									{ ( product.meta?.specifications ?? [] )
										.filter( ( row ) => row.key )
										.map( ( row, index ) => (
											<tr key={ index } style={ { borderTop: '1px solid #e5e7eb' } }>
												<td style={ { padding: '6px 0', color: '#6b7280', width: '50%' } }>{ row.key }</td>
												<td style={ { padding: '6px 0' } }>{ row.value }</td>
											</tr>
										) ) }
								</tbody>
							</table>
						</div>
					) }

					{ ( product.meta?.faqs ?? [] ).some( ( row ) => row.question ) && (
						<div style={ { marginTop: '20px' } }>
							<h3 style={ { fontSize: '15px' } }>{ __( 'Questions & answers', 'vulocart' ) }</h3>
							{ ( product.meta?.faqs ?? [] )
								.filter( ( row ) => row.question )
								.map( ( row, index ) => (
									<details key={ index } style={ { borderTop: '1px solid #e5e7eb', padding: '8px 0' } }>
										<summary style={ { cursor: 'pointer', fontWeight: 600 } }>{ row.question }</summary>
										<p style={ { margin: '8px 0 0', color: '#374151' } }>{ row.answer }</p>
									</details>
								) ) }
						</div>
					) }

					{ product.meta?.full_description && (
						<div style={ { marginTop: '20px' } }>
							<h3 style={ { fontSize: '15px' } }>{ __( 'Description', 'vulocart' ) }</h3>
							<p style={ { color: '#374151', whiteSpace: 'pre-wrap' } }>
								{ product.meta.full_description }
							</p>
						</div>
					) }
				</div>
			</div>
		</div>
	);
}
