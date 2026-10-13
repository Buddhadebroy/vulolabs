/* global vulocartFrontendData */
import { useEffect, useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { client } from '../shared/cart';
import { isVisibleInListing } from '../shared/offering';
import { OfferingCards } from '../shared/OfferingCards';
import type { OfferingSummary } from '../shared/offering';

/**
 * The public catalog grid - `GET /offerings` (public, published-only for a
 * logged-out visitor, classes/RestAPI/Controllers/Offerings.php's own
 * docblock), filtered client-side to hide `catalog_visibility: 'hidden'/
 * 'search_only'` offerings (`isVisibleInListing()`). Each card links to
 * `?offering={id}` on this same page - `Offerings.tsx`'s own docblock
 * explains why that's the whole routing scheme, no page-picker needed.
 *
 * Gated on the Frontend tab's `enable_offerings_listing`
 * (`vulocartFrontendData.offeringsListingEnabled`) - the same flag
 * `src/blocks/checkout/Checkout.tsx`'s own "Available Offerings" section
 * already respects, so both surfaces turn off together.
 */
export function OfferingsListing( { template: templateOverride, columns: columnsOverride }: { template?: string; columns?: number } ) {
	const [ offerings, setOfferings ] = useState< OfferingSummary[] >( [] );
	const [ isLoading, setIsLoading ] = useState( true );

	useEffect( () => {
		if ( ! vulocartFrontendData.offeringsListingEnabled ) {
			setIsLoading( false );
			return;
		}

		client
			.get< OfferingSummary[] >( '/offerings', { params: { per_page: 100 } } )
			.then( ( response ) => setOfferings( response.data.filter( isVisibleInListing ) ) )
			.finally( () => setIsLoading( false ) );
	}, [] );

	if ( ! vulocartFrontendData.offeringsListingEnabled ) {
		return (
			<div style={ { border: '1px solid #d1d5db', borderRadius: '8px', padding: '20px' } }>
				<p>{ __( 'This catalog is currently unavailable.', 'vulocart' ) }</p>
			</div>
		);
	}

	if ( isLoading ) {
		return <p>{ __( 'Loading…', 'vulocart' ) }</p>;
	}

	if ( offerings.length === 0 ) {
		return <p>{ __( 'No offerings yet.', 'vulocart' ) }</p>;
	}

	return <OfferingCards offerings={ offerings } template={ templateOverride } columns={ columnsOverride } />;
}
