import { applyFilters } from '@wordpress/hooks';
import { CustomersList } from './CustomersList';
import { CustomerDetail } from './CustomerDetail';

interface CustomersProps {
	action: string | null;
	id: number | null;
	/** `groups`|`segments` (vulocart-pro's own CustomerGrowth module) — anything else falls through to the list. */
	view: string | null;
}

/**
 * Branches between the list, the customer-detail page, and any Pro-
 * registered extra view, based on the `action`/`id`/`view` query params
 * `src/index.tsx` parses from `location.search` on mount — same query-
 * string-driven navigation `Orders.tsx`/`Offerings.tsx` already establish.
 * `vulocart_customers_extra_view` is the exact same "Pro extends Free via
 * a filtered router" shape `vulocart_offerings_extra_view` establishes
 * for the Offerings screen (Offerings.tsx's own docblock) — vulocart-pro's
 * CustomerGrowth module registers `view=groups`/`view=segments` into it.
 */
export function Customers( { action, id, view }: CustomersProps ) {
	if ( 'view' === action && null !== id ) {
		return <CustomerDetail id={ id } />;
	}

	if ( view ) {
		const extra = applyFilters( 'vulocart_customers_extra_view', null, { view } );

		if ( extra ) {
			return <>{ extra }</>;
		}
	}

	return <CustomersList />;
}

export default Customers;
