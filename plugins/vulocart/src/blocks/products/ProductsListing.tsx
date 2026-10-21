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
 */
export function ProductsListing( { template: templateOverride, columns: columnsOverride }: { template?: string; columns?: number } ) {
	const [ products, setProducts ] = useState< ProductSummary[] >( [] );
	const [ isLoading, setIsLoading ] = useState( true );

	useEffect( () => {
		client
			.get< ProductSummary[] >( '/products', { params: { per_page: 100 } } )
			.then( ( response ) => setProducts( response.data.filter( isVisibleInListing ) ) )
			.finally( () => setIsLoading( false ) );
	}, [] );

	if ( isLoading ) {
		return <p>{ __( 'Loading…', 'vulocart' ) }</p>;
	}

	if ( products.length === 0 ) {
		return <p>{ __( 'No products yet.', 'vulocart' ) }</p>;
	}

	return <ProductCards products={ products } template={ templateOverride } columns={ columnsOverride } />;
}
