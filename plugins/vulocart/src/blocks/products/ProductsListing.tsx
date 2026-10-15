/* global vulocartFrontendData */
import { useEffect, useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { client } from '../shared/cart';
import { isVisibleInListing } from '../shared/product';
import { ProductCards } from '../shared/ProductCards';
import type { ProductSummary } from '../shared/product';

/**
 * The public catalog grid - `GET /products` (public, published-only for a
 * logged-out visitor, classes/RestAPI/Controllers/Products.php's own
 * docblock), filtered client-side to hide `catalog_visibility: 'hidden'/
 * 'search_only'` products (`isVisibleInListing()`). Each card links to
 * `?product={id}` on this same page - `Products.tsx`'s own docblock
 * explains why that's the whole routing scheme, no page-picker needed.
 *
 * Gated on the Frontend tab's `enable_products_listing`
 * (`vulocartFrontendData.productsListingEnabled`) - the same flag
 * `src/blocks/checkout/Checkout.tsx`'s own "Available Products" section
 * already respects, so both surfaces turn off together.
 */
export function ProductsListing( { template: templateOverride, columns: columnsOverride }: { template?: string; columns?: number } ) {
	const [ products, setProducts ] = useState< ProductSummary[] >( [] );
	const [ isLoading, setIsLoading ] = useState( true );

	useEffect( () => {
		if ( ! vulocartFrontendData.productsListingEnabled ) {
			setIsLoading( false );
			return;
		}

		client
			.get< ProductSummary[] >( '/products', { params: { per_page: 100 } } )
			.then( ( response ) => setProducts( response.data.filter( isVisibleInListing ) ) )
			.finally( () => setIsLoading( false ) );
	}, [] );

	if ( ! vulocartFrontendData.productsListingEnabled ) {
		return (
			<div style={ { border: '1px solid #d1d5db', borderRadius: '8px', padding: '20px' } }>
				<p>{ __( 'This catalog is currently unavailable.', 'vulocart' ) }</p>
			</div>
		);
	}

	if ( isLoading ) {
		return <p>{ __( 'Loading…', 'vulocart' ) }</p>;
	}

	if ( products.length === 0 ) {
		return <p>{ __( 'No products yet.', 'vulocart' ) }</p>;
	}

	return <ProductCards products={ products } template={ templateOverride } columns={ columnsOverride } />;
}
