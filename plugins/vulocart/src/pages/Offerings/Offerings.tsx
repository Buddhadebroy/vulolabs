import { OfferingsList } from './OfferingsList';
import { OfferingEdit } from './OfferingEdit';
import { TermsPage } from '../Terms/TermsPage';
import { AttributesPage } from '../Attributes/AttributesPage';
import { OfferingTypesPage } from '../OfferingTypes/OfferingTypesPage';
import { InventoryPage } from '../Inventory/InventoryPage';
import { ReviewsPage } from '../Reviews/ReviewsPage';
import { __ } from '@wordpress/i18n';
import { applyFilters } from '@wordpress/hooks';

interface OfferingsProps {
	action: string | null;
	id: number | null;
	/** `categories`|`collections`|`brands`|`tags`|`attributes`|`offering-types`|`inventory`|`reviews`. */
	view: string | null;
}

/**
 * Branches between the list, the dedicated add/edit page, and every other
 * Offerings-menu sub-page (Categories/Collections/Brands/Attributes/
 * Offering Types/Inventory/Reviews) based on the `action`/`id`/`view`
 * query params src/index.tsx parses from `location.search` on mount —
 * see Menu.php's `add_offerings_menu()` docblock for why this is
 * query-string-driven rather than a client-side route: every transition
 * here is a real browser navigation to a distinct
 * `admin.php?page=vulocart-offerings...` URL, matching WooCommerce's own
 * Products/Orders admin screens. Any `view` this file doesn't recognize
 * falls through to `vulocart_offerings_extra_view` before finally
 * defaulting to `OfferingsList` — vulocart-pro's own Suppliers/Pricing
 * Rules/Offering Templates/Bulk Editor/CSV Import admin pages register
 * their own `add_submenu_page()` entries under this same `vulocart-offerings`
 * parent slug (License\LicenseManager's own `register_menu()` already
 * establishes that Pro plugins registering submenu pages under a Free
 * top-level slug is a proven, working pattern in this codebase) with
 * `view=suppliers` etc., and hook into that filter to render there.
 */
export function Offerings( { action, id, view }: OfferingsProps ) {
	if ( 'add' === action ) {
		return <OfferingEdit id={ null } />;
	}

	if ( 'edit' === action && null !== id ) {
		return <OfferingEdit id={ id } />;
	}

	if ( 'categories' === view ) {
		return (
			<TermsPage
				routeSegment="categories"
				headerTitle={ __( 'Categories', 'vulocart' ) }
				headerDescription={ __( 'Group offerings into a hierarchy of categories.', 'vulocart' ) }
				headerIcon="category"
				hierarchical
			/>
		);
	}

	if ( 'collections' === view ) {
		return (
			<TermsPage
				routeSegment="collections"
				headerTitle={ __( 'Collections', 'vulocart' ) }
				headerDescription={ __( 'Manually-curated groups of offerings, e.g. "Summer Sale" or "Staff Picks".', 'vulocart' ) }
				headerIcon="folder-open"
			/>
		);
	}

	if ( 'brands' === view ) {
		return (
			<TermsPage
				routeSegment="brands"
				headerTitle={ __( 'Brands', 'vulocart' ) }
				headerDescription={ __( 'The manufacturers/brands your offerings come from.', 'vulocart' ) }
				headerIcon="product"
			/>
		);
	}

	if ( 'tags' === view ) {
		return (
			<TermsPage
				routeSegment="tags"
				headerTitle={ __( 'Tags', 'vulocart' ) }
				headerDescription={ __( 'Free-form labels offerings can carry, e.g. "clearance" or "eco-friendly".', 'vulocart' ) }
				headerIcon="tag"
			/>
		);
	}

	if ( 'attributes' === view ) {
		return <AttributesPage />;
	}

	if ( 'offering-types' === view ) {
		return <OfferingTypesPage />;
	}

	if ( 'inventory' === view ) {
		return <InventoryPage />;
	}

	if ( 'reviews' === view ) {
		return <ReviewsPage />;
	}

	if ( view ) {
		/**
		 * `vulocart_offerings_extra_view` — the same "Pro extends Free via
		 * filters" pattern `vulocart_offering_row_actions`/
		 * `vulocart_offering_edit_sections` already establish, extended to
		 * this router itself: a Pro module (e.g. vulocart-pro's Suppliers/
		 * Pricing Rules/Offering Templates/Bulk Editor/CSV Import admin
		 * pages) can register its own `view` value here without this file
		 * knowing anything about it. Only consulted when `view` is a
		 * non-empty string this router didn't already recognize above —
		 * an unmatched/typo'd `view` still falls through to `OfferingsList`
		 * exactly like it always has, so this is purely additive.
		 */
		const extra = applyFilters( 'vulocart_offerings_extra_view', null, { view } );

		if ( extra ) {
			return <>{ extra }</>;
		}
	}

	return <OfferingsList />;
}

export default Offerings;
